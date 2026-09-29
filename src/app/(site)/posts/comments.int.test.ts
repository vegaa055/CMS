/**
 * Comments against the real database: posting (verification, open/closed,
 * moderation modes, one level of replies), editing, deleting, moderating,
 * the viewer API, and the lists built on them. Comment settings are mocked,
 * never written. Only touches `int-cmt-*` rows. Run with `npm run test:int`.
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

import { moderateComment } from "@/app/admin/comments/actions";
import { GET as commentsRoute } from "@/app/api/posts/[id]/comments/route";
import { db } from "@/db";
import { comments, posts, rateLimit, user } from "@/db/schema";
import type { Role } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { COMMENT_MAX_LENGTH, EDIT_WINDOW_MS } from "@/lib/comments";
import {
  getCommentCounts,
  getCommentedPostSlugs,
  getModerationQueue,
  getMyComments,
  getPostThread,
  getViewerPendingComments,
} from "@/lib/queries/comments";
import { getCommentSettings } from "@/lib/settings";
import type { CommentSettings } from "@/lib/validation/settings";

import { deleteComment, editComment, postComment } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/settings")>()),
  getCommentSettings: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
  }),
}));

const P = "int-cmt";
type Person = { id: string; role: Role; emailVerified: boolean };
const person = (name: string, role: Role, emailVerified = true): Person => ({
  id: `${P}-${name}`,
  role,
  emailVerified,
});
const READER = person("reader", "reader");
const OTHER = person("other", "reader");
const NEWBIE = person("newbie", "reader");
const UNVERIFIED = person("unverified", "reader", false);
const AUTHOR = person("author", "author");
const EDITOR = person("editor", "editor");
const PEOPLE = [READER, OTHER, NEWBIE, UNVERIFIED, AUTHOR, EDITOR];

function actAs(u: Person | null) {
  vi.mocked(getSession).mockResolvedValue(
    u
      ? ({
          user: {
            ...u,
            name: `Name ${u.id}`,
            email: `${u.id}@folio.local`,
            image: null,
          },
        } as never)
      : null,
  );
}

function settings(value: Partial<CommentSettings> = {}) {
  vi.mocked(getCommentSettings).mockResolvedValue({
    enabled: true,
    moderation: "first",
    ...value,
  });
}

const ids = {
  live: crypto.randomUUID(),
  closed: crypto.randomUUID(),
  draft: crypto.randomUUID(),
};
const livePath = `/posts/${P}-live`;

async function post(body: string, parentId?: string, postId = ids.live) {
  const result = await postComment({ postId, parentId, body });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

async function row(id: string) {
  const [found] = await db.select().from(comments).where(eq(comments.id, id));
  return found;
}

async function clearLimits() {
  await db.delete(rateLimit).where(
    inArray(
      rateLimit.key,
      PEOPLE.flatMap((u) => [
        `app:comment:min:${u.id}`,
        `app:comment:day:${u.id}`,
      ]),
    ),
  );
}

async function cleanup() {
  await db.delete(posts).where(like(posts.slug, `${P}-%`));
  await clearLimits();
  await db.delete(user).where(like(user.id, `${P}-%`));
}

async function viewerState(u: Person | null) {
  actAs(u);
  const res = await commentsRoute(new Request("http://localhost"), {
    params: Promise.resolve({ id: ids.live }),
  });
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  await cleanup();
  await db.insert(user).values(
    PEOPLE.map((u) => ({
      ...u,
      name: `Name ${u.id}`,
      email: `${u.id}@folio.local`,
    })),
  );
  const at = new Date(Date.now() - 86_400_000);
  await db.insert(posts).values([
    {
      id: ids.live,
      title: "Int comments",
      slug: `${P}-live`,
      status: "published",
      publishedAt: at,
      authorId: AUTHOR.id,
    },
    {
      id: ids.closed,
      title: "Int closed",
      slug: `${P}-closed`,
      status: "published",
      publishedAt: at,
      authorId: AUTHOR.id,
      commentsEnabled: false,
    },
    {
      id: ids.draft,
      title: "Int draft",
      slug: `${P}-draft`,
      status: "draft",
      authorId: AUTHOR.id,
    },
  ]);
});

beforeEach(async () => {
  settings();
  vi.mocked(revalidatePath).mockClear();
  await clearLimits();
});

afterAll(cleanup);

describe("posting", () => {
  it("needs a signed-in person with a confirmed email", async () => {
    actAs(null);
    expect(await postComment({ postId: ids.live, body: "Hi" })).toMatchObject({
      ok: false,
    });
    actAs(UNVERIFIED);
    expect(await postComment({ postId: ids.live, body: "Hi" })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/confirm your email/i),
    });
  });

  it("only works while comments are open on a live post", async () => {
    actAs(READER);
    settings({ enabled: false });
    expect(await postComment({ postId: ids.live, body: "Hi" })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/closed/),
    });
    settings();
    expect(await postComment({ postId: ids.closed, body: "Hi" })).toMatchObject(
      { ok: false, error: expect.stringMatching(/closed/) },
    );
    for (const postId of [ids.draft, crypto.randomUUID()]) {
      expect(await postComment({ postId, body: "Hi" })).toMatchObject({
        ok: false,
        error: expect.stringMatching(/isn't available/),
      });
    }
  });

  it("checks the text", async () => {
    actAs(READER);
    for (const body of ["", "   ", "x".repeat(COMMENT_MAX_LENGTH + 1)]) {
      expect((await postComment({ postId: ids.live, body })).ok).toBe(false);
    }
    expect((await postComment({ postId: "nope", body: "Hi" })).ok).toBe(false);
  });

  it("holds a reader's first comment, then publishes the rest", async () => {
    actAs(READER);
    const first = await post("  First!  ");
    expect(first).toMatchObject({
      status: "pending",
      body: "First!",
      author: { id: READER.id, badge: null },
    });
    // Pending comments don't touch the cached page, and only their author sees them.
    expect(revalidatePath).not.toHaveBeenCalled();
    expect((await getPostThread(ids.live, AUTHOR.id)).comments).toEqual([]);
    expect(
      (await getViewerPendingComments(ids.live, READER.id, AUTHOR.id)).map(
        (c) => c.id,
      ),
    ).toEqual([first.id]);

    actAs(EDITOR);
    expect(await moderateComment(first.id, "approve")).toEqual({
      ok: true,
      data: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith(livePath);

    actAs(READER);
    expect((await post("Second")).status).toBe("approved");
    const thread = await getPostThread(ids.live, AUTHOR.id);
    expect(thread.comments.map((c) => c.body)).toEqual(["First!", "Second"]);
    expect(thread.total).toBe(2);
  });

  it("follows the other moderation settings", async () => {
    settings({ moderation: "all" });
    actAs(READER);
    expect((await post("Held anyway")).status).toBe("pending");
    settings({ moderation: "none" });
    actAs(NEWBIE);
    expect((await post("Straight in")).status).toBe("approved");
  });

  it("publishes the team's comments straight away, with a badge", async () => {
    settings({ moderation: "all" });
    actAs(AUTHOR);
    expect(await post("From the author")).toMatchObject({
      status: "approved",
      author: { badge: "author" },
    });
    actAs(EDITOR);
    expect(await post("From the team")).toMatchObject({
      status: "approved",
      author: { badge: "team" },
    });
  });

  it("keeps replies one level deep", async () => {
    actAs(OTHER);
    settings({ moderation: "none" });
    const top = await post("Top");
    actAs(AUTHOR);
    const reply = await post("Reply", top.id);
    expect(reply.parentId).toBe(top.id);
    actAs(OTHER);
    // Answering a reply joins the same thread.
    expect((await post("Reply to the reply", reply.id)).parentId).toBe(top.id);

    // Comments awaiting approval can't be answered.
    settings({ moderation: "all" });
    const held = await post("Held");
    actAs(AUTHOR);
    expect(
      await postComment({ postId: ids.live, parentId: held.id, body: "No" }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/no longer/) });
    // Nor can a reply cross over to another post.
    expect(
      await postComment({ postId: ids.closed, parentId: top.id, body: "No" }),
    ).toMatchObject({ ok: false });

    const thread = await getPostThread(ids.live, AUTHOR.id);
    const found = thread.comments.find((c) => c.id === top.id);
    expect(found?.replies.map((r) => r.body)).toEqual([
      "Reply",
      "Reply to the reply",
    ]);
  });

  it("is rate-limited per person", async () => {
    actAs(NEWBIE);
    settings({ moderation: "none" });
    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push((await postComment({ postId: ids.live, body: `n${i}` })).ok);
    }
    expect(results).toEqual([true, true, true, true, true, false]);
  });
});

describe("editing", () => {
  it("lets authors change their words for an hour", async () => {
    actAs(READER);
    const mine = await post("Tpyo");
    const edited = await editComment({ id: mine.id, body: "Typo" });
    expect(edited).toMatchObject({
      ok: true,
      data: { body: "Typo", editedAt: expect.any(String) },
    });
    expect(await row(mine.id)).toMatchObject({ body: "Typo" });

    actAs(OTHER);
    expect(await editComment({ id: mine.id, body: "Hijacked" })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/your own/),
    });
    actAs(EDITOR);
    expect((await editComment({ id: mine.id, body: "Hijacked" })).ok).toBe(
      false,
    );

    await db
      .update(comments)
      .set({ createdAt: new Date(Date.now() - EDIT_WINDOW_MS - 1000) })
      .where(eq(comments.id, mine.id));
    actAs(READER);
    expect(await editComment({ id: mine.id, body: "Late" })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/an hour/),
    });
    expect(await row(mine.id)).toMatchObject({ body: "Typo" });
  });
});

describe("deleting", () => {
  it("removes a comment, leaving a placeholder while it has replies", async () => {
    settings({ moderation: "none" });
    actAs(OTHER);
    const top = await post("Deletable top");
    actAs(READER);
    const reply = await post("A reply", top.id);

    actAs(READER);
    expect((await deleteComment(top.id)).ok).toBe(false); // not theirs
    actAs(OTHER);
    expect(await deleteComment(top.id)).toEqual({
      ok: true,
      data: { removed: "soft" },
    });
    expect(await row(top.id)).toMatchObject({
      body: "",
      deletedAt: expect.any(Date),
    });
    let thread = await getPostThread(ids.live, AUTHOR.id);
    const placeholder = thread.comments.find((c) => c.id === top.id);
    expect(placeholder).toMatchObject({ deleted: true, body: "" });
    expect(placeholder?.replies.map((r) => r.id)).toEqual([reply.id]);
    // It can't be deleted or answered again.
    expect((await deleteComment(top.id)).ok).toBe(false);

    // The last reply going takes the placeholder with it.
    actAs(READER);
    expect(await deleteComment(reply.id)).toEqual({
      ok: true,
      data: { removed: "hard" },
    });
    expect(await row(reply.id)).toBeUndefined();
    expect(await row(top.id)).toBeUndefined();
    thread = await getPostThread(ids.live, AUTHOR.id);
    expect(thread.comments.some((c) => c.id === top.id)).toBe(false);
  });

  it("lets moderators delete anyone's comment", async () => {
    settings({ moderation: "none" });
    actAs(NEWBIE);
    const theirs = await post("Rude");
    actAs(AUTHOR); // authors don't moderate
    expect((await deleteComment(theirs.id)).ok).toBe(false);
    actAs(EDITOR);
    expect(await deleteComment(theirs.id)).toMatchObject({
      ok: true,
      data: { removed: "hard" },
    });
  });
});

describe("moderating", () => {
  it("is for editors and admins", async () => {
    settings({ moderation: "none" });
    actAs(OTHER);
    const target = await post("Moderate me");
    for (const u of [OTHER, AUTHOR, null]) {
      actAs(u);
      expect((await moderateComment(target.id, "spam")).ok).toBe(false);
    }
    actAs(EDITOR);
    expect((await moderateComment(target.id, "bogus")).ok).toBe(false);
    expect((await moderateComment("nope", "spam")).ok).toBe(false);
    expect(await row(target.id)).toMatchObject({ status: "approved" });
  });

  it("hides spam from the post and keeps it in the spam queue", async () => {
    settings({ moderation: "none" });
    actAs(OTHER);
    const spam = await post("Buy things https://spam.example");
    actAs(EDITOR);
    await moderateComment(spam.id, "spam");
    expect(revalidatePath).toHaveBeenCalledWith(livePath);
    const thread = await getPostThread(ids.live, AUTHOR.id);
    expect(thread.comments.some((c) => c.id === spam.id)).toBe(false);

    const queue = await getModerationQueue({ status: "spam", page: 1 });
    expect(queue.rows.find((r) => r.id === spam.id)).toMatchObject({
      status: "spam",
      author: { email: `${OTHER.id}@folio.local`, staff: false },
      post: { title: "Int comments", slug: `${P}-live` },
      reply: null,
    });
    expect((await getCommentCounts()).spam).toBeGreaterThanOrEqual(1);

    await moderateComment(spam.id, "delete");
    expect(await row(spam.id)).toBeUndefined();
  });
});

describe("the viewer API", () => {
  it("tells signed-out visitors whether they could join", async () => {
    const { status, body } = await viewerState(null);
    expect(status).toBe(200);
    expect(body).toMatchObject({ open: true, viewer: null, pending: [] });
    expect(typeof body.canSignUp).toBe("boolean");
  });

  it("returns the viewer, whether they'd be held, and their pending comments", async () => {
    settings({ moderation: "all" });
    actAs(NEWBIE);
    const held = await post("Waiting");
    const { body } = await viewerState(NEWBIE);
    expect(body).toMatchObject({
      open: true,
      canSignUp: false,
      viewer: { id: NEWBIE.id, verified: true, moderator: false, held: true },
    });
    expect(body.pending.map((c: { id: string }) => c.id)).toContain(held.id);

    settings({ moderation: "first" });
    // Their earlier comment was published, so they're trusted now.
    expect((await viewerState(NEWBIE)).body.viewer.held).toBe(false);
    expect((await viewerState(UNVERIFIED)).body.viewer).toMatchObject({
      verified: false,
      held: true,
    });
    expect((await viewerState(EDITOR)).body.viewer).toMatchObject({
      verified: true,
      moderator: true,
      held: false,
    });

    settings({ enabled: false });
    expect((await viewerState(READER)).body.open).toBe(false);
  });

  it("hides posts that aren't live", async () => {
    actAs(READER);
    const res = await commentsRoute(new Request("http://localhost"), {
      params: Promise.resolve({ id: ids.draft }),
    });
    expect(res.status).toBe(404);
  });
});

describe("lists", () => {
  it("shows people their own comments on live posts", async () => {
    const { comments: mine, total } = await getMyComments(READER.id);
    expect(total).toBe(mine.length);
    expect(mine.length).toBeGreaterThan(0);
    // Newest first, including ones still waiting.
    const times = mine.map((c) => c.createdAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(mine.some((c) => c.status === "pending")).toBe(true);
    expect(await getCommentedPostSlugs(READER.id)).toEqual([`${P}-live`]);
  });

  it("keeps comments, unattributed, when their author goes", async () => {
    settings({ moderation: "none" });
    actAs(NEWBIE);
    const orphan = await post("Still here");
    await db.delete(user).where(eq(user.id, NEWBIE.id));
    const thread = await getPostThread(ids.live, AUTHOR.id);
    expect(thread.comments.find((c) => c.id === orphan.id)).toMatchObject({
      body: "Still here",
      author: null,
    });
  });

  it("goes with the post", async () => {
    await db.delete(posts).where(eq(posts.id, ids.live));
    const left = await db
      .select({ id: comments.id })
      .from(comments)
      .where(eq(comments.postId, ids.live));
    expect(left).toEqual([]);
  });
});
