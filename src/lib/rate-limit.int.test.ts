/** App rate limiter against the real `rate_limit` table. */
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { rateLimit } from "@/db/schema";

import { consumeRateLimit } from "./rate-limit";

vi.mock("server-only", () => ({}));

const KEY = `int-rl-${Date.now()}`;
const rule = { max: 3, windowMs: 60_000 };

const cleanup = () =>
  db.delete(rateLimit).where(like(rateLimit.key, "app:int-rl-%"));
beforeAll(cleanup);
afterAll(cleanup);

describe("consumeRateLimit", () => {
  it("allows up to the limit within a window", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consumeRateLimit(KEY, rule));
    expect(results).toEqual([true, true, true, false]);
  });

  it("counts concurrent calls exactly", async () => {
    const key = `${KEY}-burst`;
    const results = await Promise.all(
      Array.from({ length: 6 }, () => consumeRateLimit(key, rule)),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
  });

  it("starts a fresh window once the old one has passed", async () => {
    // Pretend the window started two minutes ago.
    await db
      .update(rateLimit)
      .set({ lastRequest: Date.now() - 120_000 })
      .where(eq(rateLimit.key, `app:${KEY}`));
    expect(await consumeRateLimit(KEY, rule)).toBe(true);
    const [row] = await db
      .select({ count: rateLimit.count })
      .from(rateLimit)
      .where(eq(rateLimit.key, `app:${KEY}`));
    expect(row?.count).toBe(1);
  });
});
