"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { CommandMenu } from "@/components/admin/command-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { findNavItem } from "@/config/admin-nav";
import type { Role } from "@/lib/auth/permissions";

function useBreadcrumbs() {
  const pathname = usePathname();
  const crumbs: { label: string; href: string }[] = [
    { label: "Dashboard", href: "/admin" },
  ];
  const section = findNavItem(pathname);
  if (section && section.href !== "/admin") {
    crumbs.push({ label: section.title, href: section.href });
    const rest = pathname.slice(section.href.length).split("/").filter(Boolean);
    // Sub-pages (e.g. /admin/posts/new) get a title-cased trailing crumb.
    if (rest[0]) {
      const label = rest[0] === "new" ? "New" : "Edit";
      crumbs.push({ label, href: pathname });
    }
  }
  return crumbs;
}

export function AdminHeader({ role }: { role: Role }) {
  const crumbs = useBreadcrumbs();

  return (
    <header className="bg-background/80 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4!" />
      <Breadcrumb className="hidden md:block">
        <BreadcrumbList>
          {crumbs.map((crumb, i) => (
            <Fragment key={crumb.href}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {i === crumbs.length - 1 ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <CommandMenu role={role} />
        <ThemeToggle />
      </div>
    </header>
  );
}
