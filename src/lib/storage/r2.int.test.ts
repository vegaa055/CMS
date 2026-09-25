/**
 * Live Cloudflare R2 check: presigned upload, public read, signed
 * content-type enforcement, delete. Runs only when STORAGE_DRIVER=r2.
 * Server-side fetch doesn't exercise CORS; the Playwright media test does.
 */
import { describe, expect, it, vi } from "vitest";

import { newMediaKey } from "@/lib/media/constants";

vi.mock("server-only", () => ({}));

const enabled = process.env.STORAGE_DRIVER === "r2";

// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

describe.runIf(enabled)("Cloudflare R2 driver (live)", () => {
  it("uploads with a presigned URL, serves publicly, and deletes", async () => {
    const { createR2Driver } = await import("./r2");
    const r2 = createR2Driver();
    const key = newMediaKey("image/png");

    const target = await r2.createUpload(key, "image/png");
    expect(target.url).toContain("X-Amz-Signature");

    const put = await fetch(target.url, {
      method: "PUT",
      headers: target.headers,
      body: new Uint8Array(PNG),
    });
    expect(put.status, await put.clone().text()).toBe(200);

    try {
      expect(await r2.stat(key)).toEqual({
        size: PNG.length,
        contentType: "image/png",
      });

      const pub = await fetch(r2.publicUrl(key));
      expect(pub.status).toBe(200);
      expect(Buffer.from(await pub.arrayBuffer())).toEqual(PNG);
    } finally {
      await r2.delete(key);
    }
    expect(await r2.stat(key)).toBeNull();
  });

  it("rejects uploads whose content type differs from the signed one", async () => {
    const { createR2Driver } = await import("./r2");
    const r2 = createR2Driver();
    const key = newMediaKey("image/png");
    const target = await r2.createUpload(key, "image/png");

    const put = await fetch(target.url, {
      method: "PUT",
      headers: { "content-type": "text/html" },
      body: "<script>alert(1)</script>",
    });
    expect(put.status).toBe(403);
    expect(await r2.stat(key)).toBeNull();
  });
});
