"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, SortableHeader } from "@/components/admin/data-table";
import { UserAvatar } from "@/components/admin/user-avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format";
import type { AdminUserRow } from "@/lib/queries/admin";

const columns: ColumnDef<AdminUserRow>[] = [
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
          <span className="font-medium">{row.original.name}</span>
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
    cell: ({ row }) => (
      <Badge variant={row.original.role === "admin" ? "default" : "secondary"}>
        {ROLE_LABELS[row.original.role]}
      </Badge>
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
];

export function UsersTable({ data }: { data: AdminUserRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Filter users…"
      emptyMessage="No users."
    />
  );
}
