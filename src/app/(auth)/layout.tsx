import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { getSiteSettings } from "@/lib/settings";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const site = await getSiteSettings();
  return (
    <div className="relative flex flex-1 flex-col">
      <header className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-display text-2xl tracking-tight">
          {site.name}
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
