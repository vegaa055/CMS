import { MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DeleteCommentButton } from "@/components/account/delete-comment-button";
import { EmptyState } from "@/components/admin/empty-state";
import { CommentBody } from "@/components/comments/comment-body";
import { Pagination, parsePage } from "@/components/site/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { formatRelative } from "@/lib/format";
import { postPath } from "@/lib/posts/urls";
import { getMyComments } from "@/lib/queries/comments";

export const metadata: Metadata = { title: "Your comments" };

const STATUS_LABELS = {
  pending: "Awaiting approval",
  spam: "Not published",
} as const;

export default async function YourCommentsPage({
  searchParams,
}: PageProps<"/account/comments">) {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent("/account/comments")}`);
  }
  const page = parsePage((await searchParams).page);
  if (!page) notFound();
  const { comments, total, pageCount } = await getMyComments(
    session.user.id,
    page,
  );
  // e.g. the last one on the last page was just deleted.
  if (page > pageCount) {
    redirect(
      pageCount > 1
        ? `/account/comments?page=${pageCount}`
        : "/account/comments",
    );
  }

  if (!comments.length) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No comments yet"
        description="Comments you write on posts are listed here, where you can find or delete them."
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
        {total} {total === 1 ? "comment" : "comments"}, most recent first.
      </p>
      <ul className="bg-card divide-y rounded-xl border">
        {comments.map((comment) => (
          <li key={comment.id} className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="text-muted-foreground">On</span>
                <Link
                  href={
                    postPath(comment.postSlug) +
                    (comment.status === "approved"
                      ? `#comment-${comment.id}`
                      : "")
                  }
                  className="font-display hover:text-primary text-lg leading-snug"
                >
                  {comment.postTitle}
                </Link>
                {comment.status !== "approved" && (
                  <Badge variant="outline">
                    {STATUS_LABELS[comment.status]}
                  </Badge>
                )}
              </div>
              <DeleteCommentButton
                commentId={comment.id}
                postTitle={comment.postTitle}
              />
            </div>
            <CommentBody
              text={comment.body}
              className="text-muted-foreground line-clamp-4 text-sm"
            />
            <p className="text-muted-foreground text-xs">
              {formatRelative(comment.createdAt)}
            </p>
          </li>
        ))}
      </ul>
      <Pagination
        page={page}
        pageCount={pageCount}
        basePath="/account/comments"
      />
    </section>
  );
}
