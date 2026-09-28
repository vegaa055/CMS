import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate: send visitors without a session cookie from the
 * dashboard, previews, and account pages to sign-in (and back afterwards).
 * This only checks cookie presence — real session and role checks happen
 * server-side via `getSession` / `requirePermission`.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/preview/:path*", "/account/:path*"],
};
