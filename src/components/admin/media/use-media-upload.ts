"use client";

import { useState } from "react";

import { completeUpload, requestUpload } from "@/app/admin/media/actions";
import {
  formatBytes,
  isMediaMimeType,
  MEDIA_MAX_BYTES,
} from "@/lib/media/constants";
import type { MediaItem } from "@/lib/media/types";

export type UploadState = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

const CONCURRENCY = 3;

async function imageSize(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

/** PUT with upload progress (fetch can't report upload progress). */
function put(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (fraction: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}

/**
 * Browser -> storage direct uploads: ask the server for a signed URL, PUT the
 * file straight to storage, then have the server verify and record it.
 */
export function useMediaUpload(onUploaded?: (item: MediaItem) => void) {
  const [uploads, setUploads] = useState<UploadState[]>([]);

  const patch = (id: string, next: Partial<UploadState>) =>
    setUploads((list) =>
      list.map((u) => (u.id === id ? { ...u, ...next } : u)),
    );

  async function uploadOne(file: File, id: string): Promise<MediaItem | null> {
    const fail = (error: string) => {
      patch(id, { status: "error", error });
      return null;
    };
    if (!isMediaMimeType(file.type)) {
      return fail("Unsupported type — use JPEG, PNG, WebP, GIF, or AVIF.");
    }
    if (file.size > MEDIA_MAX_BYTES) {
      return fail(`Larger than ${formatBytes(MEDIA_MAX_BYTES)}.`);
    }

    const target = await requestUpload({
      filename: file.name,
      contentType: file.type,
      size: file.size,
    });
    if (!target.ok) return fail(target.error);

    try {
      await put(target.data.url, target.data.headers, file, (progress) =>
        patch(id, { progress }),
      );
    } catch {
      return fail(
        "Upload failed. Check your connection (or the bucket's CORS).",
      );
    }

    const size = await imageSize(file);
    const saved = await completeUpload({
      key: target.data.key,
      filename: file.name,
      contentType: file.type,
      width: size?.width ?? null,
      height: size?.height ?? null,
    });
    if (!saved.ok) return fail(saved.error);

    patch(id, { status: "done", progress: 1 });
    onUploaded?.(saved.data);
    return saved.data;
  }

  async function upload(files: File[]) {
    const queue = files.map((file) => ({ file, id: crypto.randomUUID() }));
    setUploads((list) => [
      ...list,
      ...queue.map(({ file, id }) => ({
        id,
        name: file.name,
        progress: 0,
        status: "uploading" as const,
      })),
    ]);
    const results: (MediaItem | null)[] = [];
    const workers = Array.from(
      { length: Math.min(CONCURRENCY, queue.length) },
      async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          results.push(await uploadOne(next.file, next.id));
        }
      },
    );
    await Promise.all(workers);
    return results.filter((r): r is MediaItem => r !== null);
  }

  function dismiss(id: string) {
    setUploads((list) => list.filter((u) => u.id !== id));
  }

  function clearFinished() {
    setUploads((list) => list.filter((u) => u.status === "uploading"));
  }

  return { uploads, upload, dismiss, clearFinished };
}
