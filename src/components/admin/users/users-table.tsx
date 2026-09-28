"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { DataTable, SortableHeader } from "@/components/admin/data-table";
import { UserAvatar } from "@/components/admin/user-avatar";
import { RemoveUser, RoleSelect } from "@/components/admin/users/user-controls";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format";
import type { TeamMemberRow } from "@/lib/queries/admin";

function buildColumns(currentUserId: string): ColumnDef<TeamMemberRow>[] {
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
  data: TeamMemberRow[];
  currentUserId: string;
}) {
  const columns = useMemo(() => buildColumns(currentUserId), [currentUserId]);
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Filter team…"
      emptyMessage="No team members."
    />
  );
}
