import { Search } from "lucide-react";
import Link from "next/link";

import { NavLinks } from "@/components/site/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-display text-2xl tracking-tight">
          {siteConfig.name}
        </Link>
        <div className="flex items-center gap-1">
          <NavLinks />
          <Button variant="ghost" size="icon" asChild>
            <Link href="/search" aria-label="Search">
              <Search />
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
