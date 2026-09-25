/**
 * Demo content for screenshots and trying the CMS: `npm run db:seed:demo`.
 * Adds two fictional authors, eight posts (incl. a draft and a scheduled
 * post), tags, and generated cover images. Idempotent: existing slugs and
 * images are left alone. Best run against a separate Neon branch.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { neon } from "@neondatabase/serverless";
import { AwsClient } from "aws4fetch";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import sharp from "sharp";

import { richTextToPlainText } from "@/lib/rich-text";
import { slugify } from "@/lib/slug";

import { coverSvg, palettes } from "./demo/covers";
import { demoAuthors, demoPosts } from "./demo/posts";
import * as schema from "./schema";

const { media, posts, postTags, tags, user } = schema;

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = drizzle(neon(url), { schema });
const driver = process.env.STORAGE_DRIVER === "r2" ? "r2" : "local";

/** Stable UUID-shaped id from a string, so reruns reuse the same media key. */
function stableUuid(input: string) {
  const h = createHash("sha256").update(input).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function store(key: string, body: Buffer) {
  if (driver === "local") {
    const target = path.join(process.cwd(), ".uploads", key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return `/uploads/${key}`;
  }
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_PUBLIC_URL,
  } = process.env;
  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET ||
    !R2_PUBLIC_URL
  ) {
    throw new Error("STORAGE_DRIVER=r2 needs the R2_* variables");
  }
  const client = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  const res = await client.fetch(
    `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`,
    {
      method: "PUT",
      body: new Uint8Array(body),
      headers: { "content-type": "image/webp" },
    },
  );
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
  return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}

async function coverFor(
  slug: string,
  palette: keyof typeof palettes,
  uploaderId: string,
) {
  // Fixed prefix + hash of the slug: reruns find the same key.
  const key = `media/2026/01/${stableUuid(slug)}.webp`;
  const [existing] = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.key, key));
  if (existing) return existing.id;

  const seed = parseInt(
    createHash("md5").update(slug).digest("hex").slice(0, 8),
    16,
  );
  const body = await sharp(Buffer.from(coverSvg(palettes[palette], seed)))
    .webp({ quality: 88 })
    .toBuffer();
  const [row] = await db
    .insert(media)
    .values({
      key,
      url: await store(key, body),
      filename: `${slug}.webp`,
      mimeType: "image/webp",
      size: body.length,
      width: 1600,
      height: 1000,
      alt: "Abstract gradient artwork",
      uploadedById: uploaderId,
    })
    .returning({ id: media.id });
  return row!.id;
}

async function main() {
  console.log(`Seeding demo content (storage: ${driver})…`);

  await db
    .insert(user)
    .values(
      demoAuthors.map(({ id, name, username, email, role, bio }) => ({
        id,
        name,
        username,
        email,
        role,
        bio,
      })),
    )
    .onConflictDoNothing();

  const tagNames = [...new Set(demoPosts.flatMap((p) => p.tags))];
  await db
    .insert(tags)
    .values(tagNames.map((name) => ({ name, slug: slugify(name) })))
    .onConflictDoNothing();
  const tagRows = await db
    .select()
    .from(tags)
    .where(inArray(tags.slug, tagNames.map(slugify)));
  const tagId = new Map(tagRows.map((t) => [t.name, t.id]));

  let created = 0;
  for (const post of demoPosts) {
    const slug = slugify(post.title);
    const [exists] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.slug, slug));
    if (exists) continue;

    const status =
      post.daysAgo === null
        ? "draft"
        : post.daysAgo < 0
          ? "scheduled"
          : "published";
    const publishedAt =
      post.daysAgo === null
        ? null
        : new Date(Date.now() - post.daysAgo * 86_400_000 - 3 * 3_600_000);
    const coverImageId = post.cover
      ? await coverFor(slug, post.cover, post.author)
      : null;

    const [row] = await db
      .insert(posts)
      .values({
        title: post.title,
        slug,
        excerpt: post.excerpt,
        content: post.content,
        contentText: richTextToPlainText(post.content),
        status,
        publishedAt,
        authorId: post.author,
        coverImageId,
      })
      .returning({ id: posts.id });
    await db
      .insert(postTags)
      .values(
        post.tags.map((name) => ({ postId: row!.id, tagId: tagId.get(name)! })),
      )
      .onConflictDoNothing();
    created++;
  }
  console.log(`Done. Created ${created} post(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
