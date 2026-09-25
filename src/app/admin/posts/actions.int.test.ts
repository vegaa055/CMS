/**
 * Integration tests for post server actions against the real database
 * (DATABASE_URL from .env.local — use the Neon `dev` branch). Only the
 * session and Next cache APIs are mocked. Run with `npm run test:int`.
 */
import { eq, inArray, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { db } from "@/db";
import { posts, postTags, tags, user } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

import { deletePost, savePost } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

const AUTHOR = { id: "int-test-author", role: "author" as const };
const EDITOR = { id: "int-test-editor", role: "editor" as const };
const PREFIX = "int-test";

function actAs(u: typeof AUTHOR | typeof EDITOR) {
  vi.mocked(getSession).mockResolvedValue({
    user: { ...u, name: u.id, email: `${u.id}@folio.local` },
  } as never);
}

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const base = {
  title: "Int Test Post",
  slug: "",
  excerpt: "",
  content: doc("Hello world"),
  tags: [] as string[],
  seoTitle: "",
  seoDescription: "",
  status: "draft" as const,
  publishedAt: null,
};

async function cleanup() {
  await db.delete(posts).where(like(posts.slug, `${PREFIX}%`));
  await db.delete(tags).where(like(tags.slug, `${PREFIX}%`));
  await db.delete(user).where(inArray(user.id, [AUTHOR.id, EDITOR.id]));
}

beforeAll(async () => {
  await cleanup();
  await db.insert(user).values(
    [AUTHOR, EDITOR].map((u) => ({
      id: u.id,
      role: u.role,
      name: u.id,
      email: `${u.id}@folio.local`,
    })),
  );
  await db
    .insert(tags)
    .values({ name: "Int Test Existing", slug: `${PREFIX}-existing` });
});

afterAll(cleanup);

beforeEach(() => vi.mocked(revalidatePath).mockClear());

describe("savePost", () => {
  let draftId: string;

  it("lets an author create a draft with an existing tag", async () => {
    actAs(AUTHOR);
    const result = await savePost({ ...base, tags: ["Int Test Existing"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    draftId = result.data.id;
    expect(result.data).toMatchObject({
      slug: "int-test-post",
      status: "draft",
      publishedAt: null,
    });

    const row = await db.query.posts.findFirst({
      where: eq(posts.id, draftId),
    });
    expect(row).toMatchObject({
      authorId: AUTHOR.id,
      contentText: "Hello world",
    });
    const links = await db
      .select()
      .from(postTags)
      .where(eq(postTags.postId, draftId));
    expect(links).toHaveLength(1);
    // Drafts never touch the public site cache.
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("stops authors from creating new tags", async () => {
    actAs(AUTHOR);
    const result = await savePost({
      ...base,
      id: draftId,
      tags: ["Int Test Brand New"],
    });
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { tags: expect.any(String) },
    });
  });

  it("stops authors from publishing", async () => {
    actAs(AUTHOR);
    const result = await savePost({
      ...base,
      id: draftId,
      status: "published",
    });
    expect(result.ok).toBe(false);
  });

  it("de-duplicates slugs", async () => {
    actAs(EDITOR);
    const result = await savePost({ ...base });
    expect(result.ok && result.data.slug).toBe("int-test-post-2");
  });

  it("lets an editor publish, creating tags and revalidating the site", async () => {
    actAs(EDITOR);
    const result = await savePost({
      ...base,
      id: draftId,
      status: "published",
      tags: ["Int Test New Tag"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("published");
    expect(result.data.publishedAt).not.toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/");

    // Tag links are replaced, not appended.
    const linked = await db
      .select({ slug: tags.slug })
      .from(postTags)
      .innerJoin(tags, eq(tags.id, postTags.tagId))
      .where(eq(postTags.postId, draftId));
    expect(linked.map((t) => t.slug)).toEqual([`${PREFIX}-new-tag`]);
  });

  it("locks live posts from their author", async () => {
    actAs(AUTHOR);
    expect((await savePost({ ...base, id: draftId, title: "Hijack" })).ok).toBe(
      false,
    );
    expect((await deletePost(draftId)).ok).toBe(false);
  });

  it("schedules future posts and publishes past-dated ones", async () => {
    actAs(EDITOR);
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const scheduled = await savePost({
      ...base,
      title: "Int Test Later",
      status: "scheduled",
      publishedAt: future,
    });
    expect(scheduled.ok && scheduled.data.status).toBe("scheduled");

    const past = new Date(Date.now() - 86_400_000).toISOString();
    const backdated = await savePost({
      ...base,
      title: "Int Test Earlier",
      status: "scheduled",
      publishedAt: past,
    });
    expect(backdated.ok && backdated.data.status).toBe("published");
  });

  it("rejects invalid documents and bad slugs", async () => {
    actAs(EDITOR);
    const badDoc = await savePost({
      ...base,
      content: { type: "doc", content: [{ type: "script" }] },
    });
    expect(badDoc.ok).toBe(false);
    const badSlug = await savePost({ ...base, slug: "Not A Slug" });
    expect(badSlug).toMatchObject({
      ok: false,
      fieldErrors: { slug: expect.any(String) },
    });
  });

  it("requires a session", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect((await savePost(base)).ok).toBe(false);
  });
});

describe("deletePost", () => {
  it("lets an editor delete any post", async () => {
    actAs(EDITOR);
    const created = await savePost({ ...base, title: "Int Test Doomed" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect((await deletePost(created.data.id)).ok).toBe(true);
    expect(
      await db.query.posts.findFirst({ where: eq(posts.id, created.data.id) }),
    ).toBeUndefined();
  });

  it("rejects malformed ids", async () => {
    actAs(EDITOR);
    expect((await deletePost("not-a-uuid")).ok).toBe(false);
  });
});
