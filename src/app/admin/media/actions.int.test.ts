/**
 * Media upload flow against the real DB + local storage driver:
 * requestUpload -> PUT to the signed local route -> completeUpload.
 * Run with `npm run test:int`.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { savePost } from "@/app/admin/posts/actions";
import { PUT as localUpload } from "@/app/api/storage/local/route";
import { GET as serveUpload } from "@/app/uploads/[...key]/route";
import { db } from "@/db";
import { media, posts, user } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { MEDIA_MAX_BYTES } from "@/lib/media/constants";

import {
  completeUpload,
  deleteMedia,
  mediaUsage,
  requestUpload,
  updateMediaAlt,
} from "./actions";

// These tests exercise the local driver's signed upload route; R2 has its own
// live test (src/lib/storage/r2.int.test.ts). Set before any module reads env.
const originalDriver = vi.hoisted(() => {
  const value = process.env.STORAGE_DRIVER;
  process.env.STORAGE_DRIVER = "local";
  return value;
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

const AUTHOR = { id: "int-media-author", role: "author" as const };
const OTHER = { id: "int-media-other", role: "author" as const };
const EDITOR = { id: "int-media-editor", role: "editor" as const };

function actAs(u: typeof AUTHOR | typeof EDITOR) {
  vi.mocked(getSession).mockResolvedValue({
    user: { ...u, name: u.id, email: `${u.id}@folio.local` },
  } as never);
}

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const localFile = (key: string) => path.join(process.cwd(), ".uploads", key);

async function uploadPng(
  body: Buffer = PNG,
  type = "image/png",
  declaredSize = body.length,
) {
  const target = await requestUpload({
    filename: "pixel.png",
    contentType: "image/png",
    size: declaredSize,
  });
  if (!target.ok) throw new Error(target.error);
  const res = await localUpload(
    new Request(new URL(target.data.url, "http://localhost"), {
      method: "PUT",
      headers: { "content-type": type },
      body: new Uint8Array(body),
    }),
  );
  return { target: target.data, res };
}

const createdKeys: string[] = [];

async function cleanup() {
  const rows = await db
    .select({ id: media.id })
    .from(media)
    .where(inArray(media.uploadedById, [AUTHOR.id, OTHER.id, EDITOR.id]));
  actAs(EDITOR);
  for (const row of rows) await deleteMedia(row.id);
  await db.delete(posts).where(like(posts.slug, "int-media%"));
  await db
    .delete(user)
    .where(inArray(user.id, [AUTHOR.id, OTHER.id, EDITOR.id]));
}

beforeAll(async () => {
  await cleanup();
  await db.insert(user).values(
    [AUTHOR, OTHER, EDITOR].map((u) => ({
      id: u.id,
      role: u.role,
      name: u.id,
      email: `${u.id}@folio.local`,
    })),
  );
});

afterAll(async () => {
  await cleanup();
  process.env.STORAGE_DRIVER = originalDriver;
  for (const key of createdKeys) expect(existsSync(localFile(key))).toBe(false);
});

describe("media uploads (local driver)", () => {
  let itemId: string;
  let itemKey: string;

  it("rejects unsupported types and oversized files up front", async () => {
    actAs(AUTHOR);
    expect(
      (
        await requestUpload({
          filename: "x.svg",
          contentType: "image/svg+xml",
          size: 10,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await requestUpload({
          filename: "x.png",
          contentType: "image/png",
          size: MEDIA_MAX_BYTES + 1,
        })
      ).ok,
    ).toBe(false);
  });

  it("uploads, verifies, records, and serves a file", async () => {
    actAs(AUTHOR);
    const { target, res } = await uploadPng();
    expect(res.status).toBe(201);
    expect(target.key).toMatch(/^media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    createdKeys.push(target.key);

    const done = await completeUpload({
      key: target.key,
      filename: "pixel.png",
      contentType: "image/png",
      width: 1,
      height: 1,
    });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    itemId = done.data.id;
    itemKey = done.data.key;
    expect(done.data).toMatchObject({
      url: `/uploads/${target.key}`,
      size: PNG.length,
      canManage: true,
      uploadedBy: { id: AUTHOR.id },
    });

    const served = await serveUpload(new Request("http://localhost"), {
      params: Promise.resolve({ key: target.key.split("/") }),
    });
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await served.arrayBuffer())).toEqual(PNG);
  });

  it("refuses tampered signatures and mismatched content types", async () => {
    actAs(AUTHOR);
    const target = await requestUpload({
      filename: "p.png",
      contentType: "image/png",
      size: PNG.length,
    });
    if (!target.ok) throw new Error(target.error);
    const tampered = new URL(target.data.url, "http://localhost");
    const sig = tampered.searchParams.get("sig")!;
    // Always change the first character (a fixed replacement would be a
    // no-op whenever the signature already starts with it).
    tampered.searchParams.set(
      "sig",
      (sig[0] === "A" ? "B" : "A") + sig.slice(1),
    );
    const put = (url: URL, type: string) =>
      localUpload(
        new Request(url, {
          method: "PUT",
          headers: { "content-type": type },
          body: new Uint8Array(PNG),
        }),
      );

    expect((await put(tampered, "image/png")).status).toBe(403);
    const good = new URL(target.data.url, "http://localhost");
    expect((await put(good, "image/jpeg")).status).toBe(400);
  });

  it("rejects bodies over the size limit", async () => {
    actAs(AUTHOR);
    // Declare a small file, then send a big one: the signed URL can't stop
    // that, so the upload route must.
    const { target, res } = await uploadPng(
      Buffer.alloc(MEDIA_MAX_BYTES + 1),
      "image/png",
      PNG.length,
    );
    expect(res.status).toBe(413);
    expect(existsSync(localFile(target.key))).toBe(false);
  });

  it("won't record a file that never arrived or claims another type", async () => {
    actAs(AUTHOR);
    const target = await requestUpload({
      filename: "p.png",
      contentType: "image/png",
      size: 10,
    });
    if (!target.ok) throw new Error(target.error);
    expect(
      (
        await completeUpload({
          key: target.data.key,
          filename: "p.png",
          contentType: "image/png",
        })
      ).ok,
    ).toBe(false);

    const { target: uploaded } = await uploadPng();
    const mismatch = await completeUpload({
      key: uploaded.key,
      filename: "p.png",
      contentType: "image/webp",
    });
    expect(mismatch.ok).toBe(false);
    // Rejected uploads are removed from storage.
    expect(existsSync(localFile(uploaded.key))).toBe(false);
  });

  it("limits alt-text edits to the uploader and editors", async () => {
    actAs(OTHER);
    expect((await updateMediaAlt(itemId, "hijack")).ok).toBe(false);
    actAs(AUTHOR);
    expect(await updateMediaAlt(itemId, "  A single pixel  ")).toEqual({
      ok: true,
      data: { alt: "A single pixel" },
    });
    actAs(EDITOR);
    expect((await updateMediaAlt(itemId, "")).ok).toBe(true);
  });

  it("counts usage and unlinks covers on delete", async () => {
    actAs(EDITOR);
    const post = await savePost({
      title: "Int Media Post",
      slug: "",
      excerpt: "",
      tags: [],
      seoTitle: "",
      seoDescription: "",
      status: "draft",
      coverImageId: itemId,
      content: {
        type: "doc",
        content: [{ type: "image", attrs: { src: `/uploads/${itemKey}` } }],
      },
    });
    expect(post.ok).toBe(true);
    if (!post.ok) return;
    expect(await mediaUsage(itemId)).toEqual({ ok: true, data: 1 });

    const missingCover = await savePost({
      title: "Int Media Bad Cover",
      slug: "",
      excerpt: "",
      tags: [],
      seoTitle: "",
      seoDescription: "",
      status: "draft",
      coverImageId: crypto.randomUUID(),
      content: { type: "doc" },
    });
    expect(missingCover).toMatchObject({
      ok: false,
      fieldErrors: { coverImage: expect.any(String) },
    });

    actAs(OTHER);
    expect((await deleteMedia(itemId)).ok).toBe(false);
    actAs(AUTHOR);
    expect((await deleteMedia(itemId)).ok).toBe(true);
    expect(existsSync(localFile(itemKey))).toBe(false);
    const row = await db.query.posts.findFirst({
      where: eq(posts.id, post.data.id),
    });
    expect(row?.coverImageId).toBeNull();
  });
});

describe("sanitizer and images", () => {
  it("drops images with unsafe sources", async () => {
    actAs(EDITOR);
    const result = await savePost({
      title: "Int Media Unsafe",
      slug: "",
      excerpt: "",
      tags: [],
      seoTitle: "",
      seoDescription: "",
      status: "draft",
      content: {
        type: "doc",
        content: [
          { type: "image", attrs: { src: "javascript:alert(1)" } },
          {
            type: "image",
            attrs: { src: "https://cdn.example.com/a.png", alt: "ok" },
          },
        ],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = await db.query.posts.findFirst({
      where: eq(posts.id, result.data.id),
    });
    expect(JSON.stringify(row?.content)).not.toContain("javascript:");
    expect(JSON.stringify(row?.content)).toContain("cdn.example.com");
  });
});
