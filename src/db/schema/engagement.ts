import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
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
