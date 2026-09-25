import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { env } from "@/env";
import {
  isMediaKey,
  MEDIA_MAX_BYTES,
  mimeTypeForExtension,
} from "@/lib/media/constants";

import type { StorageDriver } from "./types";

/**
 * Development storage: files under ./.uploads, uploads PUT to our own
 * signed route (/api/storage/local), served from /uploads/<key>.
 * Mirrors the R2 flow so the UI code is identical. Not for production:
 * serverless filesystems are ephemeral.
 */

const ROOT = path.join(process.cwd(), ".uploads");
const UPLOAD_TTL_SECONDS = 10 * 60;

function filePath(key: string) {
  if (!isMediaKey(key)) throw new Error("Invalid media key");
  const resolved = path.resolve(ROOT, key);
  if (!resolved.startsWith(ROOT + path.sep))
    throw new Error("Invalid media key");
  return resolved;
}

function sign(key: string, contentType: string, expires: number) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`local-upload:${key}:${contentType}:${expires}`)
    .digest("base64url");
}

/** Validate a signed local upload URL's query parameters. */
export function verifyLocalUpload(params: URLSearchParams, now = Date.now()) {
  const key = params.get("key") ?? "";
  const type = params.get("type") ?? "";
  const expires = Number(params.get("expires"));
  const signature = params.get("sig") ?? "";
  if (!isMediaKey(key) || !Number.isFinite(expires) || expires * 1000 < now) {
    return null;
  }
  const expected = Buffer.from(sign(key, type, expires));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  return { key, contentType: type };
}

/** Stream a request body to disk, refusing anything over the size limit. */
export async function writeLocalObject(
  key: string,
  body: ReadableStream<Uint8Array>,
) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MEDIA_MAX_BYTES) {
      await reader.cancel();
      throw new Error("File too large");
    }
    chunks.push(value);
  }
  const target = filePath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.concat(chunks));
  return size;
}

/** Open a stored file for serving, or null if missing. */
export async function readLocalObject(key: string) {
  const target = filePath(key);
  try {
    const info = await stat(target);
    return {
      size: info.size,
      contentType: mimeTypeForExtension(path.extname(key).slice(1)) ?? null,
      body: Readable.toWeb(createReadStream(target)) as ReadableStream,
    };
  } catch {
    return null;
  }
}

export const localStorageDriver: StorageDriver = {
  name: "local",

  async createUpload(key, contentType) {
    const expires = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS;
    const query = new URLSearchParams({
      key,
      type: contentType,
      expires: String(expires),
      sig: sign(key, contentType, expires),
    });
    return {
      url: `/api/storage/local?${query}`,
      headers: { "content-type": contentType },
    };
  },

  async stat(key) {
    try {
      const info = await stat(filePath(key));
      return {
        size: info.size,
        contentType: mimeTypeForExtension(path.extname(key).slice(1)) ?? null,
      };
    } catch {
      return null;
    }
  },

  async delete(key) {
    await rm(filePath(key), { force: true });
  },

  publicUrl(key) {
    return `/uploads/${key}`;
  },
};
