import {
  ArrowUpRight,
  CalendarClock,
  FileCheck2,
  FilePen,
  ImageIcon,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

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
import { requireSession } from "@/lib/auth/session";
import { formatRelative } from "@/lib/format";
import { getDashboardStats, getRecentPosts } from "@/lib/queries/admin";

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
  const session = await requireSession();
  const { user } = session;
  const [stats, recent] = await Promise.all([
    getDashboardStats(session),
    getRecentPosts(session),
  ]);

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
            label: "Users",
            value: stats.users,
            icon: Users,
            href: "/admin/users",
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
          <CardTitle>Recently updated</CardTitle>
          <CardDescription>
            {can(user.role, "post:update:any")
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
    </>
  );
}
