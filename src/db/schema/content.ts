import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { timestamps, tsvector } from "./columns";

/** Tiptap / ProseMirror document JSON. */
export type RichTextDoc = {
  type: "doc";
  content?: Record<string, unknown>[];
};

export const postStatus = pgEnum("post_status", [
  "draft",
  "scheduled",
  "published",
  "archived",
]);

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Object key in the storage bucket. */
    key: text("key").notNull().unique(),
    url: text("url").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt"),
    uploadedById: text("uploaded_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("media_created_at_idx").on(t.createdAt)],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    excerpt: text("excerpt"),
    content: jsonb("content").$type<RichTextDoc>(),
    /** Plain-text projection of `content`, maintained by the app, used for search. */
    contentText: text("content_text").notNull().default(""),
    status: postStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    coverImageId: uuid("cover_image_id").references(() => media.id, {
      onDelete: "set null",
    }),
    authorId: text("author_id").references(() => user.id, {
      onDelete: "set null",
    }),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') || setweight(to_tsvector('english', content_text), 'C')`,
    ),
    ...timestamps,
  },
  (t) => [
    index("posts_status_published_at_idx").on(t.status, t.publishedAt),
    index("posts_author_id_idx").on(t.authorId),
    index("posts_search_idx").using("gin", t.searchVector),
  ],
);

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  ...timestamps,
});

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.tagId] }),
    index("post_tags_tag_id_idx").on(t.tagId),
  ],
);

/** Key/value site settings (site name, logo, socials...). Values are JSON. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  ...timestamps,
});
