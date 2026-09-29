"use client";

import { Flag, Loader2, Pencil, Reply, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteComment,
  editComment,
  postComment,
  reportComment,
} from "@/app/(site)/posts/actions";
import { UserAvatar } from "@/components/admin/user-avatar";
import { ResendVerification } from "@/components/auth/resend-verification";
import { CommentBody } from "@/components/comments/comment-body";
import { RelativeTime } from "@/components/relative-time";
import { CommentForm } from "@/components/site/comments/comment-form";
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
  applyThreadChanges,
  canEditComment,
  countThread,
  NO_THREAD_CHANGES,
  REPORT_REASONS,
  type ReportReason,
  type ThreadChanges,
  type ThreadComment,
} from "@/lib/comments";

type Viewer = {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  moderator: boolean;
  /** Their next comment waits for a moderator. */
  held: boolean;
};

/** From /api/posts/[id]/comments. */
type ViewerState = {
  open: boolean;
  viewer: Viewer | null;
  canSignUp: boolean;
  /** Their own comments awaiting approval (only they see these). */
  pending: ThreadComment[];
};

type ReplyTarget = {
  /** The top-level comment whose replies get the form. */
  threadId: string;
  /** The comment being answered (may be a reply in that thread). */
  targetId: string;
  mention: string;
};

function DeleteComment({
  own,
  onDelete,
}: {
  own: boolean;
  onDelete: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-7 px-2"
        onClick={() => setOpen(true)}
      >
        <Trash2 /> Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {own ? "Delete your comment?" : "Delete this comment?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              It&apos;s removed for good. If it has replies, a
              &ldquo;deleted&rdquo; note stays in its place so they still make
              sense.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  if (await onDelete()) setOpen(false);
                })
              }
            >
              {pending && <Loader2 className="animate-spin" />}
              Delete comment
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ReportComment({
  name,
  onReport,
}: {
  name: string;
  onReport: (reason: ReportReason) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-7 px-2"
        onClick={() => setOpen(true)}
      >
        <Flag /> Report
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report {name}&apos;s comment?</AlertDialogTitle>
            <AlertDialogDescription>
              It&apos;s hidden until a moderator reviews it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              What&apos;s wrong with it?
            </legend>
            {Object.entries(REPORT_REASONS).map(([value, label]) => (
              <label
                key={value}
                className="has-checked:border-primary flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value as ReportReason)}
                  className="accent-primary"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  if (await onReport(reason)) setOpen(false);
                })
              }
            >
              {pending && <Loader2 className="animate-spin" />}
              Report comment
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CommentItem({
  comment,
  viewer,
  canComment,
  canEdit,
  editing,
  onReply,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onReport,
}: {
  comment: ThreadComment;
  viewer: Viewer | null;
  canComment: boolean;
  canEdit: boolean;
  editing: boolean;
  onReply: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (body: string) => Promise<string | null>;
  onDelete: () => Promise<boolean>;
  onReport: (reason: ReportReason) => Promise<boolean>;
}) {
  const anchor = `comment-${comment.id}`;
  if (comment.deleted || comment.hidden) {
    return (
      <p
        id={anchor}
        className="text-muted-foreground scroll-mt-24 py-1 text-sm italic"
      >
        {comment.deleted
          ? "This comment was deleted."
          : "This comment is hidden."}
      </p>
    );
  }

  const name = comment.author?.name ?? "Deleted reader";
  const own = Boolean(viewer && comment.author?.id === viewer.id);
  const approved = comment.status === "approved";
  // Readers flag other readers' comments; moderators just act on them.
  const canReport = Boolean(
    viewer?.verified &&
    !viewer.moderator &&
    !own &&
    approved &&
    !comment.author?.badge,
  );
  return (
    <article
      id={anchor}
      aria-label={`Comment by ${name}`}
      className="flex scroll-mt-24 gap-3"
    >
      <UserAvatar
        name={name}
        image={comment.author?.image}
        className="size-8 shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium">{name}</span>
          {comment.author?.badge && (
            <Badge variant="secondary">
              {comment.author.badge === "author" ? "Author" : "Team"}
            </Badge>
          )}
          <a
            href={`#${anchor}`}
            className="text-muted-foreground text-xs underline-offset-4 hover:underline"
          >
            <RelativeTime date={comment.createdAt} />
          </a>
          {comment.editedAt && (
            <span className="text-muted-foreground text-xs">· edited</span>
          )}
          {!approved && <Badge variant="outline">Awaiting approval</Badge>}
        </header>
        {editing ? (
          <CommentForm
            label="Edit your comment"
            submitLabel="Save"
            initialValue={comment.body}
            autoFocus
            onSubmit={onSave}
            onCancel={onCancelEdit}
          />
        ) : (
          <CommentBody text={comment.body} className="text-[0.95rem]" />
        )}
        {!editing && viewer && (
          <div className="-ml-2 flex flex-wrap gap-1">
            {canComment && approved && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-7 px-2"
                onClick={onReply}
              >
                <Reply /> Reply
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-7 px-2"
                onClick={onEdit}
              >
                <Pencil /> Edit
              </Button>
            )}
            {(own || viewer.moderator) && (
              <DeleteComment own={own} onDelete={onDelete} />
            )}
            {canReport && <ReportComment name={name} onReport={onReport} />}
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * A post's comments. The published thread arrives with the (cached) page;
 * who's reading, their comments awaiting approval, and every control load
 * in the browser. Changes show straight away, while the page catches up.
 */
export function Comments({
  postId,
  path,
  open,
  thread,
}: {
  postId: string;
  path: string;
  /** Whether comments were open when the page was cached. */
  open: boolean;
  thread: ThreadComment[];
}) {
  const [state, setState] = useState<ViewerState | null>(null);
  const [changes, setChanges] = useState<ThreadChanges>(NO_THREAD_CHANGES);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/posts/${postId}/comments`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ViewerState | null) => {
        if (!cancelled && data) setState(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const viewer = state?.viewer ?? null;
  const isOpen = state?.open ?? open;
  const canComment = isOpen && Boolean(viewer?.verified);
  const comments = applyThreadChanges(thread, {
    ...changes,
    added: [...(state?.pending ?? []), ...changes.added],
  });
  const total = countThread(comments);
  const next = `?next=${encodeURIComponent(path)}`;
  const hint = viewer?.held
    ? "A moderator will review your comment before it appears."
    : viewer
      ? `Commenting as ${viewer.name}`
      : undefined;

  async function add(body: string, parentId: string | null) {
    const result = await postComment({ postId, parentId, body });
    if (!result.ok) return result.error;
    const comment = result.data;
    setChanges((c) => ({ ...c, added: [...c.added, comment] }));
    setReplyTo(null);
    toast.success(
      comment.status === "approved"
        ? parentId
          ? "Reply posted"
          : "Comment posted"
        : "Thanks! It will appear once a moderator approves it.",
    );
    return null;
  }

  async function save(id: string, body: string) {
    const result = await editComment({ id, body });
    if (!result.ok) return result.error;
    setChanges((c) => ({ ...c, edited: { ...c.edited, [id]: result.data } }));
    setEditing(null);
    toast.success(
      result.data.status === "approved"
        ? "Comment updated"
        : "Saved. A moderator will review it before it appears.",
    );
    return null;
  }

  async function report(id: string, reason: ReportReason) {
    const result = await reportComment({ id, reason });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    setChanges((c) => ({ ...c, removed: { ...c.removed, [id]: "hidden" } }));
    toast.success("Thanks for letting us know. A moderator will take a look.");
    return true;
  }

  async function remove(id: string) {
    const result = await deleteComment(id);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    setChanges((c) => ({
      ...c,
      removed: { ...c.removed, [id]: result.data.removed },
    }));
    toast.success("Comment deleted");
    return true;
  }

  const item = (comment: ThreadComment, thread: ThreadComment) => (
    <CommentItem
      comment={comment}
      viewer={viewer}
      canComment={canComment}
      canEdit={
        isOpen &&
        canEditComment(
          {
            authorId: comment.author?.id ?? null,
            createdAt: comment.createdAt,
          },
          viewer?.id,
        )
      }
      editing={editing === comment.id}
      onReply={() =>
        setReplyTo({
          threadId: thread.id,
          targetId: comment.id,
          mention:
            comment.id !== thread.id && comment.author
              ? `@${comment.author.name} `
              : "",
        })
      }
      onEdit={() => setEditing(comment.id)}
      onCancelEdit={() => setEditing(null)}
      onSave={(body) => save(comment.id, body)}
      onDelete={() => remove(comment.id)}
      onReport={(reason) => report(comment.id, reason)}
    />
  );

  return (
    <>
      <h2
        id="comments-heading"
        className="font-display text-2xl tracking-tight"
      >
        {total > 0
          ? `${total} ${total === 1 ? "comment" : "comments"}`
          : "Comments"}
      </h2>

      {comments.length > 0 && (
        <ol className="flex flex-col gap-6">
          {comments.map((comment) => {
            const replying = canComment && replyTo?.threadId === comment.id;
            return (
              <li key={comment.id} className="flex flex-col gap-4">
                {item(comment, comment)}
                {(comment.replies.length > 0 || replying) && (
                  <ol className="ml-4 flex flex-col gap-4 border-l pl-4 sm:ml-11">
                    {comment.replies.map((reply) => (
                      <li key={reply.id}>{item(reply, comment)}</li>
                    ))}
                    {replying && (
                      <li>
                        <CommentForm
                          key={`${replyTo.targetId}-${replyTo.mention}`}
                          label={`Reply to ${comment.author?.name ?? "this comment"}`}
                          placeholder="Write a reply…"
                          submitLabel="Post reply"
                          initialValue={replyTo.mention}
                          hint={hint}
                          autoFocus
                          onSubmit={(body) => add(body, replyTo.targetId)}
                          onCancel={() => setReplyTo(null)}
                        />
                      </li>
                    )}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!isOpen ? (
        <p className="text-muted-foreground text-sm">Comments are closed.</p>
      ) : !state ? (
        // Same footprint as the comment box while the viewer loads.
        <div
          aria-hidden
          className="bg-muted/50 h-32 animate-pulse rounded-lg"
        />
      ) : !viewer ? (
        <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            {comments.length > 0
              ? "Sign in to join the conversation."
              : "Sign in to start the conversation."}
          </p>
          <div className="flex gap-2">
            <Button size="sm" asChild>
              <Link href={`/login${next}`}>Sign in to comment</Link>
            </Button>
            {state.canSignUp && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/register${next}`}>Create account</Link>
              </Button>
            )}
          </div>
        </div>
      ) : !viewer.verified ? (
        <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Confirm your email to comment</p>
            <p className="text-muted-foreground text-sm">
              Use the link we sent to {viewer.email}, then come back here.
            </p>
          </div>
          <ResendVerification email={viewer.email} next={path} compact />
        </div>
      ) : (
        <CommentForm
          label="Add a comment"
          placeholder={
            comments.length > 0
              ? "Add to the conversation…"
              : "Start the conversation…"
          }
          submitLabel="Post comment"
          hint={hint}
          onSubmit={(body) => add(body, null)}
        />
      )}
    </>
  );
}
