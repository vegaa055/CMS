"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavUser, type NavUserProps } from "@/components/admin/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { adminNav, findNavItem } from "@/config/admin-nav";
import { siteConfig } from "@/config/site";
import { can } from "@/lib/auth/permissions";

export function AppSidebar({ user }: { user: NavUserProps["user"] }) {
  const pathname = usePathname();
  const active = findNavItem(pathname);

  const groups = adminNav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => can(user.role, item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                <span className="bg-primary font-display text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-lg">
                  {siteConfig.name.charAt(0)}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-display text-lg tracking-tight">
                    {siteConfig.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Dashboard
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active?.href === item.href}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
