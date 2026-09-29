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
  /** Empty once deleted or hidden. */
  body: string;
  deleted: boolean;
  /**
   * A placeholder for a comment that isn't public (awaiting review, or
   * spam) but still has published replies under it.
   */
  hidden: boolean;
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

/** Why a comment waits (or waited) for a moderator. */
export type HoldReason =
  "first-comment" | "all-comments" | "blocked-word" | "links" | "reported";

/** Label for the moderation queue. */
export function describeHold(reason: string | null, detail: string | null) {
  switch (reason) {
    case "first-comment":
      return "First comment";
    case "all-comments":
      return "Held for review";
    case "blocked-word":
      return detail ? `Contains “${detail}”` : "Contains a blocked word";
    case "links":
      return detail ? `${detail} links` : "Many links";
    case "reported":
      return "Reported";
    default:
      return null;
  }
}

/** The settings that decide what's held for review. */
export type CommentRules = {
  moderation: CommentModeration;
  blockedWords: readonly string[];
  /** Hold comments with this many links or more; 0 turns it off. */
  linkLimit: number;
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The first blocked word or phrase in the text, ignoring case, or null.
 * Words match whole ("ass" doesn't catch "class"); phrases and domains
 * match as written.
 */
export function findBlockedWord(text: string, words: readonly string[]) {
  const normalize = (value: string) =>
    value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  const haystack = normalize(text);
  for (const raw of words) {
    const word = normalize(raw);
    if (!word) continue;
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`,
      "u",
    );
    if (pattern.test(haystack)) return raw.trim();
  }
  return null;
}

export type Review =
  | { status: "approved"; reason: null; detail: null }
  | { status: "pending"; reason: HoldReason; detail: string | null };

const PUBLISH: Review = { status: "approved", reason: null, detail: null };

/**
 * What the words themselves call for: a hold for a blocked word or too many
 * links, or null. The team is never held.
 */
export function reviewContent({
  staff,
  body,
  rules,
}: {
  staff: boolean;
  body: string;
  rules: CommentRules;
}): Review | null {
  if (staff) return null;
  const word = findBlockedWord(body, rules.blockedWords);
  if (word) return { status: "pending", reason: "blocked-word", detail: word };
  const links = countLinks(body);
  if (rules.linkLimit > 0 && links >= rules.linkLimit) {
    return { status: "pending", reason: "links", detail: String(links) };
  }
  return null;
}

/** Whether a new comment is published, or held and why. */
export function reviewComment({
  staff,
  body,
  rules,
  hasApprovedComment,
}: {
  staff: boolean;
  body: string;
  rules: CommentRules;
  /** Whether this person already has a published comment. */
  hasApprovedComment: boolean;
}): Review {
  const content = reviewContent({ staff, body, rules });
  if (content) return content;
  const status = initialCommentStatus({
    staff,
    mode: rules.moderation,
    hasApprovedComment,
  });
  if (status === "approved") return PUBLISH;
  return {
    status,
    reason: rules.moderation === "all" ? "all-comments" : "first-comment",
    detail: null,
  };
}

export const REPORT_REASONS = {
  spam: "Spam or advertising",
  abuse: "Abusive or harassing",
  other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export const reportReasonSchema = z.enum(
  Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]],
);

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

/** How many web addresses the text links to (as the post would show it). */
export function countLinks(text: string) {
  return parseCommentBody(text)
    .flat(2)
    .filter((segment) => segment.type === "link").length;
}

/** What a viewer changed since their copy of the thread was rendered. */
export type ThreadChanges = {
  /** Their comments that aren't in the thread yet (new, or awaiting approval). */
  added: ThreadComment[];
  /** New text (an edit can also send a comment back for review). */
  edited: Record<
    string,
    { body: string; editedAt: string; status?: CommentStatus }
  >;
  /**
   * "soft" deletes keep a placeholder while the comment has replies, as do
   * comments they reported ("hidden" until a moderator looks).
   */
  removed: Record<string, "soft" | "hard" | "hidden">;
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
    ? {
        ...comment,
        body: edit.body,
        editedAt: edit.editedAt,
        status: edit.status ?? comment.status,
      }
    : comment;
  if (removed === "soft") return { ...next, body: "", deleted: true };
  if (removed === "hidden") {
    return {
      ...next,
      body: "",
      hidden: true,
      author: null,
      status: "pending",
    };
  }
  return next;
}

/**
 * The thread as this viewer should see it: the server's copy (which can lag
 * behind, since post pages are cached) with their own changes applied.
 * Deleted and hidden comments only stay while they have replies.
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
    if ((top.deleted || top.hidden) && replies.length === 0) continue;
    result.push({ ...top, replies });
  }
  return result;
}

/**
 * How many published comments a thread shows (placeholders and the viewer's
 * comments awaiting approval don't count).
 */
export function countThread(thread: ThreadComment[]) {
  const shown = (c: ThreadComment) =>
    !c.deleted && !c.hidden && c.status === "approved";
  return thread.reduce(
    (sum, c) => sum + (shown(c) ? 1 : 0) + c.replies.filter(shown).length,
    0,
  );
}
