import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { timestamps } from "./columns";
import { posts } from "./content";

/**
 * Reader engagement. Likes are private: only per-post totals are ever shown
 * publicly, and each person sees their own. A like disappears with its post
 * or its account.
 */
export const postLikes = pgTable(
  "post_likes",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One like per person per post; also serves per-post counts.
    primaryKey({ columns: [t.postId, t.userId] }),
    // Someone's likes, newest first (Account → Liked stories).
    index("post_likes_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const commentStatus = pgEnum("comment_status", [
  "pending",
  "approved",
  "spam",
]);

/**
 * Plain-text comments with one level of replies. Only approved ones are
 * public; pending ones are visible to their author and moderators.
 */
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    /** Null once the author deletes their account ("Deleted reader"). */
    authorId: text("author_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Replies point at a top-level comment: threads are one level deep. */
    parentId: uuid("parent_id").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    /** No default: posting decides (see `initialCommentStatus`). */
    status: commentStatus("status").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    /**
     * Set when a comment with replies is deleted: its text is cleared but
     * the row stays, so the replies keep their place under "[deleted]".
     */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // A post's thread, and "has this person had a comment approved?".
    index("comments_post_status_created_idx").on(
      t.postId,
      t.status,
      t.createdAt,
    ),
    // The moderation queue.
    index("comments_status_created_idx").on(t.status, t.createdAt),
    // Account → Your comments.
    index("comments_author_created_idx").on(t.authorId, t.createdAt),
    index("comments_parent_idx").on(t.parentId),
  ],
);
