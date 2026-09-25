"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, SortableHeader } from "@/components/admin/data-table";
import { formatDate } from "@/lib/format";
import type { AdminTagRow } from "@/lib/queries/admin";

const columns: ColumnDef<AdminTagRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} title="Name" />,
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "slug",
    header: "Slug",
    cell: ({ row }) => (
      <span className="text-muted-foreground font-mono text-xs">
        {row.original.slug}
      </span>
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
    header: ({ column }) => <SortableHeader column={column} title="Created" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
];

export function TagsTable({ data }: { data: AdminTagRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Filter tags…"
      emptyMessage="No tags yet."
    />
  );
}
