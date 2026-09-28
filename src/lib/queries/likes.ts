import "server-only";

import { and, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { postLikes, posts } from "@/db/schema";
import { livePostWhere } from "@/lib/posts/visibility";

/**
 * A live post's like total and whether `userId` likes it (`null` when
 * signed out), or undefined if the post isn't live. Likes are private:
 * callers only ever get totals and the viewer's own state.
 */
export async function getLikeState(postId: string, userId?: string) {
  const [row] = await db
    .select({
      count: count(postLikes.userId),
      liked: userId
        ? sql<boolean>`coalesce(bool_or(${postLikes.userId} = ${userId}), false)`
        : sql<null>`null`,
    })
    .from(posts)
    .leftJoin(postLikes, eq(postLikes.postId, posts.id))
    .where(and(eq(posts.id, postId), livePostWhere()))
    .groupBy(posts.id);
  if (!row) return undefined;
  return { count: row.count, liked: userId ? Boolean(row.liked) : null };
}

export type LikeState = NonNullable<Awaited<ReturnType<typeof getLikeState>>>;

/** Like totals for these posts (missing ids have none). */
export async function getLikeCounts(postIds: string[]) {
  if (!postIds.length) return new Map<string, number>();
  const rows = await db
    .select({ postId: postLikes.postId, count: count() })
    .from(postLikes)
    .where(inArray(postLikes.postId, postIds))
    .groupBy(postLikes.postId);
  return new Map(rows.map((r) => [r.postId, r.count]));
}

export const LIKED_PER_PAGE = 20;

/** Someone's liked posts that are still live, most recently liked first. */
export async function getLikedPosts(userId: string, page = 1) {
  const where = and(eq(postLikes.userId, userId), livePostWhere());
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        excerpt: posts.excerpt,
        publishedAt: posts.publishedAt,
        likedAt: postLikes.createdAt,
      })
      .from(postLikes)
      .innerJoin(posts, eq(posts.id, postLikes.postId))
      .where(where)
      .orderBy(desc(postLikes.createdAt), desc(posts.id))
      .limit(LIKED_PER_PAGE)
      .offset((page - 1) * LIKED_PER_PAGE),
    db
      .select({ value: count() })
      .from(postLikes)
      .innerJoin(posts, eq(posts.id, postLikes.postId))
      .where(where),
  ]);
  const totalCount = total?.value ?? 0;
  return {
    posts: rows.map((r) => ({
      ...r,
      publishedAt: r.publishedAt!.toISOString(),
      likedAt: r.likedAt.toISOString(),
    })),
    total: totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / LIKED_PER_PAGE)),
  };
}

/** Live posts with the most likes, optionally within a scope (an author's posts). */
export async function getMostLiked({
  scope,
  limit = 5,
}: {
  scope?: SQL;
  limit?: number;
} = {}) {
  return db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      likes: count(postLikes.userId),
    })
    .from(posts)
    .innerJoin(postLikes, eq(postLikes.postId, posts.id))
    .where(and(livePostWhere(), scope))
    .groupBy(posts.id)
    .orderBy(desc(count(postLikes.userId)), desc(posts.publishedAt))
    .limit(limit);
}
