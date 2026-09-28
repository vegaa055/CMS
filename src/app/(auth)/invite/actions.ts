"use server";

import { and, eq, isNull } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { invitation, user } from "@/db/schema";
import { fail, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { inviteContext } from "@/lib/auth/invite-context";
import { getSession } from "@/lib/auth/session";
import { accountExists, findValidInvite } from "@/lib/invites";

const acceptSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  password: z.string().min(10, "Use at least 10 characters").max(128),
});

/** Mark an invitation used. Returns false if someone else claimed it first. */
async function claim(inviteId: string) {
  const claimed = await db
    .update(invitation)
    .set({ acceptedAt: new Date() })
    .where(and(eq(invitation.id, inviteId), isNull(invitation.acceptedAt)))
    .returning({ id: invitation.id });
  return claimed.length > 0;
}

async function release(inviteId: string) {
  await db
    .update(invitation)
    .set({ acceptedAt: null })
    .where(eq(invitation.id, inviteId));
}

/** Create an account from an invitation, then sign the new user in. */
export async function acceptInvite(
  token: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = acceptSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      "Please fix the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }
  const invite = await findValidInvite(token);
  if (!invite) return fail("This invitation is invalid or has expired.");
  // e.g. they signed up as a reader after being invited.
  if (await accountExists(invite.email)) {
    return fail(
      "You already have an account with this email. Sign in, then open this link again.",
    );
  }

  // Claim it first so a link can't be used twice concurrently.
  if (!(await claim(invite.id))) {
    return fail("This invitation has already been used.");
  }

  const requestHeaders = new Headers(await headers());
  try {
    await inviteContext.run({ email: invite.email, role: invite.role }, () =>
      auth.api.signUpEmail({
        body: {
          email: invite.email,
          name: parsed.data.name,
          password: parsed.data.password,
        },
        headers: requestHeaders,
      }),
    );
  } catch (error) {
    // Release the invite so it can be retried.
    await release(invite.id);
    if (error instanceof APIError) {
      return fail(error.message || "Couldn't create your account.");
    }
    throw error;
  }
  redirect("/admin");
}

/**
 * Accept an invitation with an existing reader account (someone who signed
 * up as a reader, then got invited). They must be signed in as the invited
 * email; the account keeps everything and gains the invited role.
 */
export async function acceptInviteAsReader(
  token: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Sign in first.");
  const invite = await findValidInvite(token);
  if (!invite) return fail("This invitation is invalid or has expired.");
  if (session.user.email.toLowerCase() !== invite.email) {
    return fail("This invitation is for a different email address.");
  }
  if (session.user.role !== "reader") {
    return fail("Your account already has dashboard access.");
  }
  if (!(await claim(invite.id))) {
    return fail("This invitation has already been used.");
  }

  const promoted = await db
    .update(user)
    .set({ role: invite.role })
    .where(and(eq(user.id, session.user.id), eq(user.role, "reader")))
    .returning({ id: user.id });
  if (!promoted.length) {
    await release(invite.id);
    return fail("Your account changed in the meantime. Try again.");
  }
  // No session cache, so the new role applies on the next request.
  redirect("/admin");
}
