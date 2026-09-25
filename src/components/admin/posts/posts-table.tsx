"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, SortableHeader } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatRelative } from "@/lib/format";
import type { AdminPostRow } from "@/lib/queries/admin";

const columns: ColumnDef<AdminPostRow>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => <SortableHeader column={column} title="Title" />,
    cell: ({ row }) => (
      <div className="flex max-w-md flex-col">
        <span className="truncate font-medium">{row.original.title}</span>
        <span className="text-muted-foreground truncate font-mono text-xs">
          /{row.original.slug}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortableHeader column={column} title="Status" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "author",
    header: ({ column }) => <SortableHeader column={column} title="Author" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.author ?? "—"}
      </span>
    ),
  },
  {
    id: "tags",
    accessorFn: (row) => row.tags.join(" "),
    header: "Tags",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.tags.map((tag) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    accessorKey: "publishedAt",
    header: ({ column }) => (
      <SortableHeader column={column} title="Published" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {formatDate(row.original.publishedAt)}
      </span>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => <SortableHeader column={column} title="Updated" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {formatRelative(row.original.updatedAt)}
      </span>
    ),
  },
];

export function PostsTable({ data }: { data: AdminPostRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Filter posts…"
      emptyMessage="No posts yet."
    />
  );
}
