/** Upload rules shared by the browser (early feedback) and server (enforcement). */

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Raster images only. SVG is excluded on purpose: it can carry scripts, and
 * serving user-uploaded SVG safely needs a separate sanitization step.
 */
export const MEDIA_MIME_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
} as const;

export type MediaMimeType = keyof typeof MEDIA_MIME_TYPES;

export const MEDIA_ACCEPT = Object.keys(MEDIA_MIME_TYPES).join(",");

export function isMediaMimeType(value: string): value is MediaMimeType {
  return value in MEDIA_MIME_TYPES;
}

export function mimeTypeForExtension(ext: string): MediaMimeType | undefined {
  return (Object.keys(MEDIA_MIME_TYPES) as MediaMimeType[]).find(
    (type) => MEDIA_MIME_TYPES[type] === ext,
  );
}

/** Storage keys look like media/2026/09/<uuid>.webp — nothing else is accepted. */
export const MEDIA_KEY_PATTERN =
  /^media\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|avif)$/;

export function isMediaKey(value: unknown): value is string {
  return typeof value === "string" && MEDIA_KEY_PATTERN.test(value);
}

export function newMediaKey(type: MediaMimeType, now = new Date()) {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `media/${yyyy}/${mm}/${crypto.randomUUID()}.${MEDIA_MIME_TYPES[type]}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
