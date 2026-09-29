import { z } from "zod";

/*
 * Comment rules shared by the server (enforcement) and the browser (hiding
 * controls). Pure functions only, so they're easy to test.
 */

export type CommentStatus = "pending" | "approved" | "spam";

export type CommentAuthor = {
  id: string;
  name: string;
  image: string | null;
  /** "author" on the post's own author, "team" on other staff. */
  badge: "author" | "team" | null;
};

/** A comment as the public thread shows it (serializable). */
export type ThreadComment = {
  id: string;
  parentId: string | null;
  /** Empty once deleted. */
  body: string;
  deleted: boolean;
  status: CommentStatus;
  createdAt: string;
  editedAt: string | null;
  /** Null when the author deleted their account. */
  author: CommentAuthor | null;
  replies: ThreadComment[];
};

export const COMMENT_MAX_LENGTH = 3000;

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, "Write something first")
  .max(COMMENT_MAX_LENGTH, `Keep it under ${COMMENT_MAX_LENGTH} characters`);

/** How long after posting the author can still edit a comment. */
export const EDIT_WINDOW_MS = 60 * 60 * 1000;

export function canEditComment(
  comment: { authorId: string | null; createdAt: string | Date },
  userId: string | undefined,
  now = Date.now(),
) {
  return (
    userId !== undefined &&
    comment.authorId === userId &&
    now - new Date(comment.createdAt).getTime() < EDIT_WINDOW_MS
  );
}

export const COMMENT_MODERATION = ["first", "all", "none"] as const;
export type CommentModeration = (typeof COMMENT_MODERATION)[number];

/**
 * Whether a new comment is published straight away or waits for a
 * moderator: the team never waits; readers depend on the site setting.
 */
export function initialCommentStatus({
  staff,
  mode,
  hasApprovedComment,
}: {
  staff: boolean;
  mode: CommentModeration;
  /** Whether this person already has a published comment. */
  hasApprovedComment: boolean;
}) {
  if (staff || mode === "none") return "approved" as const;
  if (mode === "first" && hasApprovedComment) return "approved" as const;
  return "pending" as const;
}

export type CommentSegment =
  | { type: "text"; value: string }
  | { type: "link"; href: string; value: string };

const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;
/** Punctuation that usually ends a sentence rather than a URL. */
const TRAILING = /[.,!?;:'")\]]+$/;

function linkify(line: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let last = 0;
  for (const match of line.matchAll(URL_PATTERN)) {
    let url = match[0];
    const trailing = url.match(TRAILING)?.[0] ?? "";
    // Keep a closing parenthesis that belongs to the URL, e.g. wiki links.
    const keep = trailing.startsWith(")") && url.includes("(") ? ")" : "";
    url = url.slice(0, url.length - trailing.length) + keep;
    const start = match.index!;
    if (start > last)
      segments.push({ type: "text", value: line.slice(last, start) });
    let href: string | undefined;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        href = parsed.href;
      }
    } catch {
      href = undefined;
    }
    segments.push(
      href ? { type: "link", href, value: url } : { type: "text", value: url },
    );
    last = start + url.length;
  }
  if (last < line.length)
    segments.push({ type: "text", value: line.slice(last) });
  return segments;
}

/**
 * A comment's plain text as paragraphs of lines of text and links, for
 * rendering with React (never as HTML). Blank lines split paragraphs; web
 * addresses become links.
 */
export function parseCommentBody(text: string): CommentSegment[][][] {
  return text
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.split("\n").map((line) => linkify(line)));
}

/** What a viewer changed since their copy of the thread was rendered. */
export type ThreadChanges = {
  /** Their comments that aren't in the thread yet (new, or awaiting approval). */
  added: ThreadComment[];
  edited: Record<string, { body: string; editedAt: string }>;
  /** "soft" deletes keep a placeholder while the comment has replies. */
  removed: Record<string, "soft" | "hard">;
};

export const NO_THREAD_CHANGES: ThreadChanges = {
  added: [],
  edited: {},
  removed: {},
};

function applyToComment(
  comment: ThreadComment,
  changes: ThreadChanges,
): ThreadComment | null {
  const removed = changes.removed[comment.id];
  if (removed === "hard") return null;
  const edit = changes.edited[comment.id];
  const next = edit
    ? { ...comment, body: edit.body, editedAt: edit.editedAt }
    : comment;
  return removed === "soft" ? { ...next, body: "", deleted: true } : next;
}

/**
 * The thread as this viewer should see it: the server's copy (which can lag
 * behind, since post pages are cached) with their own changes applied.
 * Deleted comments only stay while they have replies.
 */
export function applyThreadChanges(
  thread: ThreadComment[],
  changes: ThreadChanges,
): ThreadComment[] {
  const known = new Set(
    thread.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)]),
  );
  const added = changes.added.filter((c) => {
    if (known.has(c.id)) return false;
    known.add(c.id);
    return true;
  });
  const result: ThreadComment[] = [];
  for (const comment of [...thread, ...added.filter((c) => !c.parentId)]) {
    const top = applyToComment(comment, changes);
    if (!top) continue;
    const replies = [
      ...top.replies,
      ...added.filter((c) => c.parentId === top.id),
    ]
      .map((reply) => applyToComment(reply, changes))
      .filter((reply) => reply !== null);
    if (top.deleted && replies.length === 0) continue;
    result.push({ ...top, replies });
  }
  return result;
}

/**
 * How many published comments a thread shows (deleted placeholders and the
 * viewer's comments awaiting approval don't count).
 */
export function countThread(thread: ThreadComment[]) {
  const shown = (c: ThreadComment) => !c.deleted && c.status === "approved";
  return thread.reduce(
    (sum, c) => sum + (shown(c) ? 1 : 0) + c.replies.filter(shown).length,
    0,
  );
}
