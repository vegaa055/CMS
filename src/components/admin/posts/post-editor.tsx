"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Typography from "@tiptap/extension-typography";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Check,
  ExternalLink,
  Eye,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { savePost, type SavedPost } from "@/app/admin/posts/actions";
import { MediaPickerDialog } from "@/components/admin/media/media-picker-dialog";
import { DeletePostDialog } from "@/components/admin/posts/delete-post-dialog";
import { EditorToolbar } from "@/components/admin/posts/editor-toolbar";
import { TagPicker } from "@/components/admin/posts/tag-picker";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RichTextDoc } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { contentExtensions, EMPTY_DOC } from "@/lib/editor/extensions";
import { toPlainDoc } from "@/lib/editor/serialize";
import { formatDateTime, toDateTimeLocal } from "@/lib/format";
import { readingTime, type PostStatus } from "@/lib/posts/status";
import { postPath, previewPath } from "@/lib/posts/urls";
import { slugify } from "@/lib/slug";
import { SLUG_PATTERN } from "@/lib/validation/post";

export type PostEditorPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: RichTextDoc | null;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  coverImage: CoverImage | null;
  status: PostStatus;
  publishedAt: string | null;
  updatedAt: string;
};

type CoverImage = { id: string; url: string; alt: string | null };

export type PostEditorProps = {
  post: PostEditorPost | null;
  allTags: string[];
  permissions: {
    canPublish: boolean;
    canCreateTags: boolean;
    canDelete: boolean;
  };
};

const formSchema = z.object({
  title: z.string().max(200, "Keep the title under 200 characters"),
  slug: z
    .string()
    .max(200)
    .refine((v) => v === "" || SLUG_PATTERN.test(v), {
      message: "Use lowercase letters, numbers, and single hyphens",
    }),
  excerpt: z.string().max(500, "Keep the excerpt under 500 characters"),
  tags: z.array(z.string()).max(20, "Up to 20 tags"),
  seoTitle: z.string().max(70, "Keep it under 70 characters"),
  seoDescription: z.string().max(160, "Keep it under 160 characters"),
  coverImage: z
    .object({ id: z.string(), url: z.string(), alt: z.string().nullable() })
    .nullable(),
  scheduleAt: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

type Intent =
  "autosave" | "save" | "publish" | "schedule" | "unpublish" | "archive";
type SaveState = "saved" | "dirty" | "saving" | "error";
type Meta = {
  id: string | null;
  status: PostStatus;
  publishedAt: string | null;
  updatedAt: string | null;
};

const AUTOSAVE_DELAY_MS = 1500;

const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

function SaveIndicator({
  state,
  updatedAt,
  error,
}: {
  state: SaveState;
  updatedAt: string | null;
  error: string | null;
}) {
  const content = {
    saving: (
      <>
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </>
    ),
    dirty: <>Unsaved changes</>,
    error: (
      <>
        <AlertCircle className="text-destructive size-3.5" /> Not saved
      </>
    ),
    saved: updatedAt ? (
      <>
        <Check className="text-success size-3.5" /> Saved{" "}
        {timeFormat.format(new Date(updatedAt))}
      </>
    ) : (
      <>New draft</>
    ),
  }[state];

  return (
    <span
      className="text-muted-foreground flex items-center gap-1.5 text-xs"
      role="status"
      title={state === "error" ? (error ?? undefined) : undefined}
    >
      {content}
    </span>
  );
}

function CoverImageField({
  value,
  onChange,
  error,
}: {
  value: CoverImage | null;
  onChange: (value: CoverImage | null) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="bg-muted relative aspect-video overflow-hidden rounded-lg border">
          <Image
            src={value.url}
            alt={value.alt ?? ""}
            fill
            sizes="20rem"
            className="object-cover"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:border-primary/50 hover:text-foreground flex aspect-video flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm transition-colors"
        >
          <ImagePlus className="size-5" />
          Choose a cover image
        </button>
      )}
      {value && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
          >
            Change
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        </div>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
      <MediaPickerDialog
        open={open}
        onOpenChange={setOpen}
        title="Choose a cover image"
        onSelect={(item) =>
          onChange({ id: item.id, url: item.url, alt: item.alt })
        }
      />
    </div>
  );
}

export function PostEditor({ post, allTags, permissions }: PostEditorProps) {
  const router = useRouter();
  const [meta, setMeta] = useState<Meta>(() => ({
    id: post?.id ?? null,
    status: post?.status ?? "draft",
    publishedAt: post?.publishedAt ?? null,
    updatedAt: post?.updatedAt ?? null,
  }));
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [lastError, setLastError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tagOptions, setTagOptions] = useState(allTags);

  // Refs hold the latest values for async save callbacks.
  const metaRef = useRef(meta);
  const versionRef = useRef(0);
  const suppressDirtyRef = useRef(false);
  const autoSlugRef = useRef(false);
  const slugLockedRef = useRef(
    post ? post.status !== "draft" || post.slug !== slugify(post.title) : false,
  );
  const timerRef = useRef<number | undefined>(undefined);
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      title: post?.title ?? "",
      slug: post?.slug ?? "",
      excerpt: post?.excerpt ?? "",
      tags: post?.tags ?? [],
      seoTitle: post?.seoTitle ?? "",
      seoDescription: post?.seoDescription ?? "",
      coverImage: post?.coverImage ?? null,
      scheduleAt:
        post?.status === "scheduled" ? toDateTimeLocal(post.publishedAt) : "",
    },
  });
  const [seoTitle, seoDescription, title, excerpt, slug] = useWatch({
    control: form.control,
    name: ["seoTitle", "seoDescription", "title", "excerpt", "slug"],
  });

  const editor = useEditor({
    extensions: [
      ...contentExtensions,
      Placeholder.configure({ placeholder: "Start writing…" }),
      Typography,
      CharacterCount,
    ],
    content: post?.content ?? EMPTY_DOC,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-folio max-w-none min-h-[50vh] pb-16",
        "aria-label": "Post content",
      },
    },
  });
  const words =
    useEditorState({
      editor,
      selector: ({ editor: e }) => e?.storage.characterCount.words() ?? 0,
    }) ?? 0;

  const updateMeta = useCallback((next: Meta) => {
    metaRef.current = next;
    setMeta(next);
  }, []);

  const save = useCallback(
    (intent: Intent): Promise<boolean> => {
      const run = async () => {
        if (!editor) return false;
        window.clearTimeout(timerRef.current);

        if (!(await form.trigger())) {
          setSaveState("error");
          setLastError("Fix the highlighted fields.");
          if (intent !== "autosave") toast.error("Fix the highlighted fields.");
          return false;
        }

        const values = form.getValues();
        const current = metaRef.current;
        let status = current.status;
        let publishedAt = current.publishedAt;
        switch (intent) {
          case "publish":
            status = "published";
            publishedAt =
              current.status === "published"
                ? current.publishedAt
                : new Date().toISOString();
            break;
          case "schedule":
            if (!values.scheduleAt) {
              form.setError("scheduleAt", {
                message: "Pick a date and time",
              });
              return false;
            }
            status = "scheduled";
            publishedAt = new Date(values.scheduleAt).toISOString();
            break;
          case "unpublish":
            status = "draft";
            publishedAt = null;
            break;
          case "archive":
            status = "archived";
            break;
        }

        const version = versionRef.current;
        setSaveState("saving");
        let result: ActionResult<SavedPost>;
        try {
          result = await savePost({
            id: current.id ?? undefined,
            title: values.title,
            slug: values.slug,
            excerpt: values.excerpt,
            content: toPlainDoc(editor.getJSON()),
            tags: values.tags,
            seoTitle: values.seoTitle,
            seoDescription: values.seoDescription,
            coverImageId: values.coverImage?.id ?? null,
            status,
            publishedAt,
          });
        } catch {
          result = {
            ok: false,
            error: "Couldn't reach the server. Check your connection.",
          };
        }

        if (!result.ok) {
          setSaveState("error");
          setLastError(result.error);
          for (const [field, message] of Object.entries(
            result.fieldErrors ?? {},
          )) {
            const key = field === "publishedAt" ? "scheduleAt" : field;
            if (key in values) {
              form.setError(key as keyof FormValues, { message });
            }
          }
          if (intent !== "autosave") toast.error(result.error);
          return false;
        }

        const saved = result.data;
        if (!current.id) {
          // Swap /admin/posts/new for the real id without remounting the editor.
          window.history.replaceState(null, "", `/admin/posts/${saved.id}`);
        }
        updateMeta({
          id: saved.id,
          status: saved.status,
          publishedAt: saved.publishedAt,
          updatedAt: saved.updatedAt,
        });
        if (saved.status !== "draft") slugLockedRef.current = true;
        if (saved.slug !== values.slug) {
          suppressDirtyRef.current = true;
          form.setValue("slug", saved.slug);
          suppressDirtyRef.current = false;
        }
        if (saved.status === "scheduled") {
          form.setValue("scheduleAt", toDateTimeLocal(saved.publishedAt));
        }
        setTagOptions((prev) =>
          [...new Set([...prev, ...values.tags])].sort((a, b) =>
            a.localeCompare(b),
          ),
        );
        setLastError(null);
        setSaveState(versionRef.current === version ? "saved" : "dirty");

        if (intent !== "autosave") {
          const message =
            saved.status === "scheduled"
              ? `Scheduled for ${formatDateTime(saved.publishedAt)}`
              : intent === "publish"
                ? "Published"
                : intent === "unpublish"
                  ? "Reverted to draft"
                  : intent === "archive"
                    ? "Archived"
                    : "Saved";
          toast.success(message);
        }
        return true;
      };

      const next = chainRef.current.then(run, run);
      chainRef.current = next;
      return next;
    },
    [editor, form, updateMeta],
  );

  const markDirty = useCallback(() => {
    if (suppressDirtyRef.current) return;
    versionRef.current += 1;
    setSaveState("dirty");
    window.clearTimeout(timerRef.current);
    // Live posts only change on an explicit Update; drafts autosave.
    if (metaRef.current.status !== "draft") return;
    timerRef.current = window.setTimeout(() => {
      const untouched =
        !metaRef.current.id &&
        !form.getValues("title").trim() &&
        editor?.isEmpty;
      if (!untouched) void save("autosave");
    }, AUTOSAVE_DELAY_MS);
  }, [editor, form, save]);

  // Editor changes.
  useEffect(() => {
    if (!editor) return;
    editor.on("update", markDirty);
    return () => {
      editor.off("update", markDirty);
    };
  }, [editor, markDirty]);

  // Form changes, plus slug-follows-title until the slug is edited by hand.
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ values, name }) => {
          if (!name || name === "scheduleAt") return;
          if (name === "title" && !slugLockedRef.current) {
            autoSlugRef.current = true;
            form.setValue("slug", slugify(values.title), {
              shouldValidate: true,
            });
            autoSlugRef.current = false;
          }
          if (
            name === "slug" &&
            !autoSlugRef.current &&
            !suppressDirtyRef.current
          ) {
            slugLockedRef.current = true;
          }
          markDirty();
        },
      }),
    [form, markDirty],
  );

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save("save");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [save]);

  // Warn before leaving with unsaved work.
  useEffect(() => {
    if (saveState === "saved") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const { errors } = form.formState;
  const busy = saveState === "saving";
  const { canPublish } = permissions;
  const isDraft = meta.status === "draft";
  const isLive = meta.status === "published";
  const isScheduled = meta.status === "scheduled";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href="/admin/posts">
            <ArrowLeft /> Posts
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <SaveIndicator
            state={saveState}
            updatedAt={meta.updatedAt}
            error={lastError}
          />
          {meta.status === "published" && slug && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={postPath(slug)} target="_blank">
                <ExternalLink /> View
              </Link>
            </Button>
          )}
          {meta.id ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={previewPath(meta.id)} target="_blank">
                <Eye /> Preview
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <Eye /> Preview
            </Button>
          )}
          {meta.id && (canPublish || permissions.canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="More actions"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canPublish && meta.status !== "archived" && (
                  <DropdownMenuItem onSelect={() => void save("archive")}>
                    <Archive /> Archive
                  </DropdownMenuItem>
                )}
                {permissions.canDelete && (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteOpen(true)}
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <textarea
            {...form.register("title")}
            rows={1}
            placeholder="Post title"
            aria-label="Title"
            aria-invalid={Boolean(errors.title)}
            className="font-display placeholder:text-muted-foreground/50 field-sizing-content w-full resize-none bg-transparent text-4xl leading-tight tracking-tight outline-none md:text-5xl"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editor?.commands.focus("start");
              }
            }}
          />
          {errors.title && (
            <p className="text-destructive text-sm">{errors.title.message}</p>
          )}

          <div className="bg-background/90 sticky top-14 z-[5] -mx-2 border-b px-2 py-1.5 backdrop-blur">
            {editor && <EditorToolbar editor={editor} />}
          </div>
          <EditorContent editor={editor} />
          <p className="text-muted-foreground text-xs">
            {words} {words === 1 ? "word" : "words"} · {readingTime(words)} min
            read
          </p>
        </div>

        {/* Sticky, independently scrolling sidebar. Cards must not shrink:
            they clip their overflow, so flex would squash them instead of
            letting the column scroll. */}
        <aside className="flex flex-col gap-4 *:shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100svh-6rem)] lg:self-start lg:overflow-y-auto lg:pb-4">
          <Card>
            <CardHeader>
              <CardTitle>Publish</CardTitle>
              <CardAction>
                <StatusBadge status={meta.status} />
              </CardAction>
              {isLive && (
                <CardDescription>
                  Published {formatDateTime(meta.publishedAt)}
                </CardDescription>
              )}
              {isScheduled && (
                <CardDescription>
                  Goes live {formatDateTime(meta.publishedAt)}
                </CardDescription>
              )}
            </CardHeader>
            {canPublish && (isDraft || isScheduled) && (
              <CardContent>
                <Field data-invalid={Boolean(errors.scheduleAt)}>
                  <FieldLabel htmlFor="scheduleAt">
                    {isScheduled ? "Reschedule" : "Schedule for later"}
                  </FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="scheduleAt"
                      type="datetime-local"
                      min={toDateTimeLocal(new Date())}
                      {...form.register("scheduleAt")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void save("schedule")}
                    >
                      {isScheduled ? "Update" : "Schedule"}
                    </Button>
                  </div>
                  <FieldError errors={[errors.scheduleAt]} />
                </Field>
              </CardContent>
            )}
            <CardFooter className="flex flex-col gap-2">
              {isDraft || meta.status === "archived" ? (
                <>
                  {canPublish && (
                    <Button
                      className="w-full"
                      disabled={busy}
                      onClick={() => void save("publish")}
                    >
                      Publish now
                    </Button>
                  )}
                  <Button
                    variant={canPublish ? "outline" : "default"}
                    className="w-full"
                    disabled={busy}
                    onClick={() =>
                      void save(
                        meta.status === "archived" ? "unpublish" : "save",
                      )
                    }
                  >
                    {meta.status === "archived"
                      ? "Restore as draft"
                      : "Save draft"}
                  </Button>
                  {!canPublish && (
                    <p className="text-muted-foreground text-center text-xs">
                      An editor will review and publish your post.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <Button
                    className="w-full"
                    disabled={busy}
                    onClick={() => void save("save")}
                  >
                    Update
                  </Button>
                  {isScheduled && (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={busy}
                      onClick={() => void save("publish")}
                    >
                      Publish now
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full"
                    disabled={busy}
                    onClick={() => void save("unpublish")}
                  >
                    {isScheduled ? "Unschedule" : "Unpublish"}
                  </Button>
                </>
              )}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cover image</CardTitle>
            </CardHeader>
            <CardContent>
              <Controller
                name="coverImage"
                control={form.control}
                render={({ field, fieldState }) => (
                  <CoverImageField
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-invalid={Boolean(errors.slug)}>
                  <FieldLabel htmlFor="slug">URL slug</FieldLabel>
                  <Input
                    id="slug"
                    placeholder={slugify(title) || "post-url"}
                    className="font-mono text-xs"
                    aria-invalid={Boolean(errors.slug)}
                    {...form.register("slug")}
                  />
                  {errors.slug ? (
                    <FieldError errors={[errors.slug]} />
                  ) : (
                    <FieldDescription className="truncate font-mono text-xs">
                      {postPath(form.getValues("slug") || "…")}
                    </FieldDescription>
                  )}
                </Field>
                <Field data-invalid={Boolean(errors.excerpt)}>
                  <FieldLabel htmlFor="excerpt">Excerpt</FieldLabel>
                  <Textarea
                    id="excerpt"
                    rows={3}
                    placeholder="A short summary shown in post lists"
                    aria-invalid={Boolean(errors.excerpt)}
                    {...form.register("excerpt")}
                  />
                  <FieldError errors={[errors.excerpt]} />
                </Field>
                <Field data-invalid={Boolean(errors.tags)}>
                  <FieldLabel>Tags</FieldLabel>
                  <Controller
                    name="tags"
                    control={form.control}
                    render={({ field }) => (
                      <TagPicker
                        value={field.value}
                        onChange={field.onChange}
                        options={tagOptions}
                        canCreate={permissions.canCreateTags}
                        invalid={Boolean(errors.tags)}
                      />
                    )}
                  />
                  <FieldError errors={[errors.tags]} />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Search & social</CardTitle>
              <CardDescription>
                Optional overrides for search engines and link previews.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-invalid={Boolean(errors.seoTitle)}>
                  <FieldLabel htmlFor="seoTitle">Meta title</FieldLabel>
                  <Input
                    id="seoTitle"
                    placeholder={title || "Defaults to the post title"}
                    aria-invalid={Boolean(errors.seoTitle)}
                    {...form.register("seoTitle")}
                  />
                  <FieldDescription className="text-right tabular-nums">
                    {seoTitle.length}/70
                  </FieldDescription>
                  <FieldError errors={[errors.seoTitle]} />
                </Field>
                <Field data-invalid={Boolean(errors.seoDescription)}>
                  <FieldLabel htmlFor="seoDescription">
                    Meta description
                  </FieldLabel>
                  <Textarea
                    id="seoDescription"
                    rows={3}
                    placeholder={excerpt || "Defaults to the excerpt"}
                    aria-invalid={Boolean(errors.seoDescription)}
                    {...form.register("seoDescription")}
                  />
                  <FieldDescription className="text-right tabular-nums">
                    {seoDescription.length}/160
                  </FieldDescription>
                  <FieldError errors={[errors.seoDescription]} />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </aside>
      </div>

      {meta.id && (
        <DeletePostDialog
          postId={meta.id}
          title={title}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => {
            // Nothing left to save; don't trigger the unsaved-changes prompt.
            setSaveState("saved");
            router.push("/admin/posts");
          }}
        />
      )}
    </div>
  );
}
