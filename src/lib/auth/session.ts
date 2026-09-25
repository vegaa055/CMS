import "server-only";

import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "./index";
import { can, isRole, type Permission, type Role } from "./permissions";

/** Current session (deduplicated per request), or null. */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const role: Role = isRole(session.user.role) ? session.user.role : "author";
  return { ...session, user: { ...session.user, role } };
});

export type AppSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Session or redirect to /login. Use in admin pages, layouts, and server actions. */
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
