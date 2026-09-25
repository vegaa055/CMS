import type { MediaMimeType } from "@/lib/media/constants";

export type UploadTarget = {
  /** Where the browser PUTs the file. */
  url: string;
  /** Headers the browser must send with the PUT (signed where supported). */
  headers: Record<string, string>;
};

export type StoredObject = { size: number; contentType: string | null };

/** Minimal object-storage contract; see `local.ts` and `r2.ts`. */
export interface StorageDriver {
  readonly name: "local" | "r2";
  /** A short-lived URL the browser can upload one object to directly. */
  createUpload(key: string, contentType: MediaMimeType): Promise<UploadTarget>;
  /** Size/type of a stored object, or null if it doesn't exist. */
  stat(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  /** Public URL for serving the object. */
  publicUrl(key: string): string;
}
