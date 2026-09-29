"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/account", label: "Settings" },
  { href: "/account/likes", label: "Liked stories" },
  { href: "/account/comments", label: "Comments" },
];

export function AccountTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Account"
      className="bg-muted text-muted-foreground inline-flex w-fit items-center gap-1 rounded-lg p-1"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "hover:text-foreground rounded-md px-3 py-1 text-sm font-medium transition-colors",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
