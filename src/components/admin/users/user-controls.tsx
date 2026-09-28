"use client";

import { Loader2, MoreHorizontal, UserMinus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { changeUserRole, removeUser } from "@/app/admin/users/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/permissions";

/** The fields the controls need from a team member or reader row. */
type UserRef = { id: string; name: string; role: Role; postCount?: number };

/** Role picker for another user; the new role applies on their next request. */
export function RoleSelect({ user }: { user: UserRef }) {
  const [role, setRole] = useState<Role>(user.role);
  const [pending, startTransition] = useTransition();

  function change(next: Role) {
    const previous = role;
    setRole(next);
    startTransition(async () => {
      const result = await changeUserRole(user.id, next);
      if (!result.ok) {
        setRole(previous);
        toast.error(result.error);
        return;
      }
      toast.success(`${user.name} is now ${ROLE_LABELS[next].toLowerCase()}`);
    });
  }

  return (
    <Select
      value={role}
      onValueChange={(v) => change(v as Role)}
      disabled={pending}
    >
      <SelectTrigger
        size="sm"
        className="w-32"
        aria-label={`Role for ${user.name}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Row menu with a confirmed "Remove user". */
export function RemoveUser({ user }: { user: UserRef }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const posts = user.postCount ?? 0;

  function confirm() {
    startTransition(async () => {
      const result = await removeUser(user.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${user.name} was removed`);
      setOpen(false);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${user.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setOpen(true)}
          >
            <UserMinus /> Remove user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {user.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their account is deleted and they&apos;re signed out immediately.
              {posts > 0 &&
                ` Their ${posts} ${posts === 1 ? "post stays" : "posts stay"} published without an author.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Remove user
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
