"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { user } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { can, isRole, isStaff, type Permission } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import {
  banReader as ban,
  deleteAllSpam as emptySpam,
  moderateComments as decide,
  unbanReader as unban,
  type ModerationAction,
} from "@/lib/comments/moderation";
import { getCommentForAction } from "@/lib/queries/comments";

export type { ModerationAction };

const actionSchema = z.enum(["approve", "spam", "delete"]);

async function authorize(...permissions: Permission[]) {
  const session = await getSession();
  return session && permissions.every((p) => can(session.user.role, p))
    ? session
    : null;
}

/** The queue, the Readers list, and the sidebar's pending count. */
function refreshDashboard() {
  revalidatePath("/admin", "layout");
}

const NO_PERMISSION = "You don't have permission to moderate comments.";
const UNAVAILABLE = "That comment is no longer available.";

/** Approve, mark as spam, or delete any comment (admins and editors). */
export async function moderateComment(
  id: unknown,
  action: unknown,
): Promise<ActionResult> {
  if (!(await authorize("comment:moderate"))) return fail(NO_PERMISSION);
  const parsed = z
    .object({ id: z.uuid(), action: actionSchema })
    .safeParse({ id, action });
  if (!parsed.success) return fail("Invalid request.");
  if (!(await decide([parsed.data.id], parsed.data.action))) {
    return fail(UNAVAILABLE);
  }
  refreshDashboard();
  return ok(null);
}

/** The same decision for several comments at once. */
export async function moderateComments(
  ids: unknown,
  action: unknown,
): Promise<ActionResult<{ changed: number }>> {
  if (!(await authorize("comment:moderate"))) return fail(NO_PERMISSION);
  const parsed = z
    .object({ ids: z.array(z.uuid()).min(1).max(100), action: actionSchema })
    .safeParse({ ids, action });
  if (!parsed.success) return fail("Invalid request.");
  const changed = await decide(parsed.data.ids, parsed.data.action);
  refreshDashboard();
  return ok({ changed });
}

/** Permanently delete everything marked as spam. */
export async function deleteAllSpam(): Promise<
  ActionResult<{ removed: number }>
> {
  if (!(await authorize("comment:moderate"))) return fail(NO_PERMISSION);
  const removed = await emptySpam();
  refreshDashboard();
  return ok({ removed });
}

const banSchema = z.object({
  userId: z.string().min(1).max(200),
  reason: z
    .string()
    .trim()
    .max(200, "Keep the reason under 200 characters")
    .transform((v) => v || null),
  hideComments: z.boolean(),
});

/** A reader who exists and can be banned, or an error for the moderator. */
async function bannableReader(userId: string) {
  const [target] = await db
    .select({ role: user.role, bannedAt: user.bannedAt })
    .from(user)
    .where(eq(user.id, userId));
  if (!target) return "This person no longer exists.";
  if (isStaff(isRole(target.role) ? target.role : undefined)) {
    return "Team members can't be banned. Change their role first.";
  }
  if (target.bannedAt) return "They're already banned.";
  return null;
}

/**
 * Ban a reader: they're signed out and can't sign in or comment. Their
 * comments waiting for review go to spam, and optionally their published
 * ones too.
 */
export async function banReader(raw: unknown): Promise<ActionResult> {
  if (!(await authorize("reader:ban"))) {
    return fail("You don't have permission to ban readers.");
  }
  const parsed = banSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  const problem = await bannableReader(parsed.data.userId);
  if (problem) return fail(problem);
  await ban(parsed.data.userId, parsed.data);
  refreshDashboard();
  return ok(null);
}

export async function unbanReader(userId: unknown): Promise<ActionResult> {
  if (!(await authorize("reader:ban"))) {
    return fail("You don't have permission to ban readers.");
  }
  const parsed = z.string().min(1).max(200).safeParse(userId);
  if (!parsed.success) return fail("Invalid request.");
  if (!(await unban(parsed.data))) return fail("They aren't banned.");
  refreshDashboard();
  return ok(null);
}

/**
 * One click for spam: the comment goes to spam, and its author is banned
 * with all their comments hidden.
 */
export async function spamAndBan(commentId: unknown): Promise<ActionResult> {
  if (!(await authorize("comment:moderate", "reader:ban"))) {
    return fail(NO_PERMISSION);
  }
  const parsed = z.uuid().safeParse(commentId);
  if (!parsed.success) return fail("Invalid request.");
  const comment = await getCommentForAction(parsed.data);
  if (!comment || comment.deletedAt) return fail(UNAVAILABLE);
  if (!comment.authorId) return fail("Its author's account is already gone.");
  if (comment.byStaff) {
    return fail("Team members can't be banned. Change their role first.");
  }
  await decide([comment.id], "spam");
  await ban(comment.authorId, { reason: "Spam", hideComments: true });
  refreshDashboard();
  return ok(null);
}
