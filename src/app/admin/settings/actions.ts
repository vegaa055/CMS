"use server";

import { revalidatePath } from "next/cache";

import {
  fail,
  ok,
  zodFieldErrors,
  type ActionResult,
} from "@/lib/action-result";
import { can } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { revalidatePublicSite } from "@/lib/revalidate";
import {
  saveCommentSettings,
  saveReaderSettings,
  saveSiteSettings,
} from "@/lib/settings";
import {
  commentSettingsSchema,
  readerSettingsSchema,
  siteSettingsSchema,
} from "@/lib/validation/settings";

async function authorize() {
  const session = await getSession();
  return session && can(session.user.role, "settings:manage") ? session : null;
}

export async function updateSiteSettings(raw: unknown): Promise<ActionResult> {
  if (!(await authorize())) {
    return fail("You don't have permission to change site settings.");
  }
  const parsed = siteSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      "Please fix the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }
  await saveSiteSettings(parsed.data);
  // Name/tagline appear in every page's metadata, header, feed, and OG images.
  revalidatePublicSite();
  return ok(null);
}

export async function updateReaderSettings(
  raw: unknown,
): Promise<ActionResult> {
  if (!(await authorize())) {
    return fail("You don't have permission to change site settings.");
  }
  const parsed = readerSettingsSchema.safeParse(raw);
  if (!parsed.success) return fail("Invalid reader settings.");
  await saveReaderSettings(parsed.data);
  // Sign-in and sign-up pages are dynamic; the Readers tab shows the state.
  revalidatePath("/admin", "layout");
  return ok(null);
}

export async function updateCommentSettings(
  raw: unknown,
): Promise<ActionResult> {
  if (!(await authorize())) {
    return fail("You don't have permission to change site settings.");
  }
  const parsed = commentSettingsSchema.safeParse(raw);
  if (!parsed.success) return fail("Invalid comment settings.");
  await saveCommentSettings(parsed.data);
  // Every cached post page shows whether comments are open.
  revalidatePublicSite();
  return ok(null);
}
