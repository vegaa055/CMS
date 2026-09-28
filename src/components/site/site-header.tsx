import { Search } from "lucide-react";
import Link from "next/link";

import { AccountMenu } from "@/components/site/account-menu";
import { MobileNav, NavLinks } from "@/components/site/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getSiteSettings } from "@/lib/settings";

export async function SiteHeader() {
  const site = await getSiteSettings();
  return (
    <header className="bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        {/* The name is editable, so it truncates rather than wrap on phones. */}
        <Link
          href="/"
          className="font-display min-w-0 truncate text-2xl tracking-tight"
        >
          {site.name}
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <NavLinks />
          <Button variant="ghost" size="icon" asChild>
            <Link href="/search" aria-label="Search">
              <Search />
            </Link>
          </Button>
          <ThemeToggle />
          <MobileNav />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
