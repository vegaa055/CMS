import "server-only";

import { count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { media, posts, postTags, tags, user } from "@/db/schema";
import { can } from "@/lib/auth/permissions";
import type { AppSession } from "@/lib/auth/session";

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
        .select({ status: posts.status, count: count() })
        .from(posts)
        .where(scope)
        .groupBy(posts.status),
      db.select({ count: count() }).from(media),
      db.select({ count: count() }).from(tags),
      db.select({ count: count() }).from(user),
    ]);

  const byStatus = Object.fromEntries(
    statusCounts.map((r) => [r.status, r.count]),
  ) as Partial<Record<(typeof statusCounts)[number]["status"], number>>;

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
  return db.query.posts.findMany({
    where: postScope(session),
    orderBy: desc(posts.updatedAt),
    limit,
    columns: { id: true, title: true, status: true, updatedAt: true },
    with: { author: { columns: { name: true } } },
  });
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
      publishedAt: true,
      updatedAt: true,
    },
    with: {
      author: { columns: { name: true } },
      postTags: { with: { tag: { columns: { name: true } } } },
    },
  });
  return rows.map(({ postTags: pt, author, ...p }) => ({
    ...p,
    author: author?.name ?? null,
    tags: pt.map((t) => t.tag.name),
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
  }));
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
