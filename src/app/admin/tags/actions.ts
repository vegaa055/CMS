"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { pgError, UNIQUE_VIOLATION } from "@/db/errors";
import { tags } from "@/db/schema";
import {
  fail,
  ok,
  zodFieldErrors,
  type ActionResult,
} from "@/lib/action-result";
import { can } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { slugify } from "@/lib/slug";
import { tagSchema } from "@/lib/validation/post";

async function authorize() {
  const session = await getSession();
  return session && can(session.user.role, "tag:manage") ? session : null;
}

function parseTag(raw: unknown) {
  const parsed = tagSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: fail(
        "Please fix the highlighted fields.",
        zodFieldErrors(parsed.error),
      ),
    };
  }
  const name = parsed.data.name.replace(/\s+/g, " ");
  const slug = parsed.data.slug || slugify(name);
  if (!slug) {
    return {
      error: fail("Use at least one letter or number.", {
        name: "Use at least one letter or number",
      }),
    };
  }
  return { values: { name, slug } };
}

function uniqueViolation(error: unknown) {
  const { code, constraint } = pgError(error);
  if (code !== UNIQUE_VIOLATION) return null;
  return constraint?.includes("slug")
    ? fail("Another tag already uses that slug.", { slug: "Already in use" })
    : fail("A tag with that name already exists.", { name: "Already exists" });
}

function revalidateTagViews() {
  revalidatePath("/admin/tags");
  revalidatePath("/");
}

export async function createTag(raw: unknown): Promise<ActionResult> {
  if (!(await authorize()))
    return fail("You don't have permission to manage tags.");
  const { values, error } = parseTag(raw);
  if (error) return error;
  try {
    await db.insert(tags).values(values);
  } catch (e) {
    const conflict = uniqueViolation(e);
    if (conflict) return conflict;
    throw e;
  }
  revalidateTagViews();
  return ok(null);
}

export async function updateTag(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  if (!(await authorize()))
    return fail("You don't have permission to manage tags.");
  if (!z.uuid().safeParse(id).success) return fail("Invalid tag id.");
  const { values, error } = parseTag(raw);
  if (error) return error;
  try {
    const updated = await db
      .update(tags)
      .set(values)
      .where(eq(tags.id, id))
      .returning({ id: tags.id });
    if (!updated.length) return fail("This tag no longer exists.");
  } catch (e) {
    const conflict = uniqueViolation(e);
    if (conflict) return conflict;
    throw e;
  }
  revalidateTagViews();
  return ok(null);
}

export async function deleteTag(id: string): Promise<ActionResult> {
  if (!(await authorize()))
    return fail("You don't have permission to manage tags.");
  if (!z.uuid().safeParse(id).success) return fail("Invalid tag id.");
  // post_tags rows cascade; posts themselves are untouched.
  await db.delete(tags).where(eq(tags.id, id));
  revalidateTagViews();
  return ok(null);
}
