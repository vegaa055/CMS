import { Heart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { UnlikeButton } from "@/components/account/unlike-button";
import { EmptyState } from "@/components/admin/empty-state";
import { Pagination, parsePage } from "@/components/site/pagination";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { formatRelative } from "@/lib/format";
import { postPath } from "@/lib/posts/urls";
import { getLikedPosts } from "@/lib/queries/likes";

export const metadata: Metadata = { title: "Liked stories" };

export default async function LikedStoriesPage({
  searchParams,
}: PageProps<"/account/likes">) {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent("/account/likes")}`);
  }
  const page = parsePage((await searchParams).page);
  if (!page) notFound();
  const { posts, total, pageCount } = await getLikedPosts(
    session.user.id,
    page,
  );
  // e.g. the last one on the last page was just unliked.
  if (page > pageCount) {
    redirect(
      pageCount > 1 ? `/account/likes?page=${pageCount}` : "/account/likes",
    );
  }

  if (!posts.length) {
    return (
      <EmptyState
        icon={Heart}
        title="No liked stories yet"
        description="Tap the heart at the end of a post you enjoy, and it'll be saved here."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/posts">Browse writing</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {total} liked {total === 1 ? "story" : "stories"}, most recent first.
        Only you can see this list.
      </p>
      <ul className="bg-card divide-y rounded-xl border">
        {posts.map((post) => (
          <li
            key={post.id}
            className="flex items-start justify-between gap-4 p-4"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <Link
                href={postPath(post.slug)}
                className="font-display hover:text-primary text-xl leading-snug"
              >
                {post.title}
              </Link>
              {post.excerpt && (
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {post.excerpt}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                Liked {formatRelative(post.likedAt)}
              </p>
            </div>
            <UnlikeButton postId={post.id} title={post.title} />
          </li>
        ))}
      </ul>
      <Pagination page={page} pageCount={pageCount} basePath="/account/likes" />
    </section>
  );
}
