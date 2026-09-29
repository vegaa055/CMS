import "server-only";

import { and, eq, isNotNull, notExists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { comments } from "@/db/schema";

const replies = alias(comments, "replies");

const withoutReplies = (id: string) =>
  notExists(
    db.select({ id: replies.id }).from(replies).where(eq(replies.parentId, id)),
  );

/**
 * Delete a comment. One with replies stays as a "deleted" placeholder (its
 * text removed) so the conversation still reads; a placeholder goes too once
 * its last reply does. Each step is a single statement, so a reply arriving
 * at the same moment either keeps the placeholder or fails (its parent gone).
 */
export async function removeComment(comment: {
  id: string;
  parentId: string | null;
}): Promise<"soft" | "hard"> {
  const deleted = await db
    .delete(comments)
    .where(and(eq(comments.id, comment.id), withoutReplies(comment.id)))
    .returning({ id: comments.id });
  if (!deleted.length) {
    await db
      .update(comments)
      .set({ body: "", deletedAt: new Date() })
      .where(eq(comments.id, comment.id));
    return "soft";
  }
  if (comment.parentId) {
    await db
      .delete(comments)
      .where(
        and(
          eq(comments.id, comment.parentId),
          isNotNull(comments.deletedAt),
          withoutReplies(comment.parentId),
        ),
      );
  }
  return "hard";
}
