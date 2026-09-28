import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";

import { siteConfig } from "@/config/site";
import { db } from "@/db";
import { invitation, user } from "@/db/schema";

export const INVITE_TTL_DAYS = 7;

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function inviteUrl(token: string) {
  return new URL(`/invite/${token}`, siteConfig.url).href;
}

/** A pending, unexpired invitation for this raw token, or undefined. */
export async function findValidInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return undefined;
  const [row] = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.tokenHash, hashInviteToken(token)),
        isNull(invitation.acceptedAt),
        gt(invitation.expiresAt, new Date()),
      ),
    );
  return row;
}

/** Whether an account already uses this email (invite emails are lowercase). */
export async function accountExists(email: string) {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.toLowerCase()))
    .limit(1);
  return Boolean(row);
}
