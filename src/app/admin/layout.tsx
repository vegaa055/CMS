import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { requirePermission } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";

// Minimal admin frame for Phase 2; the full dashboard shell arrives in Phase 3.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await requirePermission("dashboard:view");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/admin" className="font-display text-2xl tracking-tight">
            {siteConfig.name}
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {user.name}
            </span>
            <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        {children}
      </main>
    </div>
  );
}
