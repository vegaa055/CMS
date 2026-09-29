import "server-only";

import { and, asc, count, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { comments, posts, user } from "@/db/schema";
import { isRole, isStaff } from "@/lib/auth/permissions";
import {
  countThread,
  type CommentStatus,
  type ThreadComment,
} from "@/lib/comments";
import { effectiveStatus } from "@/lib/posts/status";
import { livePostWhere } from "@/lib/posts/visibility";

const threadColumns = {
  id: comments.id,
  parentId: comments.parentId,
  body: comments.body,
  status: comments.status,
  createdAt: comments.createdAt,
  editedAt: comments.editedAt,
  deletedAt: comments.deletedAt,
  authorId: comments.authorId,
  authorName: user.name,
  authorImage: user.image,
  authorRole: user.role,
};

type ThreadRow = {
  id: string;
  parentId: string | null;
  body: string;
  status: CommentStatus;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  authorId: string | null;
  authorName: string | null;
  authorImage: string | null;
  authorRole: string | null;
};

function toThreadComment(
  row: ThreadRow,
  postAuthorId: string | null,
): ThreadComment {
  const role = isRole(row.authorRole) ? row.authorRole : undefined;
  return {
    id: row.id,
    parentId: row.parentId,
    body: row.deletedAt ? "" : row.body,
    deleted: row.deletedAt !== null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    author:
      row.authorId && row.authorName !== null
        ? {
            id: row.authorId,
            name: row.authorName,
            image: row.authorImage,
            badge:
              row.authorId === postAuthorId
                ? "author"
                : isStaff(role)
                  ? "team"
                  : null,
          }
        : null,
    replies: [],
  };
}

/**
 * A post's public thread: approved comments oldest first, with replies
 * nested under their (approved) parent. A deleted comment only stays while
 * it has replies. `total` counts the comments actually shown.
 */
export async function getPostThread(
  postId: string,
  postAuthorId: string | null,
) {
  const rows = await db
    .select(threadColumns)
    .from(comments)
    .leftJoin(user, eq(user.id, comments.authorId))
    .where(and(eq(comments.postId, postId), eq(comments.status, "approved")))
    .orderBy(asc(comments.createdAt), asc(comments.id));

  const byId = new Map(
    rows.map((r) => [r.id, toThreadComment(r, postAuthorId)]),
  );
  const top: ThreadComment[] = [];
  for (const comment of byId.values()) {
    if (!comment.parentId) top.push(comment);
    else byId.get(comment.parentId)?.replies.push(comment);
  }
  const thread = top.filter((c) => !c.deleted || c.replies.length > 0);
  return { comments: thread, total: countThread(thread) };
}

/**
 * Slugs of live posts showing someone's comments, so those pages can be
 * refreshed when their name changes or their account goes.
 */
export async function getCommentedPostSlugs(userId: string) {
  const rows = await db
    .selectDistinct({ slug: posts.slug })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(
      and(
        eq(comments.authorId, userId),
        eq(comments.status, "approved"),
        livePostWhere(),
      ),
    );
  return rows.map((r) => r.slug);
}

/** Someone's comments on a post that are still waiting for a moderator. */
export async function getViewerPendingComments(
  postId: string,
  userId: string,
  postAuthorId: string | null,
) {
  const rows = await db
    .select(threadColumns)
    .from(comments)
    .leftJoin(user, eq(user.id, comments.authorId))
    .where(
      and(
        eq(comments.postId, postId),
        eq(comments.authorId, userId),
        eq(comments.status, "pending"),
        isNull(comments.deletedAt),
      ),
    )
    .orderBy(asc(comments.createdAt));
  return rows.map((r) => toThreadComment(r, postAuthorId));
}

/** Whether this person already has a published comment anywhere. */
export async function hasApprovedComment(userId: string) {
  const [row] = await db
    .select({ id: comments.id })
    .from(comments)
    .where(
      and(
        eq(comments.authorId, userId),
        eq(comments.status, "approved"),
        isNull(comments.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** A live post that could take comments (the settings decide the rest). */
export async function getCommentablePost(postId: string) {
  const [post] = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      authorId: posts.authorId,
      commentsEnabled: posts.commentsEnabled,
    })
    .from(posts)
    .where(and(eq(posts.id, postId), livePostWhere()));
  return post;
}

/** A comment with what actions need to know about its post. */
export async function getCommentForAction(id: string) {
  const [row] = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      parentId: comments.parentId,
      authorId: comments.authorId,
      status: comments.status,
      createdAt: comments.createdAt,
      deletedAt: comments.deletedAt,
      post: {
        slug: posts.slug,
        status: posts.status,
        publishedAt: posts.publishedAt,
        commentsEnabled: posts.commentsEnabled,
      },
    })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(eq(comments.id, id));
  if (!row) return undefined;
  const { post, ...comment } = row;
  return {
    ...comment,
    post: {
      slug: post.slug,
      live: effectiveStatus(post.status, post.publishedAt) === "published",
      commentsEnabled: post.commentsEnabled,
    },
  };
}

export const COMMENTS_PER_PAGE = 20;

/** The moderation queue for one status, newest first. */
export async function getModerationQueue({
  status,
  page,
}: {
  status: CommentStatus;
  page: number;
}) {
  const parent = db
    .select({ id: comments.id, authorId: comments.authorId })
    .from(comments)
    .as("parent");
  const parentAuthor = db
    .select({ id: user.id, name: user.name })
    .from(user)
    .as("parent_author");
  const where = and(eq(comments.status, status), isNull(comments.deletedAt));
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: comments.id,
        body: comments.body,
        status: comments.status,
        createdAt: comments.createdAt,
        editedAt: comments.editedAt,
        authorName: user.name,
        authorEmail: user.email,
        authorRole: user.role,
        postTitle: posts.title,
        postSlug: posts.slug,
        replyTo: parentAuthor.name,
        isReply: parent.id,
      })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .leftJoin(user, eq(user.id, comments.authorId))
      .leftJoin(parent, eq(parent.id, comments.parentId))
      .leftJoin(parentAuthor, eq(parentAuthor.id, parent.authorId))
      .where(where)
      .orderBy(desc(comments.createdAt), desc(comments.id))
      .limit(COMMENTS_PER_PAGE)
      .offset((page - 1) * COMMENTS_PER_PAGE),
    db.select({ value: count() }).from(comments).where(where),
  ]);
  const totalCount = total?.value ?? 0;
  return {
    rows: rows.map((r) => ({
      id: r.id,
      body: r.body,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      edited: r.editedAt !== null,
      author:
        r.authorName !== null
          ? {
              name: r.authorName,
              email: r.authorEmail!,
              staff: isStaff(isRole(r.authorRole) ? r.authorRole : undefined),
            }
          : null,
      post: { title: r.postTitle, slug: r.postSlug },
      reply: r.isReply ? { to: r.replyTo } : null,
    })),
    total: totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / COMMENTS_PER_PAGE)),
  };
}

export type ModerationRow = Awaited<
  ReturnType<typeof getModerationQueue>
>["rows"][number];

/** How many comments are in each queue (deleted placeholders excluded). */
export async function getCommentCounts() {
  const rows = await db
    .select({ status: comments.status, value: count() })
    .from(comments)
    .where(isNull(comments.deletedAt))
    .groupBy(comments.status);
  const counts = { pending: 0, approved: 0, spam: 0 };
  for (const row of rows) counts[row.status] = row.value;
  return counts;
}

/** Someone's own comments on live posts, newest first (Account → Comments). */
export async function getMyComments(userId: string, page = 1) {
  const where = and(
    eq(comments.authorId, userId),
    isNull(comments.deletedAt),
    livePostWhere(),
  );
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: comments.id,
        body: comments.body,
        status: comments.status,
        createdAt: comments.createdAt,
        postTitle: posts.title,
        postSlug: posts.slug,
      })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .where(where)
      .orderBy(desc(comments.createdAt), desc(comments.id))
      .limit(COMMENTS_PER_PAGE)
      .offset((page - 1) * COMMENTS_PER_PAGE),
    db
      .select({ value: count() })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .where(where),
  ]);
  const totalCount = total?.value ?? 0;
  return {
    comments: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    total: totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / COMMENTS_PER_PAGE)),
  };
}
