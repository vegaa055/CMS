import "server-only";

import { and, desc, eq, isNotNull, lte } from "drizzle-orm";

import { db } from "@/db";
import { posts } from "@/db/schema";

/** Published posts, newest first, with author and tags. */
export async function getPublishedPosts({ limit = 10 } = {}) {
  return db.query.posts.findMany({
    where: and(
      eq(posts.status, "published"),
      isNotNull(posts.publishedAt),
      lte(posts.publishedAt, new Date()),
    ),
    orderBy: desc(posts.publishedAt),
    limit,
    columns: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
    },
    with: {
      author: { columns: { name: true } },
      postTags: { with: { tag: { columns: { name: true, slug: true } } } },
    },
  });
}

export type PublishedPostSummary = Awaited<
  ReturnType<typeof getPublishedPosts>
>[number];
