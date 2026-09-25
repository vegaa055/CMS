import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { posts } from "@/db/schema";
import { livePostWhere } from "@/lib/posts/visibility";

/** Published posts, newest first, with author and tags. */
export async function getPublishedPosts({ limit = 10 } = {}) {
  return db.query.posts.findMany({
    where: livePostWhere(),
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

/** Any post by id with the fields needed to render it. Callers must authorize. */
export async function getPostById(id: string) {
  return db.query.posts.findFirst({
    where: eq(posts.id, id),
    columns: { searchVector: false },
    with: {
      author: { columns: { name: true, image: true } },
      postTags: { with: { tag: { columns: { name: true, slug: true } } } },
    },
  });
}

export type RenderablePost = NonNullable<
  Awaited<ReturnType<typeof getPostById>>
>;
