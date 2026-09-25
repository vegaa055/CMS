"use client";

import { Loader2 } from "lucide-react";
import { Suspense, use, useState } from "react";

import {
  fetchMediaPage,
  MediaBrowser,
} from "@/components/admin/media/media-browser";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MediaItem, MediaPage } from "@/lib/media/types";

function PickerBody({
  page,
  onPick,
}: {
  page: Promise<MediaPage>;
  onPick: (item: MediaItem) => void;
}) {
  return <MediaBrowser mode="pick" initialPage={use(page)} onPick={onPick} />;
}

/** Choose an existing image or upload a new one. */
export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
  title = "Choose an image",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: MediaItem) => void;
  title?: string;
}) {
  // Start a fresh fetch each time the dialog opens (derived during render,
  // not in an effect, so there's no extra render or loading flash).
  const [page, setPage] = useState<Promise<MediaPage> | null>(null);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    setPage(
      open
        ? fetchMediaPage().catch(() => ({ items: [], nextCursor: null }))
        : null,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pick from the library, or upload (drag and drop works too).
          </DialogDescription>
        </DialogHeader>
        {page && (
          <Suspense
            fallback={
              <div className="text-muted-foreground flex justify-center py-16">
                <Loader2 className="animate-spin" />
              </div>
            }
          >
            <PickerBody
              page={page}
              onPick={(item) => {
                onSelect(item);
                onOpenChange(false);
              }}
            />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}
