"use server";

import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { pgError, UNIQUE_VIOLATION } from "@/db/errors";
import { user } from "@/db/schema";
import {
  fail,
  ok,
  zodFieldErrors,
  type ActionResult,
} from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth/session";
import { revalidatePublicSite } from "@/lib/revalidate";
import { passwordSchema, profileSchema } from "@/lib/validation/profile";

export async function updateProfile(raw: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Your session expired. Sign in again.");
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      "Please fix the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }
  const { name, username, bio, image } = parsed.data;

  try {
    await db
      .update(user)
      .set({
        name,
        username: username || null,
        bio: bio || null,
        image: image || null,
      })
      .where(eq(user.id, session.user.id));
  } catch (error) {
    if (pgError(error).code === UNIQUE_VIOLATION) {
      return fail("That username is taken.", { username: "Already taken" });
    }
    throw error;
  }
  revalidatePath("/admin", "layout");
  // Bylines and author pages show these fields.
  revalidatePublicSite();
  return ok(null);
}

export async function changePassword(raw: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Your session expired. Sign in again.");
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
    if (error instanceof APIError) {
      const message = /invalid password/i.test(error.message)
        ? "Current password is incorrect."
        : error.message || "Couldn't change your password.";
      return fail(
        message,
        /invalid password/i.test(error.message)
          ? { currentPassword: "Incorrect password" }
          : undefined,
      );
    }
    throw error;
  }
  return ok(null);
}
