import { describe, expect, it } from "vitest";

import {
  applyThreadChanges,
  canEditComment,
  countThread,
  EDIT_WINDOW_MS,
  initialCommentStatus,
  NO_THREAD_CHANGES,
  parseCommentBody,
  type ThreadComment,
} from "./index";

describe("parseCommentBody", () => {
  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    expect(parseCommentBody("One\ntwo\n\n\nThree")).toEqual([
      [[{ type: "text", value: "One" }], [{ type: "text", value: "two" }]],
      [[{ type: "text", value: "Three" }]],
    ]);
  });

  it("links web addresses, leaving sentence punctuation outside", () => {
    expect(
      parseCommentBody("See https://example.com/a?b=1, or (https://x.org/y)."),
    ).toEqual([
      [
        [
          { type: "text", value: "See " },
          {
            type: "link",
            href: "https://example.com/a?b=1",
            value: "https://example.com/a?b=1",
          },
          { type: "text", value: ", or (" },
          { type: "link", href: "https://x.org/y", value: "https://x.org/y" },
          { type: "text", value: ")." },
        ],
      ],
    ]);
  });

  it("keeps a URL's own closing parenthesis", () => {
    const [[line]] = parseCommentBody(
      "https://en.wikipedia.org/wiki/Bran_(cereal)",
    );
    expect(line).toEqual([
      {
        type: "link",
        href: "https://en.wikipedia.org/wiki/Bran_(cereal)",
        value: "https://en.wikipedia.org/wiki/Bran_(cereal)",
      },
    ]);
  });

  it("never links other schemes", () => {
    const [[line]] = parseCommentBody("javascript:alert(1) data:text/html,x");
    expect(line!.every((s) => s.type === "text")).toBe(true);
  });

  it("treats markup as plain text", () => {
    expect(parseCommentBody("<b>hi</b>")).toEqual([
      [[{ type: "text", value: "<b>hi</b>" }]],
    ]);
  });
});

describe("initialCommentStatus", () => {
  it("publishes the team's comments straight away", () => {
    expect(
      initialCommentStatus({
        staff: true,
        mode: "all",
        hasApprovedComment: false,
      }),
    ).toBe("approved");
  });

  it("follows the moderation setting for readers", () => {
    const status = (
      mode: "first" | "all" | "none",
      hasApprovedComment: boolean,
    ) => initialCommentStatus({ staff: false, mode, hasApprovedComment });
    expect(status("first", false)).toBe("pending");
    expect(status("first", true)).toBe("approved");
    expect(status("all", true)).toBe("pending");
    expect(status("none", false)).toBe("approved");
  });
});

describe("canEditComment", () => {
  const now = Date.now();
  const comment = { authorId: "me", createdAt: new Date(now - 60_000) };

  it("lets authors edit for a while after posting", () => {
    expect(canEditComment(comment, "me", now)).toBe(true);
    expect(canEditComment(comment, "someone-else", now)).toBe(false);
    expect(canEditComment(comment, undefined, now)).toBe(false);
    expect(canEditComment(comment, "me", now + EDIT_WINDOW_MS)).toBe(false);
  });
});

describe("applyThreadChanges", () => {
  const comment = (
    id: string,
    parentId: string | null = null,
    replies: ThreadComment[] = [],
  ): ThreadComment => ({
    id,
    parentId,
    body: `body ${id}`,
    deleted: false,
    status: "approved",
    createdAt: "2026-01-01T00:00:00.000Z",
    editedAt: null,
    author: null,
    replies,
  });
  const ids = (thread: ThreadComment[]) =>
    thread.map((c) => [c.id, c.replies.map((r) => r.id)]);
  const thread = [comment("a", null, [comment("a1", "a")]), comment("b")];

  it("leaves the thread alone without changes", () => {
    expect(applyThreadChanges(thread, NO_THREAD_CHANGES)).toEqual(thread);
    expect(countThread(thread)).toBe(3);
  });

  it("adds new comments and replies once", () => {
    const next = applyThreadChanges(thread, {
      ...NO_THREAD_CHANGES,
      // "b" is already in the (refreshed) thread, so it isn't doubled.
      added: [comment("c"), comment("b1", "b"), comment("b")],
    });
    expect(ids(next)).toEqual([
      ["a", ["a1"]],
      ["b", ["b1"]],
      ["c", []],
    ]);
  });

  it("applies edits", () => {
    const [first] = applyThreadChanges(thread, {
      ...NO_THREAD_CHANGES,
      edited: { a1: { body: "new", editedAt: "2026-01-02T00:00:00.000Z" } },
    });
    expect(first!.replies[0]).toMatchObject({
      body: "new",
      editedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("keeps a deleted comment's placeholder only while it has replies", () => {
    const soft = applyThreadChanges(thread, {
      ...NO_THREAD_CHANGES,
      removed: { a: "soft" },
    });
    expect(soft[0]).toMatchObject({ id: "a", deleted: true, body: "" });
    expect(countThread(soft)).toBe(2);

    const gone = applyThreadChanges(thread, {
      ...NO_THREAD_CHANGES,
      removed: { a: "soft", a1: "hard", b: "hard" },
    });
    expect(gone).toEqual([]);
  });
});
