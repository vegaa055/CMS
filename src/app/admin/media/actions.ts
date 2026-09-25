"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { pgError, UNIQUE_VIOLATION } from "@/db/errors";
import { media } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { can, canManageMedia } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import {
  isMediaKey,
  isMediaMimeType,
  MEDIA_MAX_BYTES,
  newMediaKey,
  formatBytes,
} from "@/lib/media/constants";
import type { MediaItem } from "@/lib/media/types";
import { getMediaUsage, toMediaItem } from "@/lib/queries/media";
import { getStorage, type UploadTarget } from "@/lib/storage";

async function uploader() {
  const session = await getSession();
  return session && can(session.user.role, "media:upload") ? session : null;
}

const requestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string(),
  size: z.number().int().positive(),
});

/** Step 1: validate the file's metadata and hand out a direct-upload URL. */
export async function requestUpload(
  raw: unknown,
): Promise<ActionResult<UploadTarget & { key: string }>> {
  if (!(await uploader())) return fail("You don't have permission to upload.");
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return fail("Invalid upload request.");
  const { contentType, size } = parsed.data;

  if (!isMediaMimeType(contentType)) {
    return fail("Only JPEG, PNG, WebP, GIF, and AVIF images are supported.");
  }
  if (size > MEDIA_MAX_BYTES) {
    return fail(`Images must be ${formatBytes(MEDIA_MAX_BYTES)} or smaller.`);
  }

  const key = newMediaKey(contentType);
  const target = await getStorage().createUpload(key, contentType);
  return ok({ key, ...target });
}

const completeSchema = z.object({
  key: z.string().refine(isMediaKey, "Invalid key"),
  filename: z.string().trim().min(1).max(255),
  contentType: z.string(),
  width: z.number().int().positive().max(20_000).nullable().optional(),
  height: z.number().int().positive().max(20_000).nullable().optional(),
});

/**
 * Step 2: after the browser uploads, verify what actually landed in storage
 * (the presigned URL can't enforce size) and record it.
 */
export async function completeUpload(
  raw: unknown,
): Promise<ActionResult<MediaItem>> {
  const session = await uploader();
  if (!session) return fail("You don't have permission to upload.");
  const parsed = completeSchema.safeParse(raw);
  if (!parsed.success) return fail("Invalid upload.");
  const { key, filename, contentType, width, height } = parsed.data;

  const storage = getStorage();
  const stored = await storage.stat(key);
  if (!stored) return fail("The upload didn't finish. Try again.");

  const typeMismatch =
    !isMediaMimeType(contentType) ||
    (stored.contentType && stored.contentType !== contentType);
  if (stored.size > MEDIA_MAX_BYTES || stored.size === 0 || typeMismatch) {
    await storage.delete(key);
    return fail("The uploaded file was rejected (size or type mismatch).");
  }

  try {
    const [row] = await db
      .insert(media)
      .values({
        key,
        url: storage.publicUrl(key),
        filename,
        mimeType: contentType,
        size: stored.size,
        width: width ?? null,
        height: height ?? null,
        uploadedById: session.user.id,
      })
      .returning();
    revalidatePath("/admin/media");
    return ok(
      toMediaItem({ ...row!, uploaderName: session.user.name }, session),
    );
  } catch (error) {
    if (pgError(error).code === UNIQUE_VIOLATION) {
      return fail("This upload was already saved.");
    }
    throw error;
  }
}

async function loadManageable(id: string) {
  const session = await getSession();
  if (!session) return { error: fail("Your session expired. Sign in again.") };
  if (!z.uuid().safeParse(id).success)
    return { error: fail("Invalid media id.") };
  const [item] = await db
    .select({
      id: media.id,
      key: media.key,
      uploadedById: media.uploadedById,
    })
    .from(media)
    .where(eq(media.id, id));
  if (!item) return { error: fail("This file no longer exists.") };
  if (!canManageMedia(session.user, item)) {
    return { error: fail("You don't have permission to change this file.") };
  }
  return { session, item };
}

const altSchema = z
  .string()
  .trim()
  .max(300, "Keep alt text under 300 characters");

export async function updateMediaAlt(
  id: string,
  alt: unknown,
): Promise<ActionResult<{ alt: string | null }>> {
  const { error } = await loadManageable(id);
  if (error) return error;
  const parsed = altSchema.safeParse(alt);
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);

  const value = parsed.data || null;
  await db.update(media).set({ alt: value }).where(eq(media.id, id));
  revalidatePath("/admin/media");
  return ok({ alt: value });
}

/** Number of posts using a file, shown before deleting it. */
export async function mediaUsage(id: string): Promise<ActionResult<number>> {
  const { error, item } = await loadManageable(id);
  if (error) return error;
  return ok(await getMediaUsage(item.id, item.key));
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  const { error, item } = await loadManageable(id);
  if (error) return error;

  // Row first: if storage deletion fails we leave an orphaned object, not a
  // dangling record. Cover images referencing it are nulled by the FK.
  await db.delete(media).where(eq(media.id, item.id));
  try {
    await getStorage().delete(item.key);
  } catch (e) {
    console.error("[deleteMedia] storage delete failed:", item.key, e);
  }
  revalidatePath("/admin/media");
  revalidatePath("/");
  return ok(null);
}
