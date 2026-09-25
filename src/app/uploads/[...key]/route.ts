import { env } from "@/env";
import { isMediaKey } from "@/lib/media/constants";
import { readLocalObject } from "@/lib/storage/local";

/** Serves files for the local storage driver (dev only). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/uploads/[...key]">,
) {
  const key = (await params).key.join("/");
  if (env.STORAGE_DRIVER !== "local" || !isMediaKey(key)) {
    return new Response("Not found", { status: 404 });
  }
  const file = await readLocalObject(key);
  if (!file?.contentType) return new Response("Not found", { status: 404 });

  return new Response(file.body, {
    headers: {
      "content-type": file.contentType,
      "content-length": String(file.size),
      // Keys are unique per upload, so content never changes.
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
