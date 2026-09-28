import { safeRedirectPath } from "@/lib/safe-redirect";

import { isStaff, type Role } from "./permissions";

/** Only the team can use these; readers who ask for them go home instead. */
const STAFF_ONLY = ["/admin", "/preview"];
/** Sign-in and account-recovery pages: never a place to land afterwards. */
const AUTH_PAGES = [
  "/login",
  "/register",
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

function isUnder(path: string, prefixes: string[]) {
  const pathname = path.split(/[?#]/)[0]!;
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** A `?next=` value that is safe to carry through sign-in, or undefined. */
export function nextParam(value: string | string[] | undefined) {
  return safeRedirectPath(value, "") || undefined;
}

/**
 * Where a signed-in user goes after signing in: the page they asked for if
 * their role can use it, otherwise the dashboard (team) or home (readers).
 */
export function landingPath(role: Role, next?: string | string[]) {
  const home = isStaff(role) ? "/admin" : "/";
  const path = safeRedirectPath(next, home);
  if (isUnder(path, AUTH_PAGES)) return home;
  if (!isStaff(role) && isUnder(path, STAFF_ONLY)) return home;
  return path;
}

/**
 * Where the link in a verification email lands (Better Auth appends
 * `?error=` when the link is bad or expired), carrying the page to go on to.
 */
export function verifyEmailUrl(next?: string) {
  return next
    ? `/verify-email?next=${encodeURIComponent(next)}`
    : "/verify-email";
}

/**
 * After signing in (email or GitHub), send the browser here: the server
 * knows the user's role by then and forwards them to `landingPath`.
 */
export function continueUrl(next?: string) {
  return next
    ? `/auth/continue?next=${encodeURIComponent(next)}`
    : "/auth/continue";
}

/**
 * Where email-change links land: "sent" after confirming from the old inbox
 * (one more link is on its way to the new one), "done" once the new address
 * is verified. /account shows the matching message.
 */
export function emailChangeUrl(step: "sent" | "done") {
  return `/account?emailChange=${step}`;
}
