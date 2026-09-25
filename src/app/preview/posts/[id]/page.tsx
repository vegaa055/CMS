import { ArrowLeft, Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound, redirect } from "next/navigation";
import { z } from "zod";

import { StatusBadge } from "@/components/admin/status-badge";
import { PostArticle } from "@/components/content/post-article";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { canPreviewPost } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { effectiveStatus } from "@/lib/posts/status";
import { getPostById } from "@/lib/queries/posts";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

/** Authenticated preview of any post, including unpublished drafts. */
export default async function PostPreviewPage({
  params,
}: PageProps<"/preview/posts/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const session = await getSession();
  if (!session) redirect(`/login?next=/preview/posts/${id}`);

  const post = await getPostById(id);
  if (!post) notFound();
  if (!canPreviewPost(session.user, post)) forbidden();

  return (
    <div className="flex flex-1 flex-col">
      <div className="bg-accent/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="text-accent-foreground mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-3 px-4 text-sm">
          <span className="flex items-center gap-2">
            <Eye className="size-4" /> Preview
            <StatusBadge
              status={effectiveStatus(post.status, post.publishedAt)}
            />
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/posts/${post.id}`}>
                <ArrowLeft /> Back to editor
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </div>
      <main className="px-4 py-16">
        <PostArticle post={post} />
      </main>
    </div>
  );
}
