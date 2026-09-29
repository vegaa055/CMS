/**
 * Moderation against the real database: what's held for review (blocked
 * words, links, edits), reader reports, bulk decisions, emptying spam, bans
 * and spam + ban, the queue's labels, and the dashboard's weekly activity.
 * Comment settings and notifications are mocked. Only touches `int-mod-*`
 * rows. Run with `npm run test:int`.
 */
import { and, eq, inArray, isNull, like, not } from "drizzle-orm";
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

import {
  editComment,
  postComment,
  reportComment,
} from "@/app/(site)/posts/actions";
import { db } from "@/db";
import {
  commentReports,
  comments,
  postLikes,
  posts,
  rateLimit,
  session,
  user,
} from "@/db/schema";
import type { Role } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { getModerationQueue, getPostThread } from "@/lib/queries/comments";
import { getWeeklyActivity } from "@/lib/queries/stats";
import { getCommentSettings } from "@/lib/settings";
import type { CommentSettings } from "@/lib/validation/settings";

import {
  banReader,
  deleteAllSpam,
  moderateComment,
  moderateComments,
  spamAndBan,
  unbanReader,
} from "./actions";

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
vi.mock("@/lib/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/settings")>()),
  getCommentSettings: vi.fn(),
}));
// Emails are covered in notifications.int.test.ts.
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  notifyCommentPublished: vi.fn(async () => {}),
  notifyCommentsPublished: vi.fn(async () => {}),
}));

const P = "int-mod";
type Person = { id: string; role: Role; emailVerified: boolean };
const person = (name: string, role: Role, emailVerified = true): Person => ({
  id: `${P}-${name}`,
  role,
  emailVerified,
});
const READER = person("reader", "reader");
const OTHER = person("other", "reader");
const THIRD = person("third", "reader");
const SPAMMER = person("spammer", "reader");
const UNVERIFIED = person("unverified", "reader", false);
const AUTHOR = person("author", "author");
const WRITER = person("writer", "author");
const EDITOR = person("editor", "editor");
const ADMIN = person("admin", "admin");
const PEOPLE = [
  READER,
  OTHER,
  THIRD,
  SPAMMER,
  UNVERIFIED,
  AUTHOR,
  WRITER,
  EDITOR,
  ADMIN,
];

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
    moderation: "none",
    blockedWords: ["casino"],
    linkLimit: 3,
    ...value,
  });
}

const ids = { live: crypto.randomUUID(), stats: crypto.randomUUID() };
const livePath = `/posts/${P}-live`;

async function post(body: string, parentId?: string) {
  const result = await postComment({ postId: ids.live, parentId, body });
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
        `app:report:${u.id}`,
      ]),
    ),
  );
}

async function cleanup() {
  await db.delete(posts).where(like(posts.slug, `${P}-%`));
  await clearLimits();
  await db.delete(user).where(like(user.id, `${P}-%`));
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
  const at = new Date(Date.now() - 86_400_000 * 90);
  await db.insert(posts).values([
    {
      id: ids.live,
      title: "Int moderation",
      slug: `${P}-live`,
      status: "published",
      publishedAt: at,
      authorId: AUTHOR.id,
    },
    {
      id: ids.stats,
      title: "Int stats",
      slug: `${P}-stats`,
      status: "published",
      publishedAt: at,
      authorId: WRITER.id,
    },
  ]);
});

beforeEach(async () => {
  settings();
  vi.mocked(revalidatePath).mockClear();
  await clearLimits();
});

afterAll(cleanup);

describe("what waits for review", () => {
  it("holds readers' comments with blocked words or many links", async () => {
    actAs(READER);
    const word = await post("Best CASINO bonus");
    expect(word.status).toBe("pending");
    expect(await row(word.id)).toMatchObject({
      heldReason: "blocked-word",
      heldDetail: "casino",
    });
    const links = await post(
      "https://a.example https://b.example https://c.example",
    );
    expect(await row(links.id)).toMatchObject({
      status: "pending",
      heldReason: "links",
      heldDetail: "3",
    });
    expect((await post("Just one: https://a.example")).status).toBe("approved");

    // The team is never held.
    actAs(AUTHOR);
    expect((await post("Casino night was fun")).status).toBe("approved");

    const queue = await getModerationQueue({ status: "pending", page: 1 });
    const held = Object.fromEntries(
      queue.rows
        .filter((r) => [word.id, links.id].includes(r.id))
        .map((r) => [r.id, r.held]),
    );
    expect(held).toEqual({
      [word.id]: "Contains “casino”",
      [links.id]: "3 links",
    });
  });

  it("sends an edited comment back when the new text breaks the rules", async () => {
    actAs(READER);
    const comment = await post("Nice post");
    expect(comment.status).toBe("approved");
    const edited = await editComment({ id: comment.id, body: "Nice casino" });
    expect(edited).toMatchObject({ ok: true, data: { status: "pending" } });
    expect(await row(comment.id)).toMatchObject({
      status: "pending",
      heldReason: "blocked-word",
    });
    expect(revalidatePath).toHaveBeenCalledWith(livePath);
  });
});

describe("reports", () => {
  let target: string;
  let reply: string;

  beforeAll(async () => {
    settings();
    await clearLimits();
    actAs(READER);
    target = (await post("A perfectly fine comment")).id;
    actAs(THIRD);
    reply = (await post("I agree", target)).id;
  });

  it("send a comment back to the queue, keeping its thread's place", async () => {
    actAs(OTHER);
    expect(await reportComment({ id: target, reason: "abuse" })).toEqual({
      ok: true,
      data: { hidden: true },
    });
    expect(await row(target)).toMatchObject({
      status: "pending",
      heldReason: "reported",
    });
    expect(revalidatePath).toHaveBeenCalledWith(livePath);

    const thread = await getPostThread(ids.live, AUTHOR.id);
    const placeholder = thread.comments.find((c) => c.id === target);
    expect(placeholder).toMatchObject({
      hidden: true,
      body: "",
      author: null,
    });
    expect(placeholder?.replies.map((r) => r.id)).toEqual([reply]);

    const queue = await getModerationQueue({ status: "pending", page: 1 });
    expect(queue.rows.find((r) => r.id === target)).toMatchObject({
      held: "Reported",
      reports: { count: 1, reasons: ["abuse"] },
    });
  });

  it("only come from other confirmed readers, about readers' published comments", async () => {
    actAs(EDITOR);
    await moderateComment(target, "approve");

    const attempt = (who: Person | null, id = target, reason = "spam") => {
      actAs(who);
      return reportComment({ id, reason });
    };
    expect(await attempt(null)).toMatchObject({ ok: false });
    expect(await attempt(UNVERIFIED)).toMatchObject({
      error: expect.stringMatching(/confirm your email/i),
    });
    expect(await attempt(READER)).toMatchObject({
      error: expect.stringMatching(/your own/),
    });
    expect(await attempt(OTHER, target, "boring")).toMatchObject({
      ok: false,
    });
    actAs(AUTHOR);
    const staffComment = await post("From the author");
    expect(await attempt(OTHER, staffComment.id)).toMatchObject({
      error: expect.stringMatching(/team/),
    });
  });

  it("are settled when a moderator keeps the comment", async () => {
    const open = await db
      .select({ resolvedAt: commentReports.resolvedAt })
      .from(commentReports)
      .where(eq(commentReports.commentId, target));
    expect(open).toEqual([{ resolvedAt: expect.any(Date) }]);
    expect(await row(target)).toMatchObject({ status: "approved" });

    // The same reader can't send it back again, but someone else can.
    actAs(OTHER);
    expect(await reportComment({ id: target, reason: "abuse" })).toMatchObject({
      error: expect.stringMatching(/already reported/),
    });
    actAs(THIRD);
    expect(await reportComment({ id: target, reason: "spam" })).toMatchObject({
      ok: true,
      data: { hidden: true },
    });
  });
});

describe("bulk decisions", () => {
  it("approve, mark spam, or delete several comments at once", async () => {
    settings({ moderation: "all" });
    actAs(READER);
    const a = await post("one");
    const b = await post("two");

    actAs(AUTHOR);
    expect((await moderateComments([a.id, b.id], "approve")).ok).toBe(false);

    actAs(EDITOR);
    expect(await moderateComments([a.id, b.id], "approve")).toEqual({
      ok: true,
      data: { changed: 2 },
    });
    expect((await row(a.id))?.status).toBe("approved");
    expect(revalidatePath).toHaveBeenCalledWith(livePath);

    expect(await moderateComments([a.id, b.id], "spam")).toMatchObject({
      data: { changed: 2 },
    });
    expect((await row(b.id))?.status).toBe("spam");
    expect(await moderateComments([a.id], "delete")).toMatchObject({
      data: { changed: 1 },
    });
    expect(await row(a.id)).toBeUndefined();

    expect((await moderateComments([], "spam")).ok).toBe(false);
    expect((await moderateComments(["nope"], "spam")).ok).toBe(false);
    expect((await moderateComments([b.id], "bogus")).ok).toBe(false);
  });

  it("empty the spam folder, keeping placeholders for spam with replies", async (ctx) => {
    // It empties the whole folder, so only run on a database whose spam is
    // all ours.
    const foreign = await db
      .select({ id: comments.id })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .where(
        and(
          eq(comments.status, "spam"),
          isNull(comments.deletedAt),
          not(like(posts.slug, `${P}-%`)),
        ),
      )
      .limit(1);
    if (foreign.length) ctx.skip();

    actAs(OTHER);
    const top = await post("Spammy top");
    const plain = await post("Plain spam");
    actAs(THIRD);
    const answer = await post("Please stop", top.id);
    actAs(EDITOR);
    await moderateComments([top.id, plain.id], "spam");

    const result = await deleteAllSpam();
    expect(result.ok && result.data.removed).toBeGreaterThanOrEqual(2);
    expect(await row(plain.id)).toBeUndefined();
    expect(await row(top.id)).toMatchObject({
      body: "",
      deletedAt: expect.any(Date),
    });
    const thread = await getPostThread(ids.live, AUTHOR.id);
    expect(thread.comments.find((c) => c.id === top.id)).toMatchObject({
      deleted: true,
      replies: [expect.objectContaining({ id: answer.id })],
    });
  });
});

describe("bans", () => {
  it("are for editors and admins, and only for readers", async () => {
    const ban = (userId: string) =>
      banReader({ userId, reason: "", hideComments: false });
    actAs(AUTHOR);
    expect((await ban(OTHER.id)).ok).toBe(false);
    actAs(EDITOR);
    expect(await ban(AUTHOR.id)).toMatchObject({
      error: expect.stringMatching(/Team members/),
    });
    expect(await ban(`${P}-nobody`)).toMatchObject({
      error: expect.stringMatching(/no longer exists/),
    });
  });

  it("sign the reader out and send their held comments to spam", async () => {
    settings({ moderation: "all" });
    actAs(OTHER);
    const held = await post("held one");
    settings();
    const shown = await post("published one");
    await db.insert(session).values({
      id: `${P}-session`,
      token: `${P}-token-${crypto.randomUUID()}`,
      userId: OTHER.id,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    actAs(EDITOR);
    expect(
      await banReader({
        userId: OTHER.id,
        reason: "Trolling",
        hideComments: false,
      }),
    ).toEqual({ ok: true, data: null });
    const [banned] = await db
      .select({ bannedAt: user.bannedAt, banReason: user.banReason })
      .from(user)
      .where(eq(user.id, OTHER.id));
    expect(banned).toMatchObject({
      bannedAt: expect.any(Date),
      banReason: "Trolling",
    });
    expect(
      await db.select().from(session).where(eq(session.userId, OTHER.id)),
    ).toEqual([]);
    expect((await row(held.id))?.status).toBe("spam");
    expect((await row(shown.id))?.status).toBe("approved");
    expect(
      await banReader({ userId: OTHER.id, reason: "", hideComments: false }),
    ).toMatchObject({ error: expect.stringMatching(/already banned/) });

    expect(await unbanReader(OTHER.id)).toEqual({ ok: true, data: null });
    expect(await unbanReader(OTHER.id)).toMatchObject({ ok: false });
  });

  it("can hide everything the reader wrote", async () => {
    actAs(THIRD);
    const comment = await post("third's comment");
    actAs(EDITOR);
    vi.mocked(revalidatePath).mockClear();
    await banReader({ userId: THIRD.id, reason: "", hideComments: true });
    expect((await row(comment.id))?.status).toBe("spam");
    expect(revalidatePath).toHaveBeenCalledWith(livePath);
    await unbanReader(THIRD.id);
  });

  it("come with spam in one click", async () => {
    actAs(SPAMMER);
    const first = await post("buy stuff");
    const second = await post("more stuff");
    actAs(AUTHOR);
    const staff = await post("From the team");

    actAs(EDITOR);
    expect(await spamAndBan(staff.id)).toMatchObject({
      error: expect.stringMatching(/Team members/),
    });
    expect(await spamAndBan(first.id)).toEqual({ ok: true, data: null });
    expect((await row(first.id))?.status).toBe("spam");
    expect((await row(second.id))?.status).toBe("spam");
    const [spammer] = await db
      .select({ banReason: user.banReason })
      .from(user)
      .where(eq(user.id, SPAMMER.id));
    expect(spammer?.banReason).toBe("Spam");

    const queue = await getModerationQueue({ status: "spam", page: 1 });
    expect(queue.rows.find((r) => r.id === first.id)?.author).toMatchObject({
      banned: true,
    });
  });
});

describe("weekly activity", () => {
  it("counts likes and published comments per 7 days, on your own posts", async () => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
    await db.insert(postLikes).values([
      { postId: ids.stats, userId: READER.id, createdAt: daysAgo(1) },
      { postId: ids.stats, userId: OTHER.id, createdAt: daysAgo(9) },
      { postId: ids.stats, userId: THIRD.id, createdAt: daysAgo(60) },
    ]);
    await db.insert(comments).values(
      [
        { days: 2, status: "approved" as const },
        { days: 16, status: "approved" as const },
        { days: 1, status: "pending" as const },
        { days: 3, status: "approved" as const, deletedAt: daysAgo(1) },
      ].map(({ days, ...rest }) => ({
        postId: ids.stats,
        authorId: READER.id,
        body: "stats",
        createdAt: daysAgo(days),
        ...rest,
      })),
    );

    actAs(WRITER);
    const mine = await getWeeklyActivity((await getSession())!);
    expect(mine.labels).toHaveLength(8);
    expect(mine.readers).toBeNull();
    expect(mine.likes).toEqual([0, 0, 0, 0, 0, 0, 1, 1]);
    expect(mine.comments).toEqual([0, 0, 0, 0, 0, 1, 0, 1]);

    // Admins see the whole site, including new readers.
    actAs(ADMIN);
    const site = await getWeeklyActivity((await getSession())!);
    expect(site.readers).toHaveLength(8);
    expect(site.likes.reduce((a, b) => a + b)).toBeGreaterThanOrEqual(2);
  });
});
