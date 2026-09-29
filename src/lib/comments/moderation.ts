import "server-only";

import { and, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { commentReports, comments, posts, session, user } from "@/db/schema";
import { runAfterResponse } from "@/lib/background";
import { notifyCommentsPublished } from "@/lib/notifications";
import { getCommentedPostSlugs } from "@/lib/queries/comments";
import { revalidatePost } from "@/lib/revalidate";

import { removeComment } from "./remove";

export type ModerationAction = "approve" | "spam" | "delete";

/** Reports are closed once a moderator has decided (and kept, see schema). */
async function resolveReports(commentIds: string[]) {
  if (!commentIds.length) return;
  await db
    .update(commentReports)
    .set({ resolvedAt: new Date() })
    .where(
      and(
        inArray(commentReports.commentId, commentIds),
        isNull(commentReports.resolvedAt),
      ),
    );
}

/**
 * A moderator's decision on some comments. Their reports are closed, the
 * posts that showed (or now show) them are refreshed, and newly published
 * ones send their notifications. Returns how many were changed.
 */
export async function moderateComments(
  ids: string[],
  action: ModerationAction,
) {
  if (!ids.length) return 0;
  const targets = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      status: comments.status,
      slug: posts.slug,
    })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(and(inArray(comments.id, ids), isNull(comments.deletedAt)));
  if (!targets.length) return 0;
  const targetIds = targets.map((t) => t.id);

  if (action === "delete") {
    for (const target of targets) await removeComment(target);
  } else {
    await db
      .update(comments)
      .set({ status: action === "approve" ? "approved" : "spam" })
      .where(inArray(comments.id, targetIds));
  }
  await resolveReports(targetIds);

  const shown = targets.filter(
    (t) => t.status === "approved" || action === "approve",
  );
  for (const slug of new Set(shown.map((t) => t.slug))) revalidatePost(slug);
  if (action === "approve") {
    const published = targets.filter((t) => t.status !== "approved");
    runAfterResponse(notifyCommentsPublished(published.map((t) => t.id)));
  }
  return targets.length;
}

/**
 * Empty the spam folder. Spam that has published replies keeps its
 * placeholder, like any deleted comment. Returns how many were removed.
 */
export async function deleteAllSpam() {
  // Posts whose threads show a spam comment's placeholder.
  const shown = await db.execute<{ slug: string }>(sql`
    select distinct p.slug from comments c
    join posts p on p.id = c.post_id
    where c.status = 'spam' and c.deleted_at is null
      and exists (select 1 from comments r where r.parent_id = c.id and r.status = 'approved')`);
  const removed = await db.execute<{ id: string }>(sql`
    delete from comments c
    where c.status = 'spam' and c.deleted_at is null
      and not exists (select 1 from comments r where r.parent_id = c.id)
    returning c.id`);
  const kept = await db
    .update(comments)
    .set({ body: "", deletedAt: new Date() })
    .where(and(eq(comments.status, "spam"), isNull(comments.deletedAt)))
    .returning({ id: comments.id });
  for (const { slug } of shown.rows) revalidatePost(slug);
  return removed.rows.length + kept.length;
}

/**
 * Ban a reader: they're signed out everywhere and can't sign in or comment
 * until unbanned. Their comments waiting for review go to spam, and with
 * `hideComments` so do their published ones. The team can't be banned.
 * Returns false if there's no such reader, or they're already banned.
 */
export async function banReader(
  userId: string,
  { reason, hideComments }: { reason: string | null; hideComments: boolean },
) {
  const [banned] = await db
    .update(user)
    .set({ bannedAt: new Date(), banReason: reason })
    .where(
      and(eq(user.id, userId), eq(user.role, "reader"), isNull(user.bannedAt)),
    )
    .returning({ id: user.id });
  if (!banned) return false;
  await db.delete(session).where(eq(session.userId, userId));

  const shownOn = hideComments ? await getCommentedPostSlugs(userId) : [];
  const hidden = await db
    .update(comments)
    .set({ status: "spam" })
    .where(
      and(
        eq(comments.authorId, userId),
        isNull(comments.deletedAt),
        hideComments
          ? ne(comments.status, "spam")
          : eq(comments.status, "pending"),
      ),
    )
    .returning({ id: comments.id });
  await resolveReports(hidden.map((c) => c.id));
  for (const slug of shownOn) revalidatePost(slug);
  return true;
}

/** Lift a ban. Their comments stay where moderation left them. */
export async function unbanReader(userId: string) {
  const updated = await db
    .update(user)
    .set({ bannedAt: null, banReason: null })
    .where(and(eq(user.id, userId), isNotNull(user.bannedAt)))
    .returning({ id: user.id });
  return updated.length > 0;
}
