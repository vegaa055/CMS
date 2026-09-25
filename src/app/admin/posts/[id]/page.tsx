import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { z } from "zod";

import type { PostEditorPost } from "@/components/admin/posts/post-editor";
import { PostEditorLoader } from "@/components/admin/posts/post-editor-loader";
import { can, canDeletePost, canEditPost } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getAllTagNames, getPostForEdit } from "@/lib/queries/admin";

export async function generateMetadata({
  params,
}: PageProps<"/admin/posts/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: id === "new" ? "New post" : "Edit post" };
}

/** Handles both /admin/posts/new and /admin/posts/<id>. */
export default async function PostEditorPage({
  params,
}: PageProps<"/admin/posts/[id]">) {
  const { id } = await params;
  const { user } = await requireSession();

  let post: PostEditorPost | null = null;
  let canDelete = false;
  if (id === "new") {
    if (!can(user.role, "post:create")) forbidden();
    canDelete = can(user.role, "post:delete:own"); // the creator owns it
  } else {
    if (!z.uuid().safeParse(id).success) notFound();
    const found = await getPostForEdit(id);
    if (!found) notFound();
    if (!canEditPost(user, found)) forbidden();
    canDelete = canDeletePost(user, found);
    post = {
      id: found.id,
      title: found.title,
      slug: found.slug,
      excerpt: found.excerpt,
      content: found.content,
      tags: found.tags,
      seoTitle: found.seoTitle,
      seoDescription: found.seoDescription,
      status: found.status,
      publishedAt: found.publishedAt?.toISOString() ?? null,
      updatedAt: found.updatedAt.toISOString(),
    };
  }

  const allTags = await getAllTagNames();

  return (
    <PostEditorLoader
      // A different post must get a fresh editor; "new" -> id keeps the same one.
      key={post?.id ?? "new"}
      post={post}
      allTags={allTags}
      permissions={{
        canPublish: can(user.role, "post:publish"),
        canCreateTags: can(user.role, "tag:manage"),
        canDelete,
      }}
    />
  );
}
