import { env } from "@/env";
import { verifyLocalUpload, writeLocalObject } from "@/lib/storage/local";

/**
 * Receives browser uploads for the local storage driver. Authorization is the
 * short-lived HMAC signature issued by the `requestUpload` server action,
 * exactly like an R2 presigned URL.
 */
export async function PUT(request: Request) {
  if (env.STORAGE_DRIVER !== "local") {
    return new Response("Not found", { status: 404 });
  }
  const upload = verifyLocalUpload(new URL(request.url).searchParams);
  if (!upload)
    return new Response("Invalid or expired upload URL", { status: 403 });
  if (request.headers.get("content-type") !== upload.contentType) {
    return new Response("Content-Type does not match", { status: 400 });
  }
  if (!request.body) return new Response("Empty body", { status: 400 });

  try {
    await writeLocalObject(upload.key, request.body);
  } catch (error) {
    return new Response((error as Error).message, { status: 413 });
  }
  return new Response(null, { status: 201 });
}
