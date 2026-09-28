"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const links = [
  { href: "/posts", label: "Writing" },
  { href: "/tags", label: "Topics" },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Inline links from the `sm` breakpoint up. */
export function NavLinks() {
  const isActive = useIsActive();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn(
            "hover:text-foreground rounded-md px-2.5 py-1.5 text-sm transition-colors",
            isActive(href) ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** The same links in a menu on phones, where the header is too narrow. */
export function MobileNav() {
  const isActive = useIsActive();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-label="Menu"
        >
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {links.map(({ href, label }) => (
          <DropdownMenuItem key={href} asChild>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
            >
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
