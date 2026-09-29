"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { COMMENT_MAX_LENGTH } from "@/lib/comments";
import { cn } from "@/lib/utils";

/** Show the character count once it's within this many of the limit. */
const COUNT_FROM = COMMENT_MAX_LENGTH - 500;

/**
 * Plain-text comment box, used for new comments, replies, and edits.
 * `onSubmit` resolves to an error message, or null once it's saved.
 */
export function CommentForm({
  label,
  placeholder,
  submitLabel,
  initialValue = "",
  hint,
  autoFocus,
  onSubmit,
  onCancel,
}: {
  label: string;
  placeholder?: string;
  submitLabel: string;
  initialValue?: string;
  hint?: string;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const body = value.trim();
  const tooLong = body.length > COMMENT_MAX_LENGTH;

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!body || tooLong || pending) return;
    startTransition(async () => {
      const failure = await onSubmit(body);
      setError(failure);
      if (!failure && !initialValue) setValue("");
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Textarea
        aria-label={label}
        placeholder={placeholder}
        value={value}
        rows={3}
        autoFocus={autoFocus}
        aria-invalid={tooLong || Boolean(error)}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl/Cmd+Enter posts; Escape backs out of a reply or edit.
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          if (e.key === "Escape" && onCancel) onCancel();
        }}
      />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={cn(
            "text-xs",
            tooLong ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {body.length > COUNT_FROM
            ? `${body.length.toLocaleString()} / ${COMMENT_MAX_LENGTH.toLocaleString()} characters`
            : hint}
        </p>
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={pending || !body || tooLong}
          >
            {pending && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
