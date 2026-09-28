"use client";

import { Heart, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { UserAvatar } from "@/components/admin/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "@/lib/auth/client";
import { isRole, isStaff } from "@/lib/auth/permissions";

/**
 * Sign-in link or account menu for the public header. The session is read
 * in the browser, so public pages stay static and cached.
 */
export function AccountMenu() {
  const { data, isPending } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // Same footprint as the avatar button, so the header doesn't shift.
  if (isPending) return <div aria-hidden className="size-9" />;

  if (!data) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/login?next=${encodeURIComponent(pathname)}`}>
          Sign in
        </Link>
      </Button>
    );
  }

  const { user } = data;
  // Cosmetic only: the dashboard checks the role itself.
  const staff = isStaff(isRole(user.role) ? user.role : undefined);

  async function handleSignOut() {
    await signOut();
    // Account pages need a session; everywhere else, stay put.
    if (pathname.startsWith("/account")) router.replace("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Account menu"
        >
          <UserAvatar name={user.name} image={user.image} className="size-7" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="grid text-sm leading-tight">
            <span className="truncate font-medium">{user.name}</span>
            <span className="text-muted-foreground truncate text-xs">
              {user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserRound /> Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/likes">
            <Heart /> Liked stories
          </Link>
        </DropdownMenuItem>
        {staff && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboard /> Dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
