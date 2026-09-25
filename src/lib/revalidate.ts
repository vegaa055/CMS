import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Invalidate every cached public page (home, archives, posts, tags, feed,
 * sitemap). Content changes can touch many pages at once (lists, related
 * posts, tag counts), so the whole site is refreshed; pages also revalidate
 * on a timer so scheduled posts appear without a cron job.
 */
export function revalidatePublicSite() {
  revalidatePath("/", "layout");
}
