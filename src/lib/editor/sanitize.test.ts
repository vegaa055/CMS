import { describe, expect, it } from "vitest";

import { richTextToPlainText } from "@/lib/rich-text";
import { slugify } from "@/lib/slug";

import { isSafeHref, normalizeHref } from "./links";
import { sanitizeDoc } from "./sanitize";

const text = (value: string, marks?: unknown[]) => ({
  type: "text",
  text: value,
  ...(marks && { marks }),
});

describe("sanitizeDoc", () => {
  it("keeps valid content and safe links", () => {
    const doc = sanitizeDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            text("ok", [{ type: "link", attrs: { href: "https://x.dev" } }]),
          ],
        },
      ],
    });
    const mark = (
      doc.content![0] as { content: { marks: { attrs: { href: string } }[] }[] }
    ).content[0]!.marks[0]!;
    expect(mark.attrs.href).toBe("https://x.dev");
  });

  it("strips javascript: links but keeps the text and other marks", () => {
    const doc = sanitizeDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            text("click", [
              { type: "bold" },
              { type: "link", attrs: { href: "javascript:alert(1)" } },
            ]),
          ],
        },
      ],
    });
    expect(JSON.stringify(doc)).not.toContain("javascript:");
    expect(JSON.stringify(doc)).toContain('"bold"');
  });

  it("rejects unknown nodes and malformed documents", () => {
    expect(() =>
      sanitizeDoc({ type: "doc", content: [{ type: "script" }] }),
    ).toThrow();
    expect(() =>
      sanitizeDoc({ type: "doc", content: [text("loose")] }),
    ).toThrow();
    expect(() => sanitizeDoc("nope")).toThrow();
  });
});

describe("links", () => {
  it.each([
    ["https://example.com", true],
    ["mailto:a@b.co", true],
    ["/about", true],
    ["#section", true],
    ["//evil.com", false],
    ["javascript:alert(1)", false],
    ["data:text/html,hi", false],
  ])("isSafeHref(%s) = %s", (href, expected) => {
    expect(isSafeHref(href)).toBe(expected);
  });

  it("normalizes bare domains and emails", () => {
    expect(normalizeHref("example.com")).toBe("https://example.com");
    expect(normalizeHref("me@example.com")).toBe("mailto:me@example.com");
    expect(normalizeHref("/path")).toBe("/path");
  });
});

describe("text helpers", () => {
  it("slugifies titles", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
    expect(slugify("  Café  déjà vu ")).toBe("cafe-deja-vu");
    expect(slugify("!!!")).toBe("");
  });

  it("flattens rich text to plain text", () => {
    expect(
      richTextToPlainText({
        type: "doc",
        content: [
          { type: "heading", content: [text("Title")] },
          { type: "paragraph", content: [text("Body "), text("text")] },
        ],
      }),
    ).toBe("Title\nBody text");
  });
});
