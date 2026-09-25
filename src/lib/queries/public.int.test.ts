/** Public read models against the real DB. Run with `npm run test:int`. */
import { like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { posts, postTags, tags } from "@/db/schema";

import {
  getAdjacentPosts,
  getLivePostBySlug,
  getLivePosts,
  getLiveTags,
  getRelatedPosts,
  HIGHLIGHT_END,
  HIGHLIGHT_START,
  searchPosts,
} from "./public";

vi.mock("server-only", () => ({}));

const P = "int-pub";
const day = 86_400_000;
const now = Date.now();
// Fixed past dates so real content never falls between the fixtures.
const jan = (d: number) => Date.UTC(2001, 0, d);
const doc = { type: "doc" as const, content: [{ type: "paragraph" }] };

const fixtures = [
  {
    slug: `${P}-oldest`,
    status: "published",
    at: jan(1),
    tags: ["a"],
    text: "Zebras gallop across the savanna at dawn",
  },
  {
    slug: `${P}-middle`,
    status: "published",
    at: jan(3),
    tags: ["a", "b"],
    text: "Quokkas are famously cheerful marsupials",
  },
  {
    slug: `${P}-newest`,
    status: "published",
    at: jan(5),
    tags: ["a", "b"],
    text: "",
  },
  {
    slug: `${P}-draft`,
    status: "draft",
    at: null,
    tags: ["a"],
    text: "Quokkas in drafts must stay hidden",
  },
  {
    slug: `${P}-future`,
    status: "scheduled",
    at: now + 2 * day,
    tags: ["a"],
    text: "Quokkas from the future",
  },
  {
    slug: `${P}-due`,
    status: "scheduled",
    at: jan(4),
    tags: [],
    text: "Scheduled and already due",
  },
] as const;

async function cleanup() {
  await db.delete(posts).where(like(posts.slug, `${P}%`));
  await db.delete(tags).where(like(tags.slug, `${P}%`));
}

beforeAll(async () => {
  await cleanup();
  const [tagA, tagB] = await db
    .insert(tags)
    .values([
      { name: "Int Pub A", slug: `${P}-a` },
      { name: "Int Pub B", slug: `${P}-b` },
    ])
    .returning();
  const tagIds = { a: tagA!.id, b: tagB!.id };
  for (const f of fixtures) {
    const [row] = await db
      .insert(posts)
      .values({
        title: f.slug,
        slug: f.slug,
        content: doc,
        contentText: f.text,
        status: f.status,
        publishedAt: f.at ? new Date(f.at) : null,
      })
      .returning({ id: posts.id });
    if (f.tags.length) {
      await db
        .insert(postTags)
        .values(f.tags.map((t) => ({ postId: row!.id, tagId: tagIds[t] })));
    }
  }
});

afterAll(cleanup);

const ours = <T extends { slug: string }>(list: T[]) =>
  list.filter((p) => p.slug.startsWith(P)).map((p) => p.slug);

describe("public queries", () => {
  it("lists only live posts, newest first, including past-due schedules", async () => {
    const { posts: list } = await getLivePosts({ perPage: 100 });
    expect(ours(list)).toEqual([
      `${P}-newest`,
      `${P}-due`,
      `${P}-middle`,
      `${P}-oldest`,
    ]);
  });

  it("filters by tag and paginates", async () => {
    const page1 = await getLivePosts({ tagSlug: `${P}-a`, perPage: 2 });
    expect(page1.total).toBe(3);
    expect(page1.pageCount).toBe(2);
    expect(ours(page1.posts)).toEqual([`${P}-newest`, `${P}-middle`]);
    const page2 = await getLivePosts({
      tagSlug: `${P}-a`,
      perPage: 2,
      page: 2,
    });
    expect(ours(page2.posts)).toEqual([`${P}-oldest`]);
  });

  it("derives reading time and excerpt from content", async () => {
    const { posts: list } = await getLivePosts({ tagSlug: `${P}-b` });
    const middle = list.find((p) => p.slug === `${P}-middle`)!;
    expect(middle.excerpt).toBe("Quokkas are famously cheerful marsupials");
    expect(middle.readingTime).toBe(1);
    expect(middle.tags.map((t) => t.slug)).toEqual([`${P}-a`, `${P}-b`]);
    // Empty content still yields sane values.
    const newest = list.find((p) => p.slug === `${P}-newest`)!;
    expect(newest.excerpt).toBe("");
    expect(newest.readingTime).toBe(1);
  });

  it("hides drafts and future posts by slug", async () => {
    expect(await getLivePostBySlug(`${P}-draft`)).toBeUndefined();
    expect(await getLivePostBySlug(`${P}-future`)).toBeUndefined();
    const due = await getLivePostBySlug(`${P}-due`);
    expect(due?.description).toBe("Scheduled and already due");
  });

  it("finds adjacent and related posts", async () => {
    const middle = (await getLivePostBySlug(`${P}-middle`))!;
    const adjacent = await getAdjacentPosts({
      id: middle.id,
      publishedAt: middle.publishedAt!,
    });
    expect(adjacent.older?.slug).toBe(`${P}-oldest`);
    expect(adjacent.newer?.slug).toBe(`${P}-due`);

    const related = await getRelatedPosts(
      middle.id,
      middle.postTags.map((pt) => pt.tag.id),
    );
    // "newest" shares both tags, "oldest" one; the draft/future never appear.
    expect(ours(related)).toEqual([`${P}-newest`, `${P}-oldest`]);
  });

  it("counts only live posts per tag", async () => {
    const list = await getLiveTags();
    const a = list.find((t) => t.slug === `${P}-a`);
    const b = list.find((t) => t.slug === `${P}-b`);
    expect(a?.postCount).toBe(3);
    expect(b?.postCount).toBe(2);
  });

  it("searches live posts with safe highlight markers", async () => {
    const results = await searchPosts("quokkas");
    expect(ours(results)).toEqual([`${P}-middle`]);
    expect(results[0]!.snippet).toContain(
      `${HIGHLIGHT_START}Quokkas${HIGHLIGHT_END}`,
    );
    expect(await searchPosts("   ")).toEqual([]);
    // websearch syntax must never throw on odd input.
    expect(Array.isArray(await searchPosts('"unclosed OR -'))).toBe(true);
  });
});
