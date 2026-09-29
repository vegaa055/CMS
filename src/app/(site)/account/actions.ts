"use server";

import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { db } from "@/db";
import { user } from "@/db/schema";
import {
  fail,
  ok,
  zodFieldErrors,
  type ActionResult,
} from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { isStaff } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { getCommentedPostSlugs } from "@/lib/queries/comments";
import { revalidatePost, revalidatePublicSite } from "@/lib/revalidate";
import {
  accountNameSchema,
  newPasswordSchema,
  passwordSchema,
} from "@/lib/validation/profile";

/*
 * Changes any signed-in user (readers included) can make to their own
 * account. Email changes and account deletion go straight to Better Auth
 * from the browser; both are tied to the session.
 */

const EXPIRED = "Your session expired. Sign in again.";

/** Better Auth's breached-password rejection, if that's what this is. */
function isBreached(error: APIError) {
  return (
    (error.body as { code?: string } | undefined)?.code ===
    "PASSWORD_COMPROMISED"
  );
}

export async function updateName(raw: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail(EXPIRED);
  const parsed = accountNameSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      "Please fix the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }
  await db
    .update(user)
    .set({ name: parsed.data.name })
    .where(eq(user.id, session.user.id));
  revalidatePath("/account");
  // Team members' names appear in bylines; everyone's, on their comments.
  if (isStaff(session.user.role)) revalidatePublicSite();
  else {
    for (const slug of await getCommentedPostSlugs(session.user.id)) {
      revalidatePost(slug);
    }
  }
  return ok(null);
}

export async function changePassword(raw: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail(EXPIRED);
  const parsed = passwordSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      "Please fix the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }
  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        // Sign out everywhere else; this session gets a fresh token.
        revokeOtherSessions: true,
      },
      headers: new Headers(await headers()),
    });
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    if (/invalid password/i.test(error.message)) {
      return fail("Current password is incorrect.", {
        currentPassword: "Incorrect password",
      });
    }
    if (isBreached(error)) {
      return fail(error.message, { newPassword: "Found in a data breach" });
    }
    return fail(error.message || "Couldn't change your password.");
  }
  revalidatePath("/account");
  return ok(null);
}

/** A first password for an account that has only signed in with GitHub. */
export async function setPassword(raw: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail(EXPIRED);
  const parsed = newPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      "Please fix the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }
  try {
    await auth.api.setPassword({
      body: { newPassword: parsed.data.newPassword },
      headers: new Headers(await headers()),
    });
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    if (isBreached(error)) {
      return fail(error.message, { newPassword: "Found in a data breach" });
    }
    return fail(error.message || "Couldn't set your password.");
  }
  revalidatePath("/account");
  return ok(null);
}
