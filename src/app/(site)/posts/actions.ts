"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { FOREIGN_KEY_VIOLATION, pgError } from "@/db/errors";
import { postLikes } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getSession } from "@/lib/auth/session";
import { getLikeState, type LikeState } from "@/lib/queries/likes";
import { consumeRateLimit } from "@/lib/rate-limit";

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
