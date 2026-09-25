import type { PostStatus } from "./status";

/**
 * Decide the stored status and publish date for a save request.
 * - "published" keeps an existing publish date unless a new one is given;
 *   a future date turns it into "scheduled".
 * - "scheduled" needs a date; a past date publishes immediately.
 * - "draft" clears the date; "archived" keeps it.
 */
export function resolvePublishing(
  requested: PostStatus,
  requestedAt: string | null | undefined,
  previous: { status: PostStatus; publishedAt: Date | null } | undefined,
  now = new Date(),
): { status: PostStatus; publishedAt: Date | null } | { error: string } {
  const at = requestedAt ? new Date(requestedAt) : null;
  switch (requested) {
    case "draft":
      return { status: "draft", publishedAt: null };
    case "archived":
      return { status: "archived", publishedAt: previous?.publishedAt ?? null };
    case "scheduled":
      if (!at) return { error: "Pick a date and time to schedule." };
      return { status: at <= now ? "published" : "scheduled", publishedAt: at };
    case "published": {
      const publishedAt = at ?? previous?.publishedAt ?? now;
      return {
        status: publishedAt > now ? "scheduled" : "published",
        publishedAt,
      };
    }
  }
}
