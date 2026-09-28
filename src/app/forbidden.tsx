import Link from "next/link";

import { Button } from "@/components/ui/button";
import { isStaff } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";

export default async function Forbidden() {
  const session = await getSession();
  const staff = isStaff(session?.user.role);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground font-mono text-sm">403</p>
      <h1 className="font-display text-4xl">You don&apos;t have access</h1>
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
    </main>
  );
}
