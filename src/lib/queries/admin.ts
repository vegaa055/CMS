import "server-only";

import { count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { media, posts, postTags, tags, user } from "@/db/schema";
import { can, canDeletePost, canEditPost } from "@/lib/auth/permissions";
import type { AppSession } from "@/lib/auth/session";
import { effectiveStatus, type PostStatus } from "@/lib/posts/status";

/** Stored status, with past-due scheduled posts counted as published. */
const effectiveStatusSql = sql<PostStatus>`case when ${posts.status} = 'scheduled' and ${posts.publishedAt} <= now() then 'published' else ${posts.status}::text end`;

/**
 * Post visibility in the dashboard: editors/admins see everything, authors
 * see only their own posts.
 */
function postScope(session: AppSession) {
  return can(session.user.role, "post:update:any")
    ? undefined
    : eq(posts.authorId, session.user.id);
}

export async function getDashboardStats(session: AppSession) {
  const scope = postScope(session);
  const [statusCounts, [mediaCount], [tagCount], [userCount]] =
    await Promise.all([
      db
        .select({ status: effectiveStatusSql, count: count() })
        .from(posts)
        .where(scope)
        .groupBy(effectiveStatusSql),
      db.select({ count: count() }).from(media),
      db.select({ count: count() }).from(tags),
      db.select({ count: count() }).from(user),
    ]);

  const byStatus = Object.fromEntries(
    statusCounts.map((r) => [r.status, r.count]),
  ) as Partial<Record<PostStatus, number>>;

  return {
    published: byStatus.published ?? 0,
    drafts: byStatus.draft ?? 0,
    scheduled: byStatus.scheduled ?? 0,
    media: mediaCount?.count ?? 0,
    tags: tagCount?.count ?? 0,
    users: userCount?.count ?? 0,
  };
}

export async function getRecentPosts(session: AppSession, limit = 5) {
  const rows = await db.query.posts.findMany({
    where: postScope(session),
    orderBy: desc(posts.updatedAt),
    limit,
    columns: {
      id: true,
      title: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
    },
    with: { author: { columns: { name: true } } },
  });
  return rows.map((p) => ({
    ...p,
    status: effectiveStatus(p.status, p.publishedAt),
  }));
}

/** Rows for the admin posts table (serializable for the client table). */
export async function getAdminPosts(session: AppSession) {
  const rows = await db.query.posts.findMany({
    where: postScope(session),
    orderBy: desc(posts.updatedAt),
    columns: {
      id: true,
      title: true,
      slug: true,
      status: true,
      authorId: true,
      publishedAt: true,
      updatedAt: true,
    },
    with: {
      author: { columns: { name: true } },
      postTags: { with: { tag: { columns: { name: true } } } },
    },
  });
  return rows.map(({ postTags: pt, author, authorId, ...p }) => {
    const status = effectiveStatus(p.status, p.publishedAt);
    const ref = { authorId, status };
    return {
      ...p,
      status,
      canEdit: canEditPost(session.user, ref),
      canDelete: canDeletePost(session.user, ref),
      author: author?.name ?? null,
      tags: pt.map((t) => t.tag.name),
      publishedAt: p.publishedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
    };
  });
}

export type AdminPostRow = Awaited<ReturnType<typeof getAdminPosts>>[number];

export async function getAdminTags() {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      createdAt: tags.createdAt,
      postCount: sql<number>`count(${postTags.postId})::int`,
    })
    .from(tags)
    .leftJoin(postTags, eq(postTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(tags.name);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export type AdminTagRow = Awaited<ReturnType<typeof getAdminTags>>[number];

export async function getAdminUsers() {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
      postCount: sql<number>`count(${posts.id})::int`,
    })
    .from(user)
    .leftJoin(posts, eq(posts.authorId, user.id))
    .groupBy(user.id)
    .orderBy(user.createdAt);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export type AdminUserRow = Awaited<ReturnType<typeof getAdminUsers>>[number];

/** Full post for the editor, or undefined. Callers must authorize. */
export async function getPostForEdit(id: string) {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    columns: { searchVector: false, contentText: false },
    with: {
      postTags: { with: { tag: { columns: { name: true } } } },
      coverImage: { columns: { id: true, url: true, alt: true } },
    },
  });
  if (!post) return undefined;
  const { postTags: pt, ...rest } = post;
  return {
    ...rest,
    status: effectiveStatus(rest.status, rest.publishedAt),
    tags: pt.map((t) => t.tag.name),
  };
}

export type PostForEdit = NonNullable<
  Awaited<ReturnType<typeof getPostForEdit>>
>;

export async function getAllTagNames() {
  const rows = await db
    .select({ name: tags.name })
    .from(tags)
    .orderBy(tags.name);
  return rows.map((r) => r.name);
}
