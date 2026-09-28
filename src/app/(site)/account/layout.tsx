import { LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountTabs } from "@/components/account/account-tabs";
import { UserAvatar } from "@/components/admin/user-avatar";
import { Button } from "@/components/ui/button";
import { isStaff, ROLE_LABELS } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default async function AccountLayout({
  children,
}: LayoutProps<"/account">) {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent("/account")}`);
  const { user } = session;
  const staff = isStaff(user.role);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-16">
      <header className="flex items-center gap-4">
        <UserAvatar
          name={user.name}
          image={user.image}
          className="size-16 text-xl"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="font-display text-4xl tracking-tight">Your account</h1>
          <p className="text-muted-foreground truncate text-sm">
            {user.name} · {staff ? ROLE_LABELS[user.role] : "Reader"}
          </p>
        </div>
        {staff && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin">
              <LayoutDashboard /> Dashboard
            </Link>
          </Button>
        )}
      </header>
      <AccountTabs />
      {children}
    </div>
  );
}
