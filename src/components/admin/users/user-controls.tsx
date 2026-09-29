"use client";

import {
  Ban,
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  UserMinus,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { banReader, unbanReader } from "@/app/admin/comments/actions";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

function RemoveUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
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
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
  );
}

function ActionsTrigger({ name }: { name: string }) {
  return (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
        <MoreHorizontal />
      </Button>
    </DropdownMenuTrigger>
  );
}

/** Row menu with a confirmed "Remove user". */
export function RemoveUser({ user }: { user: UserRef }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <ActionsTrigger name={user.name} />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setOpen(true)}
          >
            <UserMinus /> Remove user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RemoveUserDialog user={user} open={open} onOpenChange={setOpen} />
    </>
  );
}

function BanDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [hideComments, setHideComments] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await banReader({
        userId: user.id,
        reason,
        hideComments,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${user.name} is banned`);
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ban {user.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They&apos;re signed out and can&apos;t sign in or comment until you
            unban them. Their comments waiting for review go to spam.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor="ban-reason">
            Reason (only moderators see it)
          </FieldLabel>
          <Input
            id="ban-reason"
            value={reason}
            maxLength={200}
            placeholder="e.g. Spam"
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={hideComments}
            onCheckedChange={(value) => setHideComments(value === true)}
          />
          Also hide their published comments
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Ban reader
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Row menu for a reader: ban or unban, or remove the account. */
export function ReaderActions({
  user,
}: {
  user: UserRef & { banned: boolean };
}) {
  const [dialog, setDialog] = useState<"ban" | "remove" | null>(null);
  const [, startTransition] = useTransition();

  function unban() {
    startTransition(async () => {
      const result = await unbanReader(user.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${user.name} is no longer banned`);
    });
  }

  const onOpenChange = (open: boolean) => !open && setDialog(null);
  return (
    <>
      <DropdownMenu>
        <ActionsTrigger name={user.name} />
        <DropdownMenuContent align="end">
          {user.banned ? (
            <DropdownMenuItem onSelect={unban}>
              <ShieldCheck /> Unban
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setDialog("ban")}>
              <Ban /> Ban…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDialog("remove")}
          >
            <UserMinus /> Remove user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BanDialog
        user={user}
        open={dialog === "ban"}
        onOpenChange={onOpenChange}
      />
      <RemoveUserDialog
        user={user}
        open={dialog === "remove"}
        onOpenChange={onOpenChange}
      />
    </>
  );
}
