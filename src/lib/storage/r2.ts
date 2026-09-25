import "server-only";

import { AwsClient } from "aws4fetch";

import { env } from "@/env";

import type { StorageDriver } from "./types";

/** Presigned PUT lifetime. Long enough for a 10 MB upload on a slow link. */
const UPLOAD_TTL_SECONDS = 10 * 60;

/**
 * Cloudflare R2 via its S3-compatible API. Browsers upload straight to R2
 * with a presigned PUT (the file never passes through our server); objects
 * are served from the bucket's public URL (r2.dev or a custom domain).
 */
export function createR2Driver(): StorageDriver {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_PUBLIC_URL,
  } = env;
  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET ||
    !R2_PUBLIC_URL
  ) {
    throw new Error(
      "STORAGE_DRIVER=r2 needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_PUBLIC_URL.",
    );
  }

  const client = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;
  const publicBase = R2_PUBLIC_URL.replace(/\/+$/, "");
  const objectUrl = (key: string) =>
    `${endpoint}/${key.split("/").map(encodeURIComponent).join("/")}`;

  return {
    name: "r2",

    async createUpload(key, contentType) {
      const url = new URL(objectUrl(key));
      url.searchParams.set("X-Amz-Expires", String(UPLOAD_TTL_SECONDS));
      // allHeaders signs content-type too, so R2 rejects any other type.
      const signed = await client.sign(
        new Request(url, {
          method: "PUT",
          headers: { "content-type": contentType },
        }),
        { aws: { signQuery: true, allHeaders: true } },
      );
      return { url: signed.url, headers: { "content-type": contentType } };
    },

    async stat(key) {
      const res = await client.fetch(objectUrl(key), { method: "HEAD" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 HEAD failed: ${res.status}`);
      return {
        size: Number(res.headers.get("content-length") ?? 0),
        contentType: res.headers.get("content-type"),
      };
    },

    async delete(key) {
      const res = await client.fetch(objectUrl(key), { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        throw new Error(`R2 DELETE failed: ${res.status}`);
      }
    },

    publicUrl(key) {
      return `${publicBase}/${key}`;
    },
  };
}
