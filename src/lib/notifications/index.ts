import "server-only";

import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { siteConfig } from "@/config/site";
import { db } from "@/db";
import { comments, posts, user } from "@/db/schema";
import { env } from "@/env";
import { can, isRole, isStaff, ROLES } from "@/lib/auth/permissions";
import {
  commentReplyMessage,
  excerpt,
  moderationDigestMessage,
  newCommentMessage,
  sendEmail,
  type EmailContent,
} from "@/lib/email";
import { postPath } from "@/lib/posts/urls";
import { livePostWhere } from "@/lib/posts/visibility";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getSiteSettings } from "@/lib/settings";

import type { NotificationKind } from "./kinds";
import { createUnsubscribeToken, readUnsubscribeToken } from "./tokens";

export {
  NOTIFICATION_KINDS,
  NOTIFICATION_LABELS,
  type NotificationKind,
} from "./kinds";

/** Each kind of email and the user column that turns it on or off. */
const PREFERENCE = {
  replies: "notifyReplies",
  "post-comments": "notifyPostComments",
  digest: "notifyDigest",
} as const satisfies Record<NotificationKind, keyof typeof user.$inferSelect>;

const MODERATOR_ROLES = ROLES.filter((role) => can(role, "comment:moderate"));

/** Where an email's unsubscribe links point (the page, and one-click). */
export function unsubscribeLinks(userId: string, kind: NotificationKind) {
  const token = encodeURIComponent(
    createUnsubscribeToken(userId, kind, env.BETTER_AUTH_SECRET),
  );
  return {
    page: new URL(`/unsubscribe?token=${token}`, siteConfig.url).href,
    oneClick: new URL(`/api/unsubscribe?token=${token}`, siteConfig.url).href,
  };
}

export function readToken(token: string) {
  return readUnsubscribeToken(token, env.BETTER_AUTH_SECRET);
}

/** Turn one kind of email on or off. Returns false if the account is gone. */
export async function setNotification(
  userId: string,
  kind: NotificationKind,
  enabled: boolean,
) {
  const updated = await db
    .update(user)
    .set({ [PREFERENCE[kind]]: enabled })
    .where(eq(user.id, userId))
    .returning({ id: user.id });
  return updated.length > 0;
}

type Recipient = { id: string; name: string; email: string; role: string };

/** The person, if they want this kind of email and can receive it. */
async function recipient(userId: string, kind: NotificationKind) {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .where(
      and(
        eq(user.id, userId),
        eq(user.emailVerified, true),
        isNull(user.bannedAt),
        eq(user[PREFERENCE[kind]], true),
      ),
    );
  return row ?? null;
}

/** A busy thread can't flood anyone's inbox. */
const PER_HOUR = { max: 20, windowMs: 60 * 60_000 };

/** Send one notification; failures are logged, never thrown. */
async function deliver(
  to: Recipient,
  kind: NotificationKind,
  tag: string,
  content: (unsubscribeUrl: string) => EmailContent,
) {
  if (!(await consumeRateLimit(`notify:${to.id}`, PER_HOUR))) return false;
  const links = unsubscribeLinks(to.id, kind);
  try {
    await sendEmail({
      ...content(links.page),
      to: to.email,
      tag,
      // One-click unsubscribe from the mail client (RFC 8058).
      headers: {
        "List-Unsubscribe": `<${links.oneClick}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    return true;
  } catch (error) {
    console.error(`[notify] ${tag} to ${to.id} failed:`, error);
    return false;
  }
}

/**
 * Emails about a newly published comment: to the person it answers, and to
 * the post's author. Sent once, however often the comment is re-approved.
 */
export async function notifyCommentPublished(commentId: string) {
  // Claim it first, so two approvals at once can't both send.
  const [comment] = await db
    .update(comments)
    .set({ notifiedAt: new Date() })
    .where(
      and(
        eq(comments.id, commentId),
        eq(comments.status, "approved"),
        isNull(comments.deletedAt),
        isNull(comments.notifiedAt),
      ),
    )
    .returning({
      id: comments.id,
      body: comments.body,
      authorId: comments.authorId,
      postId: comments.postId,
      parentId: comments.parentId,
      replyToId: comments.replyToId,
    });
  if (!comment) return;
  const [post] = await db
    .select({ title: posts.title, slug: posts.slug, authorId: posts.authorId })
    .from(posts)
    .where(and(eq(posts.id, comment.postId), livePostWhere()));
  if (!post) return;

  const [commenter] = comment.authorId
    ? await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, comment.authorId))
    : [];
  const name = commenter?.name ?? "Someone";
  const site = await getSiteSettings();
  const url = new URL(
    `${postPath(post.slug)}#comment-${comment.id}`,
    siteConfig.url,
  ).href;
  // Nobody hears about their own comment, or twice about one.
  const done = new Set([comment.authorId]);

  const answeredId = comment.replyToId ?? comment.parentId;
  if (answeredId) {
    const [answered] = await db
      .select({ authorId: comments.authorId })
      .from(comments)
      .where(eq(comments.id, answeredId));
    const to =
      answered?.authorId && !done.has(answered.authorId)
        ? await recipient(answered.authorId, "replies")
        : null;
    if (to) {
      done.add(to.id);
      await deliver(to, "replies", "comment-reply", (unsubscribeUrl) =>
        commentReplyMessage({
          siteName: site.name,
          name: to.name,
          replierName: name,
          postTitle: post.title,
          reply: comment.body,
          url,
          unsubscribeUrl,
        }),
      );
    }
  }

  if (post.authorId && !done.has(post.authorId)) {
    const to = await recipient(post.authorId, "post-comments");
    if (to && isStaff(isRole(to.role) ? to.role : undefined)) {
      await deliver(to, "post-comments", "new-comment", (unsubscribeUrl) =>
        newCommentMessage({
          siteName: site.name,
          name: to.name,
          commenterName: name,
          postTitle: post.title,
          comment: comment.body,
          url,
          unsubscribeUrl,
        }),
      );
    }
  }
}

export async function notifyCommentsPublished(commentIds: string[]) {
  for (const id of commentIds) await notifyCommentPublished(id);
}

/**
 * The moderators' daily summary of comments waiting for review. Nothing is
 * sent while the queue is empty.
 */
export async function sendModerationDigest() {
  const waiting = and(
    eq(comments.status, "pending"),
    isNull(comments.deletedAt),
  );
  const [[total], newest] = await Promise.all([
    db.select({ value: count() }).from(comments).where(waiting),
    db
      .select({
        body: comments.body,
        authorName: user.name,
        postTitle: posts.title,
      })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .leftJoin(user, eq(user.id, comments.authorId))
      .where(waiting)
      .orderBy(desc(comments.createdAt))
      .limit(5),
  ]);
  const pending = total?.value ?? 0;
  if (!pending) return { pending, sent: 0 };

  const moderators = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .where(
      and(
        inArray(user.role, MODERATOR_ROLES),
        eq(user.emailVerified, true),
        isNull(user.bannedAt),
        eq(user.notifyDigest, true),
      ),
    );
  const site = await getSiteSettings();
  const items = newest.map(
    (c) =>
      `${c.authorName ?? "Deleted reader"} on “${c.postTitle}”: ${excerpt(c.body.replace(/\s+/g, " "), 100)}`,
  );
  const url = new URL("/admin/comments", siteConfig.url).href;
  let sent = 0;
  for (const to of moderators) {
    const ok = await deliver(
      to,
      "digest",
      "moderation-digest",
      (unsubscribeUrl) =>
        moderationDigestMessage({
          siteName: site.name,
          name: to.name,
          pending,
          items,
          url,
          unsubscribeUrl,
        }),
    );
    if (ok) sent++;
  }
  return { pending, sent };
}
