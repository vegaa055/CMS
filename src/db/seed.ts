/**
 * Idempotent development seed: `npm run db:seed`.
 * Safe to re-run; existing rows (matched by unique keys) are left alone.
 * Login-capable users are created in Phase 2 via auth, so the demo author here has no password.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { richTextToPlainText } from "@/lib/rich-text";
import { slugify } from "@/lib/slug";

import * as schema from "./schema";
import type { RichTextDoc } from "./schema";

const { posts, postTags, settings, tags, user } = schema;

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set in .env.local");
const db = drizzle(neon(url), { schema });

const paragraph = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const heading = (text: string, level = 2) => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const doc = (...content: Record<string, unknown>[]): RichTextDoc => ({
  type: "doc",
  content,
});

const DEMO_AUTHOR_ID = "seed-demo-author";

const samplePosts: {
  title: string;
  excerpt: string;
  status: "draft" | "published";
  daysAgo: number;
  tags: string[];
  content: RichTextDoc;
}[] = [
  {
    title: "Welcome to Folio",
    excerpt: "A quick tour of what this CMS can do and where it's headed.",
    status: "published",
    daysAgo: 7,
    tags: ["Announcements"],
    content: doc(
      paragraph(
        "Folio is a modern content platform built with Next.js, Postgres, and a dark-first design system.",
      ),
      heading("What's inside"),
      paragraph(
        "Posts with a rich-text editor, a media library, tags, roles, and a fast public site with search and RSS.",
      ),
    ),
  },
  {
    title: "Designing a dark-first palette",
    excerpt: "Why OKLCH tokens make light and dark themes easier to maintain.",
    status: "published",
    daysAgo: 3,
    tags: ["Design", "Engineering"],
    content: doc(
      paragraph(
        "OKLCH is perceptually uniform, so adjusting lightness keeps contrast predictable across themes.",
      ),
      heading("One source of truth"),
      paragraph(
        "Every color in the UI resolves to a CSS variable, so the whole site can be re-skinned from one file.",
      ),
    ),
  },
  {
    title: "Roadmap notes",
    excerpt: "Upcoming features: revisions, webhooks, and a headless API.",
    status: "draft",
    daysAgo: 0,
    tags: ["Engineering"],
    content: doc(
      paragraph("Drafts are only visible in the dashboard until published."),
    ),
  },
];

async function main() {
  console.log("Seeding settings...");
  await db
    .insert(settings)
    .values([
      { key: "site.name", value: "Folio" },
      { key: "site.tagline", value: "A modern content platform" },
      { key: "site.postsPerPage", value: 10 },
    ])
    .onConflictDoNothing();

  console.log("Seeding demo author...");
  await db
    .insert(user)
    .values({
      id: DEMO_AUTHOR_ID,
      name: "Demo Author",
      email: "demo@folio.local",
      role: "author",
      bio: "Placeholder author created by the seed script.",
    })
    .onConflictDoNothing();

  console.log("Seeding tags...");
  const tagNames = [...new Set(samplePosts.flatMap((p) => p.tags))];
  await db
    .insert(tags)
    .values(tagNames.map((name) => ({ name, slug: slugify(name) })))
    .onConflictDoNothing();
  const allTags = await db.select().from(tags);
  const tagIdByName = new Map(allTags.map((t) => [t.name, t.id]));

  console.log("Seeding posts...");
  for (const p of samplePosts) {
    const slug = slugify(p.title);
    const [inserted] = await db
      .insert(posts)
      .values({
        title: p.title,
        slug,
        excerpt: p.excerpt,
        content: p.content,
        contentText: richTextToPlainText(p.content),
        status: p.status,
        publishedAt:
          p.status === "published"
            ? new Date(Date.now() - p.daysAgo * 86_400_000)
            : null,
        authorId: DEMO_AUTHOR_ID,
      })
      .onConflictDoNothing({ target: posts.slug })
      .returning({ id: posts.id });

    if (!inserted) continue; // already seeded
    await db
      .insert(postTags)
      .values(
        p.tags.map((name) => ({
          postId: inserted.id,
          tagId: tagIdByName.get(name)!,
        })),
      )
      .onConflictDoNothing();
  }

  const counts = await db.execute(
    sql`select (select count(*) from posts)::int as posts, (select count(*) from tags)::int as tags, (select count(*) from settings)::int as settings`,
  );
  console.log("Done.", counts.rows[0]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
