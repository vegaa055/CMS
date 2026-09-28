import "server-only";

import { and, count, eq, gt, ne } from "drizzle-orm";

import { db } from "@/db";
import { account, session } from "@/db/schema";

/** How someone signs in: a password, and/or linked providers (GitHub). */
export async function getSignInMethods(userId: string) {
  const rows = await db
    .select({ providerId: account.providerId, password: account.password })
    .from(account)
    .where(eq(account.userId, userId));
  return {
    hasPassword: rows.some((r) => r.providerId === "credential" && r.password),
    providers: rows
      .map((r) => r.providerId)
      .filter((provider) => provider !== "credential"),
  };
}

/** Unexpired sessions other than the current one (other devices). */
export async function countOtherSessions(userId: string, currentId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(session)
    .where(
      and(
        eq(session.userId, userId),
        ne(session.id, currentId),
        gt(session.expiresAt, new Date()),
      ),
    );
  return row?.value ?? 0;
}
