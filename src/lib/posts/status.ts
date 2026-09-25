export const POST_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "archived",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/**
 * A scheduled post whose publish time has passed is live. There's no cron job
 * flipping the stored status, so every reader goes through this.
 */
export function effectiveStatus(
  status: PostStatus,
  publishedAt: Date | string | null,
  now = new Date(),
): PostStatus {
  if (status === "scheduled" && publishedAt && new Date(publishedAt) <= now) {
    return "published";
  }
  return status;
}

const WORDS_PER_MINUTE = 225;

export function readingTime(words: number) {
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
