import "server-only";

import { and, count, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { comments, postLikes, posts, user } from "@/db/schema";
import { can } from "@/lib/auth/permissions";
import type { AppSession } from "@/lib/auth/session";

/** Eight rolling 7-day periods, so the latest is never a partial week. */
export const PERIODS = 8;
const DAY_MS = 86_400_000;

/** Which period (0 = the last 7 days) a timestamp falls in. */
const period = (column: AnyPgColumn) =>
  sql<number>`floor(extract(epoch from (now() - ${column})) / 604800)::int`;
const recent = (column: AnyPgColumn) =>
  sql`${column} >= now() - interval '56 days'`;

/** Counts per period, oldest first. */
function toSeries(rows: { period: number; value: number }[]) {
  const counts = Array<number>(PERIODS).fill(0);
  for (const row of rows) {
    if (row.period >= 0 && row.period < PERIODS) counts[row.period] = row.value;
  }
  return counts.reverse();
}

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "Sep 22 – Sep 28" for each period, oldest first (UTC days). */
export function periodLabels(now = new Date()) {
  return Array.from({ length: PERIODS }, (_, i) => {
    const back = PERIODS - 1 - i;
    const end = new Date(now.getTime() - back * 7 * DAY_MS);
    const start = new Date(end.getTime() - 6 * DAY_MS);
    return `${shortDate.format(start)} – ${shortDate.format(end)}`;
  });
}

/**
 * New readers, likes, and published comments per 7-day period over the last
 * eight. Editors and admins see the whole site; authors see likes and
 * comments on their own posts. Reader sign-ups are for admins only.
 */
export async function getWeeklyActivity(session: AppSession) {
  const { user: viewer } = session;
  const ownPosts: SQL | undefined = can(viewer.role, "post:update:any")
    ? undefined
    : eq(posts.authorId, viewer.id);

  const [readers, likes, published] = await Promise.all([
    can(viewer.role, "user:manage")
      ? db
          .select({ period: period(user.createdAt), value: count() })
          .from(user)
          .where(and(eq(user.role, "reader"), recent(user.createdAt)))
          .groupBy(sql`1`)
      : null,
    db
      .select({ period: period(postLikes.createdAt), value: count() })
      .from(postLikes)
      .innerJoin(posts, eq(posts.id, postLikes.postId))
      .where(and(recent(postLikes.createdAt), ownPosts))
      .groupBy(sql`1`),
    db
      .select({ period: period(comments.createdAt), value: count() })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .where(
        and(
          eq(comments.status, "approved"),
          isNull(comments.deletedAt),
          recent(comments.createdAt),
          ownPosts,
        ),
      )
      .groupBy(sql`1`),
  ]);

  return {
    labels: periodLabels(),
    readers: readers ? toSeries(readers) : null,
    likes: toSeries(likes),
    comments: toSeries(published),
  };
}
