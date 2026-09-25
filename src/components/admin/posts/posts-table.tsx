"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  ExternalLink,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DataTable, SortableHeader } from "@/components/admin/data-table";
import { DeletePostDialog } from "@/components/admin/posts/delete-post-dialog";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatRelative } from "@/lib/format";
import { POST_STATUSES, type PostStatus } from "@/lib/posts/status";
import { postPath, previewPath } from "@/lib/posts/urls";
import type { AdminPostRow } from "@/lib/queries/admin";

function RowActions({ post }: { post: AdminPostRow }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Post actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {post.canEdit && (
            <DropdownMenuItem asChild>
              <Link href={`/admin/posts/${post.id}`}>
                <Pencil /> Edit
              </Link>
            </DropdownMenuItem>
          )}
          {post.status === "published" ? (
            <DropdownMenuItem asChild>
              <Link href={postPath(post.slug)} target="_blank">
                <ExternalLink /> View
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <Link href={previewPath(post.id)} target="_blank">
                <Eye /> Preview
              </Link>
            </DropdownMenuItem>
          )}
          {post.canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {post.canDelete && (
        <DeletePostDialog
          postId={post.id}
          title={post.title}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </>
  );
}

const columns: ColumnDef<AdminPostRow>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => <SortableHeader column={column} title="Title" />,
    cell: ({ row }) => {
      const { id, title, slug, canEdit } = row.original;
      const label = title || "Untitled";
      return (
        <div className="flex max-w-md flex-col">
          {canEdit ? (
            <Link
              href={`/admin/posts/${id}`}
              className="truncate font-medium hover:underline"
            >
              {label}
            </Link>
          ) : (
            <span className="truncate font-medium">{label}</span>
          )}
          <span className="text-muted-foreground truncate font-mono text-xs">
            /{slug}
          </span>
        </div>
      );
    },
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
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <RowActions post={row.original} />
      </div>
    ),
  },
];

export function PostsTable({ data }: { data: AdminPostRow[] }) {
  const [status, setStatus] = useState<PostStatus | "all">("all");
  const rows =
    status === "all" ? data : data.filter((p) => p.status === status);

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Filter posts…"
      emptyMessage={status === "all" ? "No posts yet." : `No ${status} posts.`}
      toolbar={
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as PostStatus | "all")}
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {POST_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}
