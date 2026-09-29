"use server";

import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { readToken, setNotification } from "@/lib/notifications";

/**
 * Stop one kind of notification email, from the link in it. No sign-in: the
 * signed token says whose and which.
 */
export async function unsubscribe(token: unknown): Promise<ActionResult> {
  const parsed = z.string().min(1).max(500).safeParse(token);
  const target = parsed.success ? readToken(parsed.data) : null;
  if (!target) return fail("This unsubscribe link isn't valid.");
  if (!(await setNotification(target.userId, target.kind, false))) {
    return fail("This account no longer exists.");
  }
  return ok(null);
}
