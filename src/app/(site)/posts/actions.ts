"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { FOREIGN_KEY_VIOLATION, pgError } from "@/db/errors";
import { comments, postLikes } from "@/db/schema";
import {
  fail,
  ok,
  zodFieldErrors,
  type ActionResult,
} from "@/lib/action-result";
import { can, isStaff } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import {
  canEditComment,
  commentBodySchema,
  initialCommentStatus,
  type ThreadComment,
} from "@/lib/comments";
import { removeComment } from "@/lib/comments/remove";
import {
  getCommentablePost,
  getCommentForAction,
  hasApprovedComment,
} from "@/lib/queries/comments";
import { getLikeState, type LikeState } from "@/lib/queries/likes";
import { consumeRateLimit } from "@/lib/rate-limit";
import { revalidatePost } from "@/lib/revalidate";
import { getCommentSettings } from "@/lib/settings";

const likeSchema = z.object({ postId: z.uuid(), liked: z.boolean() });

/**
 * Like or unlike a live post as the signed-in user (any role). Sets the
 * state rather than toggling it, so a double click can't flip it twice.
 * Public pages aren't revalidated: counts load in the browser.
 */
export async function setLike(
  postId: unknown,
  liked: unknown,
): Promise<ActionResult<LikeState>> {
  const session = await getSession();
  if (!session) return fail("Sign in to like posts.");
  const parsed = likeSchema.safeParse({ postId, liked });
  if (!parsed.success) return fail("Invalid request.");
  const userId = session.user.id;
  if (
    !(await consumeRateLimit(`like:${userId}`, { max: 30, windowMs: 60_000 }))
  ) {
    return fail("You're liking posts a little fast. Try again in a minute.");
  }
  if (!(await getLikeState(parsed.data.postId))) {
    return fail("This post isn't available.");
  }

  try {
    if (parsed.data.liked) {
      await db
        .insert(postLikes)
        .values({ postId: parsed.data.postId, userId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(postLikes)
        .where(
          and(
            eq(postLikes.postId, parsed.data.postId),
            eq(postLikes.userId, userId),
          ),
        );
    }
  } catch (error) {
    // The post was deleted in the meantime.
    if (pgError(error).code === FOREIGN_KEY_VIOLATION) {
      return fail("This post isn't available.");
    }
    throw error;
  }

  const state = await getLikeState(parsed.data.postId, userId);
  if (!state) return fail("This post isn't available.");
  return ok(state);
}

const COMMENT_LIMITS = {
  min: { max: 5, windowMs: 60_000 },
  day: { max: 50, windowMs: 24 * 60 * 60_000 },
};

/** Posting and editing share these per-person limits. */
async function underCommentLimits(
  userId: string,
  ...windows: ("min" | "day")[]
) {
  for (const window of windows) {
    const limit = COMMENT_LIMITS[window];
    if (!(await consumeRateLimit(`comment:${window}:${userId}`, limit))) {
      return false;
    }
  }
  return true;
}

const TOO_FAST = "You're commenting a little fast. Try again in a minute.";
const UNAVAILABLE = "That comment is no longer available.";

const commentSchema = z.object({
  postId: z.uuid(),
  /** Replying to this comment (a reply to a reply joins its thread). */
  parentId: z.uuid().nullable().optional(),
  body: commentBodySchema,
});

/**
 * Comment on a live post as the signed-in user. Readers need a confirmed
 * email address; whether the comment waits for a moderator depends on the
 * Settings (the team's comments never wait). Returns the comment as the
 * thread shows it, so the page can show it straight away.
 */
export async function postComment(
  raw: unknown,
): Promise<ActionResult<ThreadComment>> {
  const session = await getSession();
  if (!session) return fail("Sign in to comment.");
  const { user } = session;
  const staff = isStaff(user.role);
  if (!staff && !user.emailVerified) {
    return fail("Confirm your email address to comment.");
  }
  const parsed = commentSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Invalid comment.",
      zodFieldErrors(parsed.error),
    );
  }
  const input = parsed.data;

  const [settings, post] = await Promise.all([
    getCommentSettings(),
    getCommentablePost(input.postId),
  ]);
  if (!post) return fail("This post isn't available.");
  if (!settings.enabled || !post.commentsEnabled) {
    return fail("Comments are closed on this post.");
  }

  let parentId: string | null = null;
  if (input.parentId) {
    const parent = await getCommentForAction(input.parentId);
    if (
      !parent ||
      parent.postId !== post.id ||
      parent.status !== "approved" ||
      parent.deletedAt
    ) {
      return fail(UNAVAILABLE);
    }
    parentId = parent.parentId ?? parent.id;
  }

  if (!(await underCommentLimits(user.id, "min", "day"))) return fail(TOO_FAST);

  const status = initialCommentStatus({
    staff,
    mode: settings.moderation,
    hasApprovedComment:
      !staff &&
      settings.moderation === "first" &&
      (await hasApprovedComment(user.id)),
  });

  let created: typeof comments.$inferSelect;
  try {
    [created] = await db
      .insert(comments)
      .values({
        postId: post.id,
        authorId: user.id,
        parentId,
        body: input.body,
        status,
      })
      .returning();
  } catch (error) {
    // The post or the comment being answered was deleted meanwhile.
    if (pgError(error).code === FOREIGN_KEY_VIOLATION) return fail(UNAVAILABLE);
    throw error;
  }
  if (status === "approved") revalidatePost(post.slug);

  return ok({
    id: created!.id,
    parentId,
    body: created!.body,
    deleted: false,
    status,
    createdAt: created!.createdAt.toISOString(),
    editedAt: null,
    author: {
      id: user.id,
      name: user.name,
      image: user.image ?? null,
      badge: user.id === post.authorId ? "author" : staff ? "team" : null,
    },
    replies: [],
  });
}

const editSchema = z.object({ id: z.uuid(), body: commentBodySchema });

/** Change your own comment's text, for a while after posting it. */
export async function editComment(
  raw: unknown,
): Promise<ActionResult<{ body: string; editedAt: string }>> {
  const session = await getSession();
  if (!session) return fail("Sign in to edit comments.");
  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Invalid comment.",
      zodFieldErrors(parsed.error),
    );
  }
  const userId = session.user.id;
  const comment = await getCommentForAction(parsed.data.id);
  if (!comment || comment.deletedAt || !comment.post.live) {
    return fail(UNAVAILABLE);
  }
  if (comment.authorId !== userId) {
    return fail("You can only edit your own comments.");
  }
  if (!canEditComment(comment, userId)) {
    return fail("Comments can only be edited for an hour after posting.");
  }
  const settings = await getCommentSettings();
  if (!settings.enabled || !comment.post.commentsEnabled) {
    return fail("Comments are closed on this post.");
  }
  if (!(await underCommentLimits(userId, "min"))) return fail(TOO_FAST);

  const [row] = await db
    .update(comments)
    .set({ body: parsed.data.body, editedAt: new Date() })
    .where(and(eq(comments.id, comment.id), isNull(comments.deletedAt)))
    .returning({ body: comments.body, editedAt: comments.editedAt });
  if (!row?.editedAt) return fail(UNAVAILABLE);
  if (comment.status === "approved") revalidatePost(comment.post.slug);
  return ok({ body: row.body, editedAt: row.editedAt.toISOString() });
}

/**
 * Delete your own comment (moderators may delete anyone's). One with
 * replies leaves a "deleted" placeholder so the replies still make sense.
 */
export async function deleteComment(
  id: unknown,
): Promise<ActionResult<{ removed: "soft" | "hard" }>> {
  const session = await getSession();
  if (!session) return fail("Sign in to delete comments.");
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return fail("Invalid request.");
  const comment = await getCommentForAction(parsed.data);
  if (!comment || comment.deletedAt) return fail(UNAVAILABLE);
  if (
    comment.authorId !== session.user.id &&
    !can(session.user.role, "comment:moderate")
  ) {
    return fail("You can only delete your own comments.");
  }
  const removed = await removeComment(comment);
  if (comment.status === "approved") revalidatePost(comment.post.slug);
  return ok({ removed });
}
