import {
  ArrowUpRight,
  CalendarClock,
  FileCheck2,
  FilePen,
  Heart,
  ImageIcon,
  Tags,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ActivityTiles } from "@/components/admin/activity-tiles";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formatRelative } from "@/lib/format";
import { postPath } from "@/lib/posts/urls";
import {
  getDashboardMostLiked,
  getDashboardStats,
  getRecentPosts,
} from "@/lib/queries/admin";
import { getWeeklyActivity } from "@/lib/queries/stats";

export const metadata: Metadata = { title: "Dashboard" };

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  href: string;
}) {
  return (
    <Link href={href} className="group rounded-xl focus-visible:outline-2">
      <Card className="group-hover:ring-primary/50 transition-shadow">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardAction>
            <Icon className="text-muted-foreground group-hover:text-primary size-4 transition-colors" />
          </CardAction>
          <CardTitle className="font-display text-4xl font-normal tabular-nums">
            {value}
          </CardTitle>
        </CardHeader>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await requirePermission("dashboard:view");
  const { user } = session;
  const [stats, recent, mostLiked, activity] = await Promise.all([
    getDashboardStats(session),
    getRecentPosts(session),
    getDashboardMostLiked(session),
    getWeeklyActivity(session),
  ]);
  const sitewide = can(user.role, "post:update:any");
  const activitySeries = [
    ...(activity.readers
      ? [
          {
            label: "New readers",
            unit: ["new reader", "new readers"] as [string, string],
            counts: activity.readers,
          },
        ]
      : []),
    {
      label: "Likes",
      unit: ["like", "likes"] as [string, string],
      counts: activity.likes,
    },
    {
      label: "Comments",
      unit: ["comment", "comments"] as [string, string],
      counts: activity.comments,
    },
  ];

  const statCards = [
    {
      label: "Published",
      value: stats.published,
      icon: FileCheck2,
      href: "/admin/posts",
    },
    {
      label: "Drafts",
      value: stats.drafts,
      icon: FilePen,
      href: "/admin/posts",
    },
    {
      label: "Scheduled",
      value: stats.scheduled,
      icon: CalendarClock,
      href: "/admin/posts",
    },
    {
      label: "Media",
      value: stats.media,
      icon: ImageIcon,
      href: "/admin/media",
    },
    ...(can(user.role, "tag:manage")
      ? [{ label: "Tags", value: stats.tags, icon: Tags, href: "/admin/tags" }]
      : []),
    ...(can(user.role, "user:manage")
      ? [
          {
            label: "Readers",
            value: stats.readers,
            icon: UsersRound,
            href: "/admin/users/readers",
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(" ")[0]}`}
        description="Here's what's happening with your content."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last 7 days</CardTitle>
          <CardDescription>
            {sitewide
              ? "Readers, likes, and published comments across the site, compared with the 7 days before."
              : "Likes and published comments on your posts, compared with the 7 days before."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityTiles series={activitySeries} labels={activity.labels} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recently updated</CardTitle>
            <CardDescription>
              {sitewide
                ? "Latest changes across the site."
                : "Your latest changes."}
            </CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/posts">
                  All posts <ArrowUpRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {recent.length ? (
              <ul className="-mx-2 divide-y">
                {recent.map((post) => (
                  <li
                    key={post.id}
                    className="flex items-center justify-between gap-4 px-2 py-3"
                  >
                    <div className="flex min-w-0 flex-col">
                      <Link
                        href={`/admin/posts/${post.id}`}
                        className="truncate font-medium hover:underline"
                      >
                        {post.title || "Untitled"}
                      </Link>
                      <span className="text-muted-foreground text-xs">
                        {post.author?.name ?? "Unknown author"} · updated{" "}
                        {formatRelative(post.updatedAt)}
                      </span>
                    </div>
                    <StatusBadge status={post.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={FilePen}
                title="No posts yet"
                description="Posts you write will show up here."
              />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Most liked</CardTitle>
            <CardDescription>
              {sitewide
                ? "Readers' favorites across the site."
                : "Your posts readers like most."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mostLiked.length ? (
              <ol className="-mx-2 divide-y">
                {mostLiked.map((post) => (
                  <li
                    key={post.id}
                    className="flex items-center justify-between gap-4 px-2 py-3"
                  >
                    <Link
                      href={postPath(post.slug)}
                      className="truncate font-medium hover:underline"
                    >
                      {post.title}
                    </Link>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-sm tabular-nums">
                      <Heart className="size-3.5" aria-hidden />
                      <span className="sr-only">Likes:</span>
                      {post.likes}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                icon={Heart}
                title="No likes yet"
                description="When readers like posts, the favorites show up here."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
