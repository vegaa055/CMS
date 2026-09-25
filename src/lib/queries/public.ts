import "server-only";

import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import { posts, postTags, tags } from "@/db/schema";
import { summarize } from "@/lib/posts/excerpt";
import { readingTime } from "@/lib/posts/status";
import { livePostWhere } from "@/lib/posts/visibility";

/**
 * Read models for the public site. Every query is restricted to live posts
 * via `livePostWhere()`; nothing here should ever expose drafts.
 */

export const POSTS_PER_PAGE = 10;

const wordCount = sql<number>`coalesce(array_length(regexp_split_to_array(nullif(trim(${posts.contentText}), ''), '\\s+'), 1), 0)`;
const textPreview = sql<string>`left(${posts.contentText}, 400)`;

const summaryQuery = {
  columns: {
    id: true,
    title: true,
    slug: true,
    excerpt: true,
    publishedAt: true,
    updatedAt: true,
  },
  extras: {
    wordCount: wordCount.as("word_count"),
    textPreview: textPreview.as("text_preview"),
  },
  with: {
    author: { columns: { name: true } },
    coverImage: { columns: { url: true, alt: true } },
    postTags: { with: { tag: { columns: { name: true, slug: true } } } },
  },
} as const;

type SummaryRow = Awaited<
  ReturnType<typeof db.query.posts.findMany<typeof summaryQuery>>
>[number];

export type PostSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: Date;
  readingTime: number;
  author: string | null;
  cover: { url: string; alt: string | null } | null;
  tags: { name: string; slug: string }[];
};

function toSummary(row: SummaryRow): PostSummary {
  return {
    id: row.id,
    title: row.title || "Untitled",
    slug: row.slug,
    excerpt: row.excerpt || summarize(row.textPreview),
    publishedAt: row.publishedAt!,
    readingTime: readingTime(Number(row.wordCount)),
    author: row.author?.name ?? null,
    cover: row.coverImage,
    tags: row.postTags.map((pt) => pt.tag),
  };
}

/** Subquery: ids of posts carrying the tag with this slug. */
function postsWithTag(tagSlug: string) {
  return db
    .select({ id: postTags.postId })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(tags.slug, tagSlug));
}

export async function getLivePosts({
  page = 1,
  perPage = POSTS_PER_PAGE,
  tagSlug,
}: { page?: number; perPage?: number; tagSlug?: string } = {}) {
  const where = and(
    livePostWhere(),
    tagSlug ? inArray(posts.id, postsWithTag(tagSlug)) : undefined,
  );
  const [rows, [total]] = await Promise.all([
    db.query.posts.findMany({
      ...summaryQuery,
      where,
      orderBy: [desc(posts.publishedAt), desc(posts.id)],
      limit: perPage,
      offset: (page - 1) * perPage,
    }),
    db.select({ value: count() }).from(posts).where(where),
  ]);
  const totalCount = total?.value ?? 0;
  return {
    posts: rows.map(toSummary),
    total: totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / perPage)),
  };
}

/** A live post by slug with everything needed to render its page. */
export async function getLivePostBySlug(slug: string) {
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.slug, slug), livePostWhere()),
    columns: { searchVector: false },
    with: {
      author: { columns: { name: true, image: true } },
      coverImage: {
        columns: { url: true, alt: true, width: true, height: true },
      },
      postTags: {
        with: { tag: { columns: { id: true, name: true, slug: true } } },
      },
    },
  });
  if (!post) return undefined;
  return {
    ...post,
    description:
      post.seoDescription || post.excerpt || summarize(post.contentText, 160),
  };
}

export type LivePost = NonNullable<
  Awaited<ReturnType<typeof getLivePostBySlug>>
>;

/** The chronologically previous (older) and next (newer) live posts. */
export async function getAdjacentPosts(post: {
  id: string;
  publishedAt: Date;
}) {
  const pick = { title: posts.title, slug: posts.slug };
  const [older, newer] = await Promise.all([
    db
      .select(pick)
      .from(posts)
      .where(
        and(
          livePostWhere(),
          or(
            lt(posts.publishedAt, post.publishedAt),
            and(eq(posts.publishedAt, post.publishedAt), lt(posts.id, post.id)),
          ),
        ),
      )
      .orderBy(desc(posts.publishedAt), desc(posts.id))
      .limit(1),
    db
      .select(pick)
      .from(posts)
      .where(
        and(
          livePostWhere(),
          or(
            gt(posts.publishedAt, post.publishedAt),
            and(eq(posts.publishedAt, post.publishedAt), gt(posts.id, post.id)),
          ),
        ),
      )
      .orderBy(posts.publishedAt, posts.id)
      .limit(1),
  ]);
  return { older: older[0] ?? null, newer: newer[0] ?? null };
}

/** Live posts sharing the most tags with this one. */
export async function getRelatedPosts(
  postId: string,
  tagIds: string[],
  limit = 3,
) {
  if (!tagIds.length) return [];
  const shared = db
    .select({
      postId: postTags.postId,
      score: sql<number>`count(*)`.as("score"),
    })
    .from(postTags)
    .where(and(inArray(postTags.tagId, tagIds), ne(postTags.postId, postId)))
    .groupBy(postTags.postId)
    .as("shared");

  const ranked = await db
    .select({ id: posts.id })
    .from(posts)
    .innerJoin(shared, eq(shared.postId, posts.id))
    .where(livePostWhere())
    .orderBy(desc(shared.score), desc(posts.publishedAt))
    .limit(limit);
  if (!ranked.length) return [];

  const rows = await db.query.posts.findMany({
    ...summaryQuery,
    where: inArray(
      posts.id,
      ranked.map((r) => r.id),
    ),
  });
  const order = new Map(ranked.map((r, i) => [r.id, i]));
  return rows
    .map(toSummary)
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

/** Tags that have at least one live post, most used first. */
export async function getLiveTags() {
  return db
    .select({
      name: tags.name,
      slug: tags.slug,
      postCount: sql<number>`count(${posts.id})::int`,
    })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, eq(posts.id, postTags.postId))
    .where(livePostWhere())
    .groupBy(tags.id)
    .orderBy(desc(sql`count(${posts.id})`), tags.name);
}

export async function getTagBySlug(slug: string) {
  const [tag] = await db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(tags)
    .where(eq(tags.slug, slug));
  return tag;
}

/** Slugs and timestamps of every live post (sitemap, static params). */
export async function getLivePostSlugs() {
  return db
    .select({ slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(livePostWhere())
    .orderBy(desc(posts.publishedAt));
}

// Snippet delimiters that can't appear in normal text, so highlighted
// snippets are rendered as React elements instead of raw HTML.
export const HIGHLIGHT_START = "\u0001";
export const HIGHLIGHT_END = "\u0002";

export type SearchResult = PostSummary & { snippet: string };

/** Full-text search over live posts, ranked, with highlighted snippets. */
export async function searchPosts(
  query: string,
  limit = 20,
): Promise<SearchResult[]> {
  const q = query.trim().slice(0, 200);
  if (!q) return [];
  const tsQuery = sql`websearch_to_tsquery('english', ${q})`;

  const ranked = await db
    .select({
      id: posts.id,
      snippet: sql<string>`ts_headline('english', ${posts.contentText}, ${tsQuery}, ${`StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_END}, MaxWords=30, MinWords=12, MaxFragments=2, FragmentDelimiter= … `})`,
    })
    .from(posts)
    .where(and(livePostWhere(), sql`${posts.searchVector} @@ ${tsQuery}`))
    .orderBy(desc(sql`ts_rank(${posts.searchVector}, ${tsQuery})`))
    .limit(limit);
  if (!ranked.length) return [];

  const rows = await db.query.posts.findMany({
    ...summaryQuery,
    where: inArray(
      posts.id,
      ranked.map((r) => r.id),
    ),
  });
  const byId = new Map(rows.map((r) => [r.id, toSummary(r)]));
  return ranked
    .filter((r) => byId.has(r.id))
    .map((r) => ({ ...byId.get(r.id)!, snippet: r.snippet }));
}
