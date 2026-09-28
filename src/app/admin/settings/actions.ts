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
import { saveReaderSettings, saveSiteSettings } from "@/lib/settings";
import {
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
