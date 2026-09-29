"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/client";
import { isRole, isStaff } from "@/lib/auth/permissions";

/**
 * The 403 page's explanation and way out, which depend on who's signed in.
 * Read in the browser: the page is rendered along with every route, and
 * reading the session on the server would make every route dynamic.
 */
export function ForbiddenMessage() {
  const { data, isPending } = useSession();
  // Keep the space while the session loads, so the page doesn't jump.
  if (isPending) return <div aria-hidden className="h-24" />;

  const role = data?.user.role;
  const staff = isStaff(isRole(role) ? role : undefined);
  return (
    <>
      <p className="text-muted-foreground max-w-sm">
        {staff
          ? "Your role doesn't include permission for this page. Ask an admin if you think this is a mistake."
          : "This part of the site is only for the team that runs it."}
      </p>
      <Button variant="outline" asChild>
        {staff ? (
          <Link href="/admin">Back to dashboard</Link>
        ) : (
          <Link href="/">Back to the site</Link>
        )}
      </Button>
    </>
  );
}
