"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { invitation, user } from "@/db/schema";
import {
  fail,
  ok,
  zodFieldErrors,
  type ActionResult,
} from "@/lib/action-result";
import { can, ROLES, type Role } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import {
  hashInviteToken,
  INVITE_TTL_DAYS,
  inviteUrl,
  newInviteToken,
} from "@/lib/invites";
import { revalidatePublicSite } from "@/lib/revalidate";

async function admin() {
  const session = await getSession();
  return session && can(session.user.role, "user:manage") ? session : null;
}

async function adminCount() {
  const [row] = await db
    .select({ value: count() })
    .from(user)
    .where(eq(user.role, "admin"));
  return row?.value ?? 0;
}

async function loadTarget(id: string) {
  const [target] = await db
    .select({ id: user.id, role: user.role, name: user.name })
    .from(user)
    .where(eq(user.id, id));
  return target;
}

const roleSchema = z.enum(ROLES);

export async function changeUserRole(
  userId: string,
  role: unknown,
): Promise<ActionResult<{ role: Role }>> {
  const session = await admin();
  if (!session) return fail("Only admins can change roles.");
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return fail("Unknown role.");
  if (userId === session.user.id) {
    return fail("You can't change your own role. Ask another admin.");
  }
  const target = await loadTarget(userId);
  if (!target) return fail("This user no longer exists.");
  if (
    target.role === "admin" &&
    parsed.data !== "admin" &&
    (await adminCount()) <= 1
  ) {
    return fail("The site needs at least one admin.");
  }

  // Sessions aren't cached in cookies, so the new role applies on the
  // user's very next request.
  await db.update(user).set({ role: parsed.data }).where(eq(user.id, userId));
  revalidatePath("/admin/users");
  return ok({ role: parsed.data });
}

export async function removeUser(userId: string): Promise<ActionResult> {
  const session = await admin();
  if (!session) return fail("Only admins can remove users.");
  if (userId === session.user.id) return fail("You can't remove yourself.");
  const target = await loadTarget(userId);
  if (!target) return fail("This user no longer exists.");
  if (target.role === "admin" && (await adminCount()) <= 1) {
    return fail("The site needs at least one admin.");
  }

  // Sessions and accounts cascade; their posts and uploads are kept and
  // become unattributed (FKs set null).
  await db.delete(user).where(eq(user.id, userId));
  revalidatePath("/admin/users");
  revalidatePublicSite();
  return ok(null);
}

const inviteSchema = z.object({
  email: z.email("Enter a valid email").transform((v) => v.toLowerCase()),
  role: roleSchema,
});

export async function createInvite(
  raw: unknown,
): Promise<ActionResult<{ url: string; expiresAt: string }>> {
  const session = await admin();
  if (!session) return fail("Only admins can invite users.");
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      "Please fix the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }
  const { email, role } = parsed.data;

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  if (existing) {
    return fail("Someone with that email already has an account.", {
      email: "Already registered",
    });
  }

  const token = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  // Re-inviting replaces any pending invite for the same address.
  await db.batch([
    db
      .delete(invitation)
      .where(and(eq(invitation.email, email), isNull(invitation.acceptedAt))),
    db.insert(invitation).values({
      id: crypto.randomUUID(),
      email,
      role,
      tokenHash: hashInviteToken(token),
      invitedById: session.user.id,
      expiresAt,
    }),
  ]);
  revalidatePath("/admin/users");
  // The raw token is only ever returned here; the DB keeps just its hash.
  return ok({ url: inviteUrl(token), expiresAt: expiresAt.toISOString() });
}

export async function revokeInvite(id: string): Promise<ActionResult> {
  if (!(await admin())) return fail("Only admins can manage invites.");
  if (!z.uuid().safeParse(id).success) return fail("Invalid invite.");
  await db
    .delete(invitation)
    .where(and(eq(invitation.id, id), isNull(invitation.acceptedAt)));
  revalidatePath("/admin/users");
  return ok(null);
}
