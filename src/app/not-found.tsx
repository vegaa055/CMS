import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-muted-foreground font-mono text-sm">404</p>
      <h1 className="font-display text-5xl tracking-tight">Page not found</h1>
      <p className="text-muted-foreground max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist, or isn&apos;t
        published yet.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/search">Search</Link>
        </Button>
      </div>
    </main>
  );
}
