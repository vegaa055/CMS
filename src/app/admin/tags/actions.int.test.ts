/** Integration tests for tag server actions. Run with `npm run test:int`. */
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { tags } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

import { createTag, deleteTag, updateTag } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

const PREFIX = "int-tag";

function actAs(role: "admin" | "editor" | "author") {
  vi.mocked(getSession).mockResolvedValue({
    user: { id: `${PREFIX}-${role}`, role, name: role, email: "x@y.z" },
  } as never);
}

const cleanup = () => db.delete(tags).where(like(tags.slug, `${PREFIX}%`));
beforeAll(cleanup);
afterAll(cleanup);

async function findBySlug(slug: string) {
  return db.query.tags.findFirst({ where: eq(tags.slug, slug) });
}

describe("tag actions", () => {
  it("requires tag:manage", async () => {
    actAs("author");
    expect((await createTag({ name: "Int Tag Nope", slug: "" })).ok).toBe(
      false,
    );
  });

  it("creates a tag with a generated slug", async () => {
    actAs("editor");
    expect((await createTag({ name: "  Int   Tag Alpha ", slug: "" })).ok).toBe(
      true,
    );
    expect(await findBySlug("int-tag-alpha")).toMatchObject({
      name: "Int Tag Alpha",
    });
  });

  it("reports duplicate names and slugs on the right field", async () => {
    actAs("editor");
    expect(
      await createTag({ name: "Int Tag Alpha", slug: "int-tag-other" }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { name: expect.any(String) },
    });
    expect(
      await createTag({ name: "Int Tag Beta", slug: "int-tag-alpha" }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { slug: expect.any(String) },
    });
  });

  it("renames and deletes", async () => {
    actAs("admin");
    const tag = (await findBySlug("int-tag-alpha"))!;
    expect(
      (
        await updateTag(tag.id, {
          name: "Int Tag Gamma",
          slug: "int-tag-gamma",
        })
      ).ok,
    ).toBe(true);
    expect(await findBySlug("int-tag-gamma")).toMatchObject({ id: tag.id });
    expect((await deleteTag(tag.id)).ok).toBe(true);
    expect(await findBySlug("int-tag-gamma")).toBeUndefined();
  });
});
