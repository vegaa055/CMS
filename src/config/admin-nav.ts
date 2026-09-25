import {
  FileText,
  ImageIcon,
  LayoutDashboard,
  Settings,
  Tags,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@/lib/auth/permissions";

export type AdminNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  /** Extra words the command palette should match on. */
  keywords?: string[];
};

export type AdminNavGroup = { label: string; items: AdminNavItem[] };

/**
 * Single source for the admin sidebar, breadcrumbs, and command palette.
 * Items are hidden when the user's role lacks `permission`; pages still
 * enforce access server-side.
 */
export const adminNav: AdminNavGroup[] = [
  {
    label: "Content",
    items: [
      {
        title: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        permission: "dashboard:view",
        keywords: ["home", "overview"],
      },
      {
        title: "Posts",
        href: "/admin/posts",
        icon: FileText,
        permission: "post:create",
        keywords: ["articles", "blog", "drafts"],
      },
      {
        title: "Media",
        href: "/admin/media",
        icon: ImageIcon,
        permission: "media:upload",
        keywords: ["images", "uploads", "files"],
      },
      {
        title: "Tags",
        href: "/admin/tags",
        icon: Tags,
        permission: "tag:manage",
        keywords: ["categories", "topics"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Users",
        href: "/admin/users",
        icon: Users,
        permission: "user:manage",
        keywords: ["team", "roles", "people"],
      },
      {
        title: "Settings",
        href: "/admin/settings",
        icon: Settings,
        permission: "settings:manage",
        keywords: ["site", "configuration"],
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        title: "Profile",
        href: "/admin/profile",
        icon: UserRound,
        permission: "dashboard:view",
        keywords: ["account", "password", "avatar", "bio", "username"],
      },
    ],
  },
];

export const adminNavItems = adminNav.flatMap((g) => g.items);

/** Most specific nav item matching a pathname (for active state and breadcrumbs). */
export function findNavItem(pathname: string) {
  return adminNavItems
    .filter(
      (item) =>
        pathname === item.href ||
        (item.href !== "/admin" && pathname.startsWith(`${item.href}/`)),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}
