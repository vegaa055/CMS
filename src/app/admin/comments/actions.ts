"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { comments } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { can } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { removeComment } from "@/lib/comments/remove";
import { getCommentForAction } from "@/lib/queries/comments";
import { revalidatePost } from "@/lib/revalidate";

export type ModerationAction = "approve" | "spam" | "delete";

const moderationSchema = z.object({
  id: z.uuid(),
  action: z.enum(["approve", "spam", "delete"]),
});

/** Approve, mark as spam, or delete any comment (admins and editors). */
export async function moderateComment(
  id: unknown,
  action: unknown,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session || !can(session.user.role, "comment:moderate")) {
    return fail("You don't have permission to moderate comments.");
  }
  const parsed = moderationSchema.safeParse({ id, action });
  if (!parsed.success) return fail("Invalid request.");
  const comment = await getCommentForAction(parsed.data.id);
  if (!comment || comment.deletedAt) {
    return fail("That comment is no longer available.");
  }

  if (parsed.data.action === "delete") {
    await removeComment(comment);
  } else {
    await db
      .update(comments)
      .set({ status: parsed.data.action === "approve" ? "approved" : "spam" })
      .where(eq(comments.id, comment.id));
  }

  // Only approved comments show on the post.
  if (comment.status === "approved" || parsed.data.action === "approve") {
    revalidatePost(comment.post.slug);
  }
  // The queue and the sidebar's pending count.
  revalidatePath("/admin", "layout");
  return ok(null);
}
