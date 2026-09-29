import "server-only";

import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "./index";
import { can, isRole, type Permission, type Role } from "./permissions";

/**
 * Current session (deduplicated per request), or null. A banned user counts
 * as signed out, even with a session that slipped in as they were banned.
 */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.bannedAt) return null;
  // Least privilege: anything unrecognized is treated as a reader.
  const role: Role = isRole(session.user.role) ? session.user.role : "reader";
  return { ...session, user: { ...session.user, role } };
});

export type AppSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/**
 * Session or redirect to /login. Any signed-in user passes, readers
 * included, so dashboard pages and actions must use `requirePermission`.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Session with the given permission, or a 403. */
export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!can(session.user.role, permission)) forbidden();
  return session;
}
