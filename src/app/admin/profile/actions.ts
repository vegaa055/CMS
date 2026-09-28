"use server";

import { eq } from "drizzle-orm";
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
import { isStaff } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { revalidatePublicSite } from "@/lib/revalidate";
import { profileSchema } from "@/lib/validation/profile";

/**
 * Author profile (username and bio publish an author page), so team only:
 * a reader must not be able to create a public page for themselves.
 */
export async function updateProfile(raw: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Your session expired. Sign in again.");
  if (!isStaff(session.user.role)) {
    return fail("Only team members have an author profile.");
  }
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
