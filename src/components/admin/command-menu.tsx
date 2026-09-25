"use client";

import { ExternalLink, LogOut, Monitor, Moon, Search, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { adminNav } from "@/config/admin-nav";
import { signOut } from "@/lib/auth/client";
import { can, type Role } from "@/lib/auth/permissions";

/** ⌘K / Ctrl+K palette for navigation and quick actions. Renders its own trigger. */
export function CommandMenu({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <Button
        variant="outline"
        className="text-muted-foreground h-8 w-full justify-start gap-2 sm:w-56"
        onClick={() => setOpen(true)}
      >
        <Search />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="bg-muted pointer-events-none hidden rounded border px-1.5 font-mono text-[10px] font-medium sm:inline-block">
          Ctrl K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {adminNav.map((group) => {
            const items = group.items.filter((i) => can(role, i.permission));
            if (!items.length) return null;
            return (
              <CommandGroup key={group.label} heading={group.label}>
                {items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.title}
                    keywords={item.keywords}
                    onSelect={() => run(() => router.push(item.href))}
                  >
                    <item.icon />
                    {item.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
          <CommandSeparator />
          <CommandGroup heading="Theme">
            <CommandItem onSelect={() => run(() => setTheme("light"))}>
              <Sun /> Light
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme("dark"))}>
              <Moon /> Dark
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme("system"))}>
              <Monitor /> System
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="General">
            <CommandItem onSelect={() => run(() => window.open("/", "_blank"))}>
              <ExternalLink /> View site
              <CommandShortcut>↗</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                run(async () => {
                  await signOut();
                  router.replace("/login");
                  router.refresh();
                })
              }
            >
              <LogOut /> Sign out
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
