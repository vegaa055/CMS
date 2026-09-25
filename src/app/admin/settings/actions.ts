"use server";

import {
  fail,
  ok,
  zodFieldErrors,
  type ActionResult,
} from "@/lib/action-result";
import { can } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { revalidatePublicSite } from "@/lib/revalidate";
import { saveSiteSettings } from "@/lib/settings";
import { siteSettingsSchema } from "@/lib/validation/settings";

export async function updateSiteSettings(raw: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session || !can(session.user.role, "settings:manage")) {
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
