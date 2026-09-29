"use client";

import { Ban, Check, Flag, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import {
  deleteAllSpam,
  moderateComment,
  moderateComments,
  spamAndBan,
  type ModerationAction,
} from "@/app/admin/comments/actions";
import { CommentBody } from "@/components/comments/comment-body";
import { RelativeTime } from "@/components/relative-time";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  REPORT_REASONS,
  type CommentStatus,
  type ReportReason,
} from "@/lib/comments";
import { postPath } from "@/lib/posts/urls";
import type { ModerationRow } from "@/lib/queries/comments";

const DONE: Record<ModerationAction, [one: string, many: string]> = {
  approve: ["Comment approved", "comments approved"],
  spam: ["Marked as spam", "comments marked as spam"],
  delete: ["Comment deleted", "comments deleted"],
};

function done(action: ModerationAction, count: number) {
  const [one, many] = DONE[action];
  return count === 1 ? one : `${count} ${many}`;
}

/** A confirm step for the actions that can't be undone. */
function Confirm({
  open,
  onOpenChange,
  title,
  description,
  action,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  action: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending && <Loader2 className="animate-spin" />}
            {action}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ModerationItem({
  comment,
  selected,
  onSelect,
  canBan,
}: {
  comment: ModerationRow;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  canBan: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"delete" | "ban" | null>(null);
  const author = comment.author?.name ?? "Deleted reader";
  const bannable =
    canBan && comment.author && !comment.author.staff && !comment.author.banned;

  function run(action: ModerationAction) {
    startTransition(async () => {
      const result = await moderateComment(comment.id, action);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirm(null);
      toast.success(done(action, 1));
    });
  }

  function banAuthor() {
    startTransition(async () => {
      const result = await spamAndBan(comment.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirm(null);
      toast.success(`Marked as spam and banned ${author}`);
    });
  }

  const href =
    postPath(comment.post.slug) +
    (comment.status === "approved" ? `#comment-${comment.id}` : "");

  return (
    <li className="flex gap-3 p-4" aria-label={`Comment by ${author}`}>
      <Checkbox
        className="mt-0.5"
        checked={selected}
        onCheckedChange={(value) => onSelect(value === true)}
        aria-label={`Select comment by ${author}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium">{author}</span>
          {comment.author?.staff && <Badge variant="secondary">Team</Badge>}
          {comment.author?.banned && (
            <Badge variant="destructive">Banned</Badge>
          )}
          {comment.author && (
            <span className="text-muted-foreground text-xs">
              {comment.author.email}
            </span>
          )}
          <span className="text-muted-foreground text-xs">
            · <RelativeTime date={comment.createdAt} />
            {comment.edited && " · edited"}
          </span>
          {comment.held && comment.held !== "Reported" && (
            <Badge variant="outline">{comment.held}</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          {comment.reply
            ? `Reply to ${comment.reply.to ?? "a deleted reader"} on `
            : "On "}
          <Link
            href={href}
            target="_blank"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            {comment.post.title}
          </Link>
        </p>
        {comment.reports && (
          <p className="text-destructive flex items-center gap-1.5 text-xs font-medium">
            <Flag className="size-3.5" aria-hidden />
            Reported by {comment.reports.count}{" "}
            {comment.reports.count === 1 ? "reader" : "readers"}:{" "}
            {comment.reports.reasons
              .map((r) => REPORT_REASONS[r as ReportReason] ?? r)
              .join(", ")}
          </p>
        )}
        <CommentBody text={comment.body} links={false} className="text-sm" />
        <div className="flex flex-wrap gap-2">
          {comment.status !== "approved" && (
            <Button size="sm" disabled={pending} onClick={() => run("approve")}>
              <Check /> {comment.reports ? "Keep" : "Approve"}
            </Button>
          )}
          {comment.status !== "spam" && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run("spam")}
            >
              <ShieldAlert /> Spam
            </Button>
          )}
          {bannable && comment.status !== "spam" && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirm("ban")}
            >
              <Ban /> Spam + ban
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setConfirm("delete")}
          >
            <Trash2 /> Delete
          </Button>
        </div>
      </div>
      <Confirm
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Delete this comment?"
        description="It's removed for good. If it has replies, a “deleted” placeholder stays so they still make sense."
        action="Delete comment"
        pending={pending}
        onConfirm={() => run("delete")}
      />
      <Confirm
        open={confirm === "ban"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Mark as spam and ban ${author}?`}
        description={`${author} is signed out and can't sign in or comment again, and all their comments are hidden. You can unban them from Users → Readers.`}
        action="Spam + ban"
        pending={pending}
        onConfirm={banAuthor}
      />
    </li>
  );
}

/** One page of a moderation queue, with bulk actions for the selection. */
export function ModerationQueue({
  comments,
  status,
  canBan,
}: {
  comments: ModerationRow[];
  status: CommentStatus;
  canBan: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  // Decided comments leave the page; don't keep them selected.
  const chosen = comments.map((c) => c.id).filter((id) => selected.has(id));
  const allChosen = chosen.length > 0 && chosen.length === comments.length;

  function select(id: string, value: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function bulk(action: ModerationAction) {
    startTransition(async () => {
      const result = await moderateComments(chosen, action);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirmDelete(false);
      setSelected(new Set());
      toast.success(done(action, result.data.changed));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-card flex min-h-12 flex-wrap items-center gap-3 rounded-xl border px-4 py-2">
        <Checkbox
          checked={allChosen ? true : chosen.length ? "indeterminate" : false}
          onCheckedChange={(value) =>
            setSelected(
              value === true ? new Set(comments.map((c) => c.id)) : new Set(),
            )
          }
          aria-label="Select all comments on this page"
        />
        <span className="text-muted-foreground text-sm">
          {chosen.length
            ? `${chosen.length} selected`
            : "Select comments to act on several at once"}
        </span>
        {chosen.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            {status !== "approved" && (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => bulk("approve")}
              >
                <Check /> Approve
              </Button>
            )}
            {status !== "spam" && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => bulk("spam")}
              >
                <ShieldAlert /> Spam
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 /> Delete
            </Button>
          </div>
        )}
      </div>
      <ul className="bg-card divide-y rounded-xl border">
        {comments.map((comment) => (
          <ModerationItem
            key={comment.id}
            comment={comment}
            selected={selected.has(comment.id)}
            onSelect={(value) => select(comment.id, value)}
            canBan={canBan}
          />
        ))}
      </ul>
      <Confirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${chosen.length} ${chosen.length === 1 ? "comment" : "comments"}?`}
        description="They're removed for good. Any with replies leave a “deleted” placeholder so the replies still make sense."
        action="Delete"
        pending={pending}
        onConfirm={() => bulk("delete")}
      />
    </div>
  );
}

/** The Spam tab's way to clear it out. */
export function EmptySpamButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Trash2 /> Delete all spam
      </Button>
      <Confirm
        open={open}
        onOpenChange={setOpen}
        title={`Delete all ${count} spam ${count === 1 ? "comment" : "comments"}?`}
        description="They're removed for good. Spam that has published replies leaves a “deleted” placeholder."
        action="Delete all spam"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteAllSpam();
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setOpen(false);
            toast.success(
              `Deleted ${result.data.removed} spam ${result.data.removed === 1 ? "comment" : "comments"}`,
            );
          })
        }
      />
    </>
  );
}
