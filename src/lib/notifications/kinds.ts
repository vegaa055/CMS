/** The notification emails people can turn on and off (client-safe). */
export const NOTIFICATION_KINDS = [
  "replies",
  "post-comments",
  "digest",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** As in "Stop emails about …". */
export const NOTIFICATION_LABELS: Record<NotificationKind, string> = {
  replies: "replies to your comments",
  "post-comments": "new comments on your posts",
  digest: "the daily summary of comments to review",
};
