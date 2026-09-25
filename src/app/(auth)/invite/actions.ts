"use server";

import { and, eq, isNull } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { invitation } from "@/db/schema";
import { fail, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { inviteContext } from "@/lib/auth/invite-context";
import { findValidInvite } from "@/lib/invites";

const acceptSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  password: z.string().min(10, "Use at least 10 characters").max(128),
});

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

  // Claim it first so a link can't be used twice concurrently.
  const claimed = await db
    .update(invitation)
    .set({ acceptedAt: new Date() })
    .where(and(eq(invitation.id, invite.id), isNull(invitation.acceptedAt)))
    .returning({ id: invitation.id });
  if (!claimed.length) return fail("This invitation has already been used.");

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
    await db
      .update(invitation)
      .set({ acceptedAt: null })
      .where(eq(invitation.id, invite.id));
    if (error instanceof APIError) {
      return fail(error.message || "Couldn't create your account.");
    }
    throw error;
  }
  redirect("/admin");
}
