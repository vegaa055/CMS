"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, MoreHorizontal, UserMinus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { changeUserRole, removeUser } from "@/app/admin/users/actions";
import { DataTable, SortableHeader } from "@/components/admin/data-table";
import { UserAvatar } from "@/components/admin/user-avatar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import { formatDate } from "@/lib/format";
import type { AdminUserRow } from "@/lib/queries/admin";

function RoleSelect({ user }: { user: AdminUserRow }) {
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

function RemoveUser({ user }: { user: AdminUserRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

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
              They&apos;ll be signed out and lose access immediately.
              {user.postCount > 0 &&
                ` Their ${user.postCount} ${user.postCount === 1 ? "post stays" : "posts stay"} published without an author.`}
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

function buildColumns(currentUserId: string): ColumnDef<AdminUserRow>[] {
  return [
    {
      id: "name",
      // Include email so the table filter matches either.
      accessorFn: (row) => `${row.name} ${row.email}`,
      header: ({ column }) => <SortableHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <UserAvatar
            name={row.original.name}
            image={row.original.image}
            className="size-8"
          />
          <div className="flex flex-col">
            <span className="flex items-center gap-2 font-medium">
              {row.original.name}
              {row.original.id === currentUserId && (
                <Badge variant="outline">You</Badge>
              )}
            </span>
            <span className="text-muted-foreground text-xs">
              {row.original.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: ({ column }) => <SortableHeader column={column} title="Role" />,
      cell: ({ row }) =>
        row.original.id === currentUserId ? (
          <Badge
            variant={row.original.role === "admin" ? "default" : "secondary"}
          >
            {ROLE_LABELS[row.original.role]}
          </Badge>
        ) : (
          <RoleSelect user={row.original} />
        ),
    },
    {
      accessorKey: "postCount",
      header: ({ column }) => <SortableHeader column={column} title="Posts" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.postCount}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <SortableHeader column={column} title="Joined" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        row.original.id === currentUserId ? null : (
          <div className="flex justify-end">
            <RemoveUser user={row.original} />
          </div>
        ),
    },
  ];
}

export function UsersTable({
  data,
  currentUserId,
}: {
  data: AdminUserRow[];
  currentUserId: string;
}) {
  const columns = useMemo(() => buildColumns(currentUserId), [currentUserId]);
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Filter users…"
      emptyMessage="No users."
    />
  );
}
