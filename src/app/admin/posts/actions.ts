"use server";

import { and, eq, inArray, like, ne, or } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { pgError, UNIQUE_VIOLATION } from "@/db/errors";
import { posts, postTags, tags } from "@/db/schema";
import {
  fail,
  ok,
  zodFieldErrors,
  type ActionResult,
} from "@/lib/action-result";
import { can, canDeletePost, canEditPost } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { sanitizeDoc } from "@/lib/editor/sanitize";
import { resolvePublishing } from "@/lib/posts/publishing";
import { effectiveStatus, type PostStatus } from "@/lib/posts/status";
import { richTextToPlainText } from "@/lib/rich-text";
import { slugify } from "@/lib/slug";
import { savePostSchema } from "@/lib/validation/post";

export type SavedPost = {
  id: string;
  slug: string;
  status: PostStatus;
  publishedAt: string | null;
  updatedAt: string;
};

const PUBLIC_STATUSES = new Set<PostStatus>(["published", "scheduled"]);

async function uniqueSlug(base: string, excludeId?: string) {
  const rows = await db
    .select({ slug: posts.slug })
    .from(posts)
    .where(
      and(
        or(eq(posts.slug, base), like(posts.slug, `${base}-%`)),
        excludeId ? ne(posts.id, excludeId) : undefined,
      ),
    );
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }
}

/** Resolve tag names to ids, creating missing tags when allowed. */
async function resolveTags(names: string[], canCreate: boolean) {
  const bySlug = new Map<string, string>();
  for (const raw of names) {
    const name = raw.replace(/\s+/g, " ").trim();
    const slug = slugify(name);
    if (slug && !bySlug.has(slug)) bySlug.set(slug, name);
  }
  if (!bySlug.size) return { ids: [] as string[] };

  const slugs = [...bySlug.keys()];
  const existing = await db
    .select({ id: tags.id, slug: tags.slug })
    .from(tags)
    .where(inArray(tags.slug, slugs));
  const missing = slugs.filter((s) => !existing.some((t) => t.slug === s));

  if (missing.length && !canCreate) {
    return {
      error: `You can't create new tags: ${missing.map((s) => bySlug.get(s)).join(", ")}`,
    };
  }
  if (missing.length) {
    const created = await db
      .insert(tags)
      .values(missing.map((slug) => ({ slug, name: bySlug.get(slug)! })))
      .onConflictDoNothing()
      .returning({ id: tags.id, slug: tags.slug });
    existing.push(...created);
  }
  return { ids: existing.map((t) => t.id) };
}

export async function savePost(raw: unknown): Promise<ActionResult<SavedPost>> {
  const session = await getSession();
  if (!session) return fail("Your session expired. Sign in again.");
  const { user } = session;

  const parsed = savePostSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      "Please fix the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }
  const input = parsed.data;

  // Load and authorize against the stored post, never the client's view of it.
  const previous = input.id
    ? await db.query.posts.findFirst({
        where: eq(posts.id, input.id),
        columns: { id: true, authorId: true, status: true, publishedAt: true },
      })
    : undefined;

  if (input.id && !previous) return fail("This post no longer exists.");
  if (previous) {
    const current = {
      ...previous,
      status: effectiveStatus(previous.status, previous.publishedAt),
    };
    if (!canEditPost(user, current)) {
      return fail("You don't have permission to edit this post.");
    }
  } else if (!can(user.role, "post:create")) {
    return fail("You don't have permission to create posts.");
  }

  if (input.status !== "draft" && !can(user.role, "post:publish")) {
    return fail(
      "Only editors and admins can publish. Save it as a draft instead.",
    );
  }
  if (input.status !== "draft" && !input.title) {
    return fail("Add a title before publishing.", {
      title: "Title is required to publish",
    });
  }

  const publishing = resolvePublishing(
    input.status,
    input.publishedAt,
    previous,
  );
  if ("error" in publishing)
    return fail(publishing.error, { publishedAt: publishing.error });

  let content;
  try {
    content = sanitizeDoc(input.content);
  } catch (error) {
    console.error("[savePost] rejected post content:", error);
    return fail("The post content couldn't be read. Try reloading the editor.");
  }

  const tagResult = await resolveTags(input.tags, can(user.role, "tag:manage"));
  if ("error" in tagResult)
    return fail(tagResult.error!, { tags: tagResult.error! });

  const id = previous?.id ?? crypto.randomUUID();
  const slug = await uniqueSlug(
    input.slug || slugify(input.title) || "untitled",
    previous?.id,
  );
  const values = {
    title: input.title,
    slug,
    excerpt: input.excerpt ?? null,
    content,
    contentText: richTextToPlainText(content),
    status: publishing.status,
    publishedAt: publishing.publishedAt,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
  };

  // One transactional batch: the post row and its tag links change together.
  const writePost = previous
    ? db
        .update(posts)
        .set(values)
        .where(eq(posts.id, id))
        .returning({ updatedAt: posts.updatedAt })
    : db
        .insert(posts)
        .values({ id, authorId: user.id, ...values })
        .returning({ updatedAt: posts.updatedAt });
  const statements: [BatchItem<"pg">, ...BatchItem<"pg">[]] = [
    writePost,
    db.delete(postTags).where(eq(postTags.postId, id)),
  ];
  if (tagResult.ids.length) {
    statements.push(
      db
        .insert(postTags)
        .values(tagResult.ids.map((tagId) => ({ postId: id, tagId }))),
    );
  }

  let updatedAt: Date;
  try {
    const [written] = await db.batch(statements);
    updatedAt = (written as { updatedAt: Date }[])[0]!.updatedAt;
  } catch (error) {
    if (pgError(error).code === UNIQUE_VIOLATION) {
      return fail("That slug was just taken. Try saving again.", {
        slug: "Slug already in use",
      });
    }
    throw error;
  }

  // The public site only needs refreshing when live content may have changed.
  if (
    PUBLIC_STATUSES.has(publishing.status) ||
    (previous && PUBLIC_STATUSES.has(previous.status))
  ) {
    revalidatePath("/");
  }

  return ok({
    id,
    slug,
    status: effectiveStatus(publishing.status, publishing.publishedAt),
    publishedAt: publishing.publishedAt?.toISOString() ?? null,
    updatedAt: updatedAt.toISOString(),
  });
}

export async function deletePost(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Your session expired. Sign in again.");
  if (!z.uuid().safeParse(id).success) return fail("Invalid post id.");

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    columns: { authorId: true, status: true, publishedAt: true },
  });
  if (!post) return fail("This post no longer exists.");

  const status = effectiveStatus(post.status, post.publishedAt);
  if (!canDeletePost(session.user, { ...post, status })) {
    return fail("You don't have permission to delete this post.");
  }

  await db.delete(posts).where(eq(posts.id, id));
  if (PUBLIC_STATUSES.has(post.status)) revalidatePath("/");
  revalidatePath("/admin/posts");
  return ok(null);
}
