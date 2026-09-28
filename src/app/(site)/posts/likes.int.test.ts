/**
 * Likes against the real database: the action, the public API route, the
 * liked list, the dashboard counts, and cleanup when posts or people go.
 * Only touches `int-like-*` rows. Run with `npm run test:int`.
 */
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as likesRoute } from "@/app/api/posts/[id]/likes/route";
import { db } from "@/db";
import { postLikes, posts, rateLimit, user } from "@/db/schema";
import type { Role } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { getAdminPosts, getDashboardMostLiked } from "@/lib/queries/admin";
import { getLikedPosts, getLikeState } from "@/lib/queries/likes";

import { setLike } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
  }),
}));

const P = "int-like";
const READER = { id: `${P}-reader`, role: "reader" as Role };
const OTHER = { id: `${P}-other`, role: "reader" as Role };
const AUTHOR = { id: `${P}-author`, role: "author" as Role };
const ADMIN = { id: `${P}-admin`, role: "admin" as Role };

function actAs(u: { id: string; role: Role } | null) {
  vi.mocked(getSession).mockResolvedValue(
    u
      ? ({ user: { ...u, name: u.id, email: `${u.id}@folio.local` } } as never)
      : null,
  );
}

const day = 86_400_000;
const ids = {
  live: crypto.randomUUID(),
  older: crypto.randomUUID(),
  draft: crypto.randomUUID(),
  future: crypto.randomUUID(),
};

async function cleanup() {
  await db.delete(posts).where(like(posts.slug, `${P}-%`));
  await db.delete(rateLimit).where(
    inArray(
      rateLimit.key,
      [READER, OTHER, AUTHOR, ADMIN].map((u) => `app:like:${u.id}`),
    ),
  );
  await db.delete(user).where(like(user.id, `${P}-%`));
}

async function likeState(postId: string, signedIn = true) {
  actAs(signedIn ? READER : null);
  const res = await likesRoute(new Request("http://localhost"), {
    params: Promise.resolve({ id: postId }),
  });
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  await cleanup();
  await db.insert(user).values(
    [READER, OTHER, AUTHOR, ADMIN].map((u) => ({
      ...u,
      name: u.id,
      email: `${u.id}@folio.local`,
    })),
  );
  const post = (id: string, slug: string, status: string, at: Date | null) => ({
    id,
    title: slug,
    slug: `${P}-${slug}`,
    status: status as "published",
    publishedAt: at,
    authorId: AUTHOR.id,
  });
  await db
    .insert(posts)
    .values([
      post(ids.live, "live", "published", new Date(Date.now() - day)),
      post(ids.older, "older", "published", new Date(Date.now() - 3 * day)),
      post(ids.draft, "draft", "draft", null),
      post(ids.future, "future", "scheduled", new Date(Date.now() + day)),
    ]);
});

afterAll(cleanup);

describe("liking", () => {
  it("needs an account", async () => {
    actAs(null);
    expect((await setLike(ids.live, true)).ok).toBe(false);
  });

  it("likes and unlikes, idempotently", async () => {
    actAs(READER);
    expect(await setLike(ids.live, true)).toEqual({
      ok: true,
      data: { count: 1, liked: true },
    });
    // Liking twice (a double click) doesn't double count.
    expect(await setLike(ids.live, true)).toEqual({
      ok: true,
      data: { count: 1, liked: true },
    });
    actAs(OTHER);
    expect(await setLike(ids.live, true)).toMatchObject({
      data: { count: 2, liked: true },
    });
    expect(await setLike(ids.live, false)).toMatchObject({
      data: { count: 1, liked: false },
    });
    expect(await setLike(ids.live, false)).toMatchObject({
      data: { count: 1, liked: false },
    });
  });

  it("only works on live posts", async () => {
    actAs(READER);
    for (const id of [ids.draft, ids.future, crypto.randomUUID()]) {
      expect(await setLike(id, true)).toMatchObject({
        ok: false,
        error: expect.stringMatching(/isn't available/),
      });
    }
    expect((await setLike("not-a-uuid", true)).ok).toBe(false);
    expect((await setLike(ids.live, "yes")).ok).toBe(false);
  });

  it("is rate-limited per person", async () => {
    actAs(ADMIN);
    const results = [];
    for (let i = 0; i < 31; i++) {
      results.push((await setLike(ids.older, i % 2 === 0)).ok);
    }
    expect(results.slice(0, 30).every(Boolean)).toBe(true);
    expect(results[30]).toBe(false);
    await db.delete(rateLimit).where(eq(rateLimit.key, `app:like:${ADMIN.id}`));
  });
});

describe("the public API", () => {
  it("returns the total and the viewer's own like", async () => {
    expect(await likeState(ids.live)).toEqual({
      status: 200,
      body: { count: 1, liked: true, canSignUp: false },
    });
    const signedOut = await likeState(ids.live, false);
    expect(signedOut.body).toMatchObject({ count: 1, liked: null });
    expect(typeof signedOut.body.canSignUp).toBe("boolean");
  });

  it("hides posts that aren't live", async () => {
    expect((await likeState(ids.draft)).status).toBe(404);
    expect((await likeState(ids.future)).status).toBe(404);
    expect((await likeState("nope")).status).toBe(404);
  });
});

describe("liked stories", () => {
  it("lists live likes, most recently liked first", async () => {
    actAs(READER);
    await setLike(ids.older, true); // liked after `live`
    const { posts: list, total } = await getLikedPosts(READER.id);
    expect(list.map((p) => p.id)).toEqual([ids.older, ids.live]);
    expect(total).toBe(2);

    // Unpublishing hides it from the list (the like itself stays).
    await db
      .update(posts)
      .set({ status: "draft" })
      .where(eq(posts.id, ids.older));
    expect((await getLikedPosts(READER.id)).posts.map((p) => p.id)).toEqual([
      ids.live,
    ]);
    await db
      .update(posts)
      .set({ status: "published" })
      .where(eq(posts.id, ids.older));
  });
});

describe("the dashboard", () => {
  it("shows counts on posts and the most liked, in the viewer's scope", async () => {
    actAs(ADMIN);
    const session = await getSession();
    const rows = await getAdminPosts(session!);
    const counts = Object.fromEntries(
      rows.filter((r) => r.slug.startsWith(P)).map((r) => [r.slug, r.likes]),
    );
    expect(counts).toMatchObject({
      [`${P}-live`]: 1,
      [`${P}-older`]: 1,
      [`${P}-draft`]: 0,
    });

    // Authors only see their own posts ranked; others see nothing of ours.
    actAs(AUTHOR);
    const mine = await getDashboardMostLiked((await getSession())!);
    expect(mine.map((p) => p.id).sort()).toEqual([ids.live, ids.older].sort());
    actAs({ id: `${P}-nobody`, role: "author" });
    expect(await getDashboardMostLiked((await getSession())!)).toEqual([]);
  });
});

describe("cleanup", () => {
  it("removes likes with the account or the post", async () => {
    await db.delete(user).where(eq(user.id, READER.id));
    expect(await getLikeState(ids.live)).toEqual({ count: 0, liked: null });

    actAs(OTHER);
    await setLike(ids.older, true);
    await db.delete(posts).where(eq(posts.id, ids.older));
    expect(
      await db.select().from(postLikes).where(eq(postLikes.postId, ids.older)),
    ).toEqual([]);
  });
});
