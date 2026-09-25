"use client";

import { Copy, ExternalLink, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteMedia,
  mediaUsage,
  updateMediaAlt,
} from "@/app/admin/media/actions";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { formatBytes } from "@/lib/media/constants";
import type { MediaItem } from "@/lib/media/types";

function DeleteMediaButton({
  item,
  onDeleted,
}: {
  item: MediaItem;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setUsage(null);
    setOpen(true);
    void mediaUsage(item.id).then((r) => setUsage(r.ok ? r.data : 0));
  }

  function confirm() {
    startTransition(async () => {
      const result = await deleteMedia(item.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("File deleted");
      setOpen(false);
      onDeleted();
    });
  }

  return (
    <>
      <Button variant="destructive" onClick={openDialog}>
        <Trash2 /> Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              {usage === null
                ? "Checking where it's used…"
                : usage > 0
                  ? `It's used in ${usage} ${usage === 1 ? "post" : "posts"}. Those images will stop showing. This can't be undone.`
                  : "It isn't used in any posts. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={confirm}
              disabled={pending || usage === null}
            >
              {pending && <Loader2 className="animate-spin" />}
              Delete file
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AltTextForm({
  item,
  onSaved,
}: {
  item: MediaItem;
  onSaved: (alt: string | null) => void;
}) {
  const [alt, setAlt] = useState(item.alt ?? "");
  const [pending, startTransition] = useTransition();
  const dirty = alt.trim() !== (item.alt ?? "");

  function save() {
    startTransition(async () => {
      const result = await updateMediaAlt(item.id, alt);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Alt text saved");
      onSaved(result.data.alt);
    });
  }

  return (
    <Field>
      <FieldLabel htmlFor="media-alt">Alt text</FieldLabel>
      <Textarea
        id="media-alt"
        rows={3}
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        disabled={!item.canManage}
        placeholder="Describe the image for screen readers"
      />
      <FieldDescription>
        Used when the image is inserted into posts and for cover images.
      </FieldDescription>
      {item.canManage && (
        <Button
          size="sm"
          className="w-fit"
          onClick={save}
          disabled={!dirty || pending}
        >
          {pending && <Loader2 className="animate-spin" />}
          Save alt text
        </Button>
      )}
    </Field>
  );
}

export function MediaDetailsSheet({
  item,
  onOpenChange,
  onChange,
  onDeleted,
}: {
  item: MediaItem | null;
  onOpenChange: (open: boolean) => void;
  onChange: (item: MediaItem) => void;
  onDeleted: (id: string) => void;
}) {
  async function copyUrl() {
    if (!item) return;
    await navigator.clipboard.writeText(
      new URL(item.url, location.origin).href,
    );
    toast.success("URL copied");
  }

  return (
    <Sheet open={item !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle className="truncate pr-6">{item.filename}</SheetTitle>
              <SheetDescription>
                Uploaded {formatDate(item.createdAt)}
                {item.uploadedBy && ` by ${item.uploadedBy.name}`}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-6 px-4">
              <div className="bg-muted relative aspect-video overflow-hidden rounded-lg border">
                <Image
                  src={item.url}
                  alt={item.alt ?? ""}
                  fill
                  sizes="(min-width: 640px) 28rem, 100vw"
                  className="object-contain"
                />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Type</dt>
                <dd>{item.mimeType.replace("image/", "").toUpperCase()}</dd>
                <dt className="text-muted-foreground">Size</dt>
                <dd>{formatBytes(item.size)}</dd>
                {item.width && item.height && (
                  <>
                    <dt className="text-muted-foreground">Dimensions</dt>
                    <dd>
                      {item.width} × {item.height}
                    </dd>
                  </>
                )}
              </dl>
              <AltTextForm
                key={item.id}
                item={item}
                onSaved={(alt) => onChange({ ...item, alt })}
              />
            </div>
            <SheetFooter className="flex-row flex-wrap">
              <Button variant="outline" onClick={copyUrl}>
                <Copy /> Copy URL
              </Button>
              <Button variant="outline" asChild>
                <a href={item.url} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open
                </a>
              </Button>
              {item.canManage && (
                <DeleteMediaButton
                  item={item}
                  onDeleted={() => onDeleted(item.id)}
                />
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
