"use client";

import {
  AlertCircle,
  ImageIcon,
  Loader2,
  Search,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/admin/empty-state";
import { MediaDetailsSheet } from "@/components/admin/media/media-details-sheet";
import { useMediaUpload } from "@/components/admin/media/use-media-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MEDIA_ACCEPT } from "@/lib/media/constants";
import type { MediaItem, MediaPage } from "@/lib/media/types";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

export async function fetchMediaPage(q = "", cursor?: string) {
  const params = new URLSearchParams({ q });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/admin/media?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as MediaPage;
}

export function MediaBrowser({
  initialPage,
  mode,
  onPick,
}: {
  /** First page: server-rendered on the library page, fetched on open in the picker. */
  initialPage: MediaPage;
  /** "manage" opens details on click; "pick" returns the item via onPick. */
  mode: "manage" | "pick";
  onPick?: (item: MediaItem) => void;
}) {
  const [page, setPage] = useState<MediaPage | null>(initialPage);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const debounce = useRef<number | undefined>(undefined);
  const latestRequest = useRef(0);

  const { uploads, upload, dismiss } = useMediaUpload((item) =>
    setPage((prev) => ({
      items: [item, ...(prev?.items ?? [])],
      nextCursor: prev?.nextCursor ?? null,
    })),
  );

  async function load(q: string, cursor?: string) {
    const request = ++latestRequest.current;
    try {
      const data = await fetchMediaPage(q, cursor);
      if (request !== latestRequest.current) return; // a newer search won
      setPage((prev) =>
        cursor && prev
          ? {
              items: [...prev.items, ...data.items],
              nextCursor: data.nextCursor,
            }
          : data,
      );
      setError(null);
    } catch {
      if (request === latestRequest.current) setError("Couldn't load media.");
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }

  useEffect(() => () => window.clearTimeout(debounce.current), []);

  function onSearch(value: string) {
    setQuery(value);
    setLoading(true);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(
      () => void load(value.trim()),
      SEARCH_DEBOUNCE_MS,
    );
  }

  function onFiles(files: FileList | null) {
    if (files?.length) void upload([...files]);
  }

  function replaceItem(item: MediaItem) {
    setPage(
      (prev) =>
        prev && {
          ...prev,
          items: prev.items.map((i) => (i.id === item.id ? item : i)),
        },
    );
    setSelected(item);
  }

  function removeItem(id: string) {
    setPage(
      (prev) =>
        prev && { ...prev, items: prev.items.filter((i) => i.id !== id) },
    );
    setSelected(null);
  }

  const items = page?.items ?? [];

  return (
    <div
      className="relative flex flex-col gap-4"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by name or alt text…"
            className="pl-8"
            aria-label="Search media"
          />
        </div>
        <Button
          className="sm:ml-auto"
          onClick={() => fileInput.current?.click()}
        >
          <Upload /> Upload
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept={MEDIA_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="bg-card flex flex-col gap-2 rounded-xl border p-3 text-sm">
          {uploads.map((u) => (
            <li key={u.id} className="flex items-center gap-3">
              {u.status === "error" ? (
                <AlertCircle className="text-destructive size-4 shrink-0" />
              ) : u.status === "uploading" ? (
                <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
              ) : (
                <ImageIcon className="text-success size-4 shrink-0" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate">{u.name}</span>
                {u.status === "error" ? (
                  <span className="text-destructive text-xs">{u.error}</span>
                ) : (
                  <span className="bg-muted h-1 overflow-hidden rounded-full">
                    <span
                      className="bg-primary block h-full transition-[width]"
                      style={{ width: `${Math.round(u.progress * 100)}%` }}
                    />
                  </span>
                )}
              </div>
              {u.status !== "uploading" && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Dismiss"
                  onClick={() => dismiss(u.id)}
                >
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      {items.length > 0 ? (
        <ul
          className={cn(
            "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6",
            loading && "opacity-60",
          )}
        >
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() =>
                  mode === "pick" ? onPick?.(item) : setSelected(item)
                }
                className="group bg-muted focus-visible:ring-ring/50 relative block aspect-square w-full overflow-hidden rounded-lg border outline-none focus-visible:ring-3"
                aria-label={item.alt || item.filename}
              >
                <Image
                  src={item.url}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 14vw, (min-width: 768px) 22vw, 45vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                {!item.alt && (
                  <span className="bg-background/85 text-warning absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium">
                    No alt text
                  </span>
                )}
                <span className="bg-background/85 absolute inset-x-0 bottom-0 truncate px-2 py-1 text-left text-xs opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {item.filename}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : loading ? (
        <div className="text-muted-foreground flex justify-center py-16">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <EmptyState
          icon={ImageIcon}
          title={query ? "No matching files" : "No media yet"}
          description={
            query
              ? "Try a different search."
              : "Drop images here or use the Upload button."
          }
        />
      )}

      {page?.nextCursor && (
        <Button
          variant="outline"
          className="self-center"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            void load(query.trim(), page.nextCursor!);
          }}
        >
          Load more
        </Button>
      )}

      {dragging && (
        <div className="border-primary bg-background/80 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed backdrop-blur-sm">
          <p className="text-primary flex items-center gap-2 font-medium">
            <Upload className="size-5" /> Drop images to upload
          </p>
        </div>
      )}

      {mode === "manage" && (
        <MediaDetailsSheet
          item={selected}
          onOpenChange={(open) => !open && setSelected(null)}
          onChange={replaceItem}
          onDeleted={removeItem}
        />
      )}
    </div>
  );
}
