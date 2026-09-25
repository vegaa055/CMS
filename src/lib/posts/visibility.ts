import { and, inArray, isNotNull, lte } from "drizzle-orm";

import { posts } from "@/db/schema";

/** SQL condition for posts visible on the public site. See `effectiveStatus`. */
export function livePostWhere(now = new Date()) {
  return and(
    inArray(posts.status, ["published", "scheduled"]),
    isNotNull(posts.publishedAt),
    lte(posts.publishedAt, now),
  );
}
