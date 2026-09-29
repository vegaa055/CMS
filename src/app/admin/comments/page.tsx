import { CheckCheck, MessageSquare, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ModerationQueue } from "@/components/admin/comments/moderation-queue";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { parsePage } from "@/components/site/pagination";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import type { CommentStatus } from "@/lib/comments";
import { getCommentCounts, getModerationQueue } from "@/lib/queries/comments";
import { getCommentSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Comments" };

const BASE = "/admin/comments";

const TABS: { status: CommentStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "approved", label: "Approved" },
  { status: "spam", label: "Spam" },
];

const EMPTY: Record<
  CommentStatus,
  { icon: typeof MessageSquare; title: string; description: string }
> = {
  pending: {
    icon: CheckCheck,
    title: "All caught up",
    description: "New comments that need approval show up here.",
  },
  approved: {
    icon: MessageSquare,
    title: "No comments yet",
    description: "Published comments show up here, newest first.",
  },
  spam: {
    icon: ShieldCheck,
    title: "No spam",
    description: "Comments you mark as spam are kept here, hidden from posts.",
  },
};

function tabHref(status: CommentStatus, page = 1) {
  const params = new URLSearchParams();
  if (status !== "pending") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  return params.size ? `${BASE}?${params}` : BASE;
}

export default async function CommentsPage({
  searchParams,
}: PageProps<"/admin/comments">) {
  const { user } = await requirePermission("comment:moderate");
  const params = await searchParams;
  const status = params.status ?? "pending";
  const tab = TABS.find((t) => t.status === status);
  const page = parsePage(params.page);
  if (!tab || !page) notFound();

  const [queue, counts, settings] = await Promise.all([
    getModerationQueue({ status: tab.status, page }),
    getCommentCounts(),
    getCommentSettings(),
  ]);
  // e.g. the last comment on the last page was just approved.
  if (page > queue.pageCount) redirect(tabHref(tab.status, queue.pageCount));
  const empty = EMPTY[tab.status];

  return (
    <>
      <PageHeader
        title="Comments"
        description="Approve comments that wait for review, and remove spam. Only approved comments appear on posts."
      />
      {!settings.enabled && (
        <p className="bg-muted text-muted-foreground rounded-lg px-4 py-3 text-sm">
          Comments are off, so no one can add new ones.{" "}
          {can(user.role, "settings:manage") ? (
            <Link
              href="/admin/settings"
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              Turn them on in Settings
            </Link>
          ) : (
            "An admin can turn them on in Settings."
          )}
        </p>
      )}
      <nav
        aria-label="Comment queues"
        className="bg-muted text-muted-foreground inline-flex w-fit items-center gap-1 rounded-lg p-1"
      >
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={tabHref(t.status)}
            aria-current={t.status === tab.status ? "page" : undefined}
            className={cn(
              "hover:text-foreground inline-flex items-center gap-2 rounded-md px-3 py-1 text-sm font-medium transition-colors",
              t.status === tab.status &&
                "bg-background text-foreground shadow-sm",
            )}
          >
            {t.label}
            <span className="text-muted-foreground text-xs tabular-nums">
              {counts[t.status]}
            </span>
          </Link>
        ))}
      </nav>

      {queue.rows.length === 0 ? (
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
        />
      ) : (
        <ModerationQueue comments={queue.rows} />
      )}

      {queue.pageCount > 1 && (
        <nav
          aria-label="Pagination"
          className="text-muted-foreground flex items-center justify-between gap-2 text-sm"
        >
          <span>
            Page {page} of {queue.pageCount} · {queue.total} comments
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={tabHref(tab.status, page - 1)} rel="prev">
                  Previous
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            )}
            {page < queue.pageCount ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={tabHref(tab.status, page + 1)} rel="next">
                  Next
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
