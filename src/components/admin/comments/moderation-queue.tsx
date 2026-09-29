"use client";

import { Check, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  moderateComment,
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
import { postPath } from "@/lib/posts/urls";
import type { ModerationRow } from "@/lib/queries/comments";

const DONE: Record<ModerationAction, string> = {
  approve: "Comment approved",
  spam: "Marked as spam",
  delete: "Comment deleted",
};

function ModerationItem({ comment }: { comment: ModerationRow }) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const author = comment.author?.name ?? "Deleted reader";

  function run(action: ModerationAction) {
    startTransition(async () => {
      const result = await moderateComment(comment.id, action);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirmDelete(false);
      toast.success(DONE[action]);
    });
  }

  const href =
    postPath(comment.post.slug) +
    (comment.status === "approved" ? `#comment-${comment.id}` : "");

  return (
    <li className="flex flex-col gap-3 p-4" aria-label={`Comment by ${author}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-medium">{author}</span>
        {comment.author?.staff && <Badge variant="secondary">Team</Badge>}
        {comment.author && (
          <span className="text-muted-foreground text-xs">
            {comment.author.email}
          </span>
        )}
        <span className="text-muted-foreground text-xs">
          · <RelativeTime date={comment.createdAt} />
          {comment.edited && " · edited"}
        </span>
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
      <CommentBody text={comment.body} links={false} className="text-sm" />
      <div className="flex flex-wrap gap-2">
        {comment.status !== "approved" && (
          <Button size="sm" disabled={pending} onClick={() => run("approve")}>
            <Check /> Approve
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
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 /> Delete
        </Button>
      </div>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              It&apos;s removed for good. If it has replies, a
              &ldquo;deleted&rdquo; placeholder stays so they still make sense.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => run("delete")}
            >
              {pending && <Loader2 className="animate-spin" />}
              Delete comment
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

/** One page of a moderation queue (pending, approved, or spam). */
export function ModerationQueue({ comments }: { comments: ModerationRow[] }) {
  return (
    <ul className="bg-card divide-y rounded-xl border">
      {comments.map((comment) => (
        <ModerationItem key={comment.id} comment={comment} />
      ))}
    </ul>
  );
}
