import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { landingPath, nextParam } from "@/lib/auth/landing";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Post-sign-in hop (email and GitHub): the role is known only once the
 * session exists, so the server picks the landing page here.
 */
export default async function ContinuePage({
  searchParams,
}: PageProps<"/auth/continue">) {
  const next = nextParam((await searchParams).next);
  const session = await getSession();
  if (!session) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  redirect(landingPath(session.user.role, next));
}
