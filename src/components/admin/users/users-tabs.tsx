import Link from "next/link";

import { cn } from "@/lib/utils";

const TABS = [
  { key: "team", label: "Team", href: "/admin/users" },
  { key: "readers", label: "Readers", href: "/admin/users/readers" },
] as const;

/** Switches between the Team and Readers lists (separate routes). */
export function UsersTabs({
  active,
  counts,
}: {
  active: (typeof TABS)[number]["key"];
  counts: Record<(typeof TABS)[number]["key"], number>;
}) {
  return (
    <nav
      aria-label="User lists"
      className="bg-muted text-muted-foreground inline-flex w-fit items-center gap-1 rounded-lg p-1"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "hover:text-foreground inline-flex items-center gap-2 rounded-md px-3 py-1 text-sm font-medium transition-colors",
            tab.key === active && "bg-background text-foreground shadow-sm",
          )}
        >
          {tab.label}
          <span className="text-muted-foreground text-xs tabular-nums">
            {counts[tab.key]}
          </span>
        </Link>
      ))}
    </nav>
  );
}
