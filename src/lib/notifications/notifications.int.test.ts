/**
 * Notification emails against the real database, with sending captured:
 * who hears about a published comment (and only once), preferences,
 * unconfirmed and banned addresses, unsubscribing (page and one-click), the
 * moderators' digest, and the cron route's secret. Only touches
 * `int-note-*` rows. Run with `npm run test:int`.
 */
import { eq, like } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { unsubscribe } from "@/app/(site)/unsubscribe/actions";
import { GET as cronDigest } from "@/app/api/cron/comment-digest/route";
import {
  GET as unsubscribeGet,
  POST as unsubscribePost,
} from "@/app/api/unsubscribe/route";
import { db } from "@/db";
import { comments, posts, user } from "@/db/schema";
import type { EmailMessage } from "@/lib/email";
import type { Role } from "@/lib/auth/permissions";

import { notifyCommentPublished, sendModerationDigest } from "./index";

const sent: EmailMessage[] = [];
const { CRON_SECRET } = vi.hoisted(() => ({
  CRON_SECRET: "cron-secret-for-int-tests",
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendEmail: vi.fn(async (message: EmailMessage) => {
    sent.push(message);
  }),
}));
// The digest goes to every moderator in the database: count nothing
// against real people's limits.
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: async () => true }));
vi.mock("@/env", async (importOriginal) => {
  const { env } = await importOriginal<typeof import("@/env")>();
  return { env: { ...env, CRON_SECRET } };
});

const P = "int-note";
type Person = {
  id: string;
  role: Role;
  emailVerified?: boolean;
  notifyReplies?: boolean;
  notifyDigest?: boolean;
  bannedAt?: Date;
};
const person = (name: string, role: Role, extra: Partial<Person> = {}) => ({
  id: `${P}-${name}`,
  role,
  emailVerified: true,
  ...extra,
});
const WRITER = person("writer", "author");
const READER = person("reader", "reader");
const OTHER = person("other", "reader");
const QUIET = person("quiet", "reader", { notifyReplies: false });
const UNCONFIRMED = person("unconfirmed", "reader", { emailVerified: false });
const BANNED = person("banned", "reader", { bannedAt: new Date() });
const EDITOR = person("editor", "editor");
const MUTED = person("muted", "editor", { notifyDigest: false });
const PEOPLE = [
  WRITER,
  READER,
  OTHER,
  QUIET,
  UNCONFIRMED,
  BANNED,
  EDITOR,
  MUTED,
];
const emailOf = (p: { id: string }) => `${p.id}@folio.local`;

const postId = crypto.randomUUID();

async function comment(
  author: { id: string },
  {
    answering,
    status = "approved",
  }: {
    answering?: { id: string; parentId: string | null };
    status?: "approved" | "pending";
  } = {},
) {
  const [row] = await db
    .insert(comments)
    .values({
      postId,
      authorId: author.id,
      parentId: answering ? (answering.parentId ?? answering.id) : null,
      replyToId: answering?.id ?? null,
      body: `Words from ${author.id}`,
      status,
    })
    .returning({ id: comments.id, parentId: comments.parentId });
  return row!;
}

/** What we sent to our own people (the digest also reaches real moderators). */
const ours = () =>
  sent
    .filter((m) => m.to.startsWith(`${P}-`))
    .map((m) => ({ to: m.to, tag: m.tag }));

async function cleanup() {
  await db.delete(posts).where(like(posts.slug, `${P}-%`));
  await db.delete(user).where(like(user.id, `${P}-%`));
}

beforeAll(async () => {
  await cleanup();
  await db
    .insert(user)
    .values(
      PEOPLE.map((p) => ({ ...p, name: `Name ${p.id}`, email: emailOf(p) })),
    );
  await db.insert(posts).values({
    id: postId,
    title: "Int notifications",
    slug: `${P}-post`,
    status: "published",
    publishedAt: new Date(Date.now() - 86_400_000),
    authorId: WRITER.id,
  });
});

beforeEach(() => {
  sent.length = 0;
});

afterAll(cleanup);

describe("a published comment", () => {
  it("tells the post's author, once", async () => {
    const first = await comment(READER);
    await notifyCommentPublished(first.id);
    expect(ours()).toEqual([{ to: emailOf(WRITER), tag: "new-comment" }]);
    const [mail] = sent;
    expect(mail!.subject).toBe("New comment on “Int notifications”");
    expect(mail!.text).toContain(`#comment-${first.id}`);
    expect(mail!.headers).toMatchObject({
      "List-Unsubscribe": expect.stringMatching(
        /^<https?:\/\/.+\/api\/unsubscribe\?token=/,
      ),
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });

    await notifyCommentPublished(first.id);
    expect(ours()).toHaveLength(1);
  });

  it("tells the person it answers, but nobody about their own words", async () => {
    const top = await comment(READER);
    await notifyCommentPublished(top.id);
    sent.length = 0;

    const reply = await comment(OTHER, { answering: top });
    await notifyCommentPublished(reply.id);
    expect(ours()).toEqual([
      { to: emailOf(READER), tag: "comment-reply" },
      { to: emailOf(WRITER), tag: "new-comment" },
    ]);
    expect(sent[0]!.subject).toBe(
      `Name ${OTHER.id} replied to your comment on “Int notifications”`,
    );

    // The post's author answering a reply: only the reply's author hears.
    sent.length = 0;
    const answer = await comment(WRITER, { answering: reply });
    await notifyCommentPublished(answer.id);
    expect(ours()).toEqual([{ to: emailOf(OTHER), tag: "comment-reply" }]);
  });

  it("skips people who opted out, haven't confirmed, or are banned", async () => {
    for (const author of [QUIET, UNCONFIRMED, BANNED]) {
      const theirs = await comment(author);
      sent.length = 0;
      const reply = await comment(OTHER, { answering: theirs });
      await notifyCommentPublished(reply.id);
      expect(ours()).toEqual([{ to: emailOf(WRITER), tag: "new-comment" }]);
    }

    // Nothing goes out until a comment is published.
    sent.length = 0;
    const waiting = await comment(READER, { status: "pending" });
    await notifyCommentPublished(waiting.id);
    expect(ours()).toEqual([]);
  });
});

describe("unsubscribing", () => {
  async function replyEmailFor(target: typeof READER) {
    const theirs = await comment(target);
    const reply = await comment(OTHER, { answering: theirs });
    sent.length = 0;
    await notifyCommentPublished(reply.id);
    return sent.find(
      (m) => m.to === emailOf(target) && m.tag === "comment-reply",
    )!;
  }

  const preference = async (id: string) =>
    (
      await db
        .select({
          replies: user.notifyReplies,
          postComments: user.notifyPostComments,
        })
        .from(user)
        .where(eq(user.id, id))
    )[0];

  it("works from the email's link, without signing in", async () => {
    const mail = await replyEmailFor(READER);
    const page = mail.text.match(/Unsubscribe: (\S+)/)![1]!;
    const token = new URL(page).searchParams.get("token")!;
    expect(await unsubscribe(token)).toEqual({ ok: true, data: null });
    expect(await preference(READER.id)).toMatchObject({ replies: false });
    expect(await replyEmailFor(READER)).toBeUndefined();

    expect((await unsubscribe(`${token}x`)).ok).toBe(false);
    expect((await unsubscribe("nonsense")).ok).toBe(false);
  });

  it("works in one click from the mail client", async () => {
    const theirs = await comment(OTHER);
    await notifyCommentPublished(theirs.id);
    const mail = sent.find((m) => m.to === emailOf(WRITER))!;
    const url = mail.headers!["List-Unsubscribe"]!.slice(1, -1);

    // A plain visit is sent to the page with the button.
    const visit = await unsubscribeGet(new Request(url));
    expect(visit.status).toBe(303);
    expect(visit.headers.get("location")).toContain("/unsubscribe?token=");
    expect(await preference(WRITER.id)).toMatchObject({ postComments: true });

    const click = await unsubscribePost(
      new Request(url, { method: "POST", body: "List-Unsubscribe=One-Click" }),
    );
    expect(click.status).toBe(200);
    expect(await preference(WRITER.id)).toMatchObject({ postComments: false });

    const forged = await unsubscribePost(
      new Request(url.replace(/token=[^&]+/, "token=abc.def"), {
        method: "POST",
      }),
    );
    expect(forged.status).toBe(400);
  });
});

describe("the moderators' digest", () => {
  it("summarizes waiting comments for moderators who want it", async () => {
    await comment(OTHER, { status: "pending" });
    const result = await sendModerationDigest();
    expect(result.pending).toBeGreaterThanOrEqual(1);
    const digests = sent.filter((m) => m.tag === "moderation-digest");
    const mine = digests.find((m) => m.to === emailOf(EDITOR));
    expect(mine?.text).toContain(`Name ${OTHER.id} on “Int notifications”`);
    expect(mine?.text).toContain("/admin/comments");
    expect(digests.some((m) => m.to === emailOf(MUTED))).toBe(false);
    // Readers and authors never get it.
    expect(digests.some((m) => m.to === emailOf(WRITER))).toBe(false);
  });

  it("only runs for Vercel Cron's secret", async () => {
    const call = (authorization?: string) =>
      cronDigest(
        new Request("http://localhost/api/cron/comment-digest", {
          headers: authorization ? { authorization } : {},
        }),
      );
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    const ok = await call(`Bearer ${CRON_SECRET}`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ pending: expect.any(Number) });
  });
});
