import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { rateLimit } from "@/db/schema";

/**
 * Fixed-window limiter for app-level actions, stored in the same
 * `rate_limit` table as Better Auth's counters (its keys are `<ip><path>`;
 * ours are prefixed `app:`). One atomic upsert, so concurrent calls can't
 * both slip under the limit. Returns whether this call is allowed.
 *
 * `last_request` holds the start of the current window for these keys.
 */
export async function consumeRateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const [row] = await db
    .insert(rateLimit)
    .values({
      id: crypto.randomUUID(),
      key: `app:${key}`,
      count: 1,
      lastRequest: now,
    })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${rateLimit.lastRequest} < ${windowStart} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${rateLimit.lastRequest} < ${windowStart} then ${now} else ${rateLimit.lastRequest} end`,
      },
    })
    .returning({ count: rateLimit.count });
  return (row?.count ?? 1) <= max;
}
