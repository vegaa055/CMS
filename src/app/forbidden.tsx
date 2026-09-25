import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground font-mono text-sm">403</p>
      <h1 className="font-display text-4xl">You don&apos;t have access</h1>
      <p className="text-muted-foreground max-w-sm">
        Your role doesn&apos;t include permission for this page. Ask an admin if
        you think this is a mistake.
      </p>
      <Button variant="outline" asChild>
        <Link href="/admin">Back to dashboard</Link>
      </Button>
    </main>
  );
}
