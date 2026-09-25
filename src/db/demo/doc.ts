import type { RichTextDoc } from "@/db/schema";

/** Tiny builders for Tiptap/ProseMirror JSON used by the demo seed. */

type Mark = { type: string; attrs?: Record<string, unknown> };
type Inline = { type: "text"; text: string; marks?: Mark[] };
type Block = Record<string, unknown>;

export const t = (text: string, ...marks: Mark[]): Inline => ({
  type: "text",
  text,
  ...(marks.length && { marks }),
});
export const bold: Mark = { type: "bold" };
export const italic: Mark = { type: "italic" };
export const code: Mark = { type: "code" };
export const link = (href: string): Mark => ({ type: "link", attrs: { href } });

const inline = (parts: (string | Inline)[]) =>
  parts.map((p) => (typeof p === "string" ? t(p) : p));

export const p = (...parts: (string | Inline)[]): Block => ({
  type: "paragraph",
  content: inline(parts),
});
export const h2 = (text: string): Block => ({
  type: "heading",
  attrs: { level: 2 },
  content: [t(text)],
});
export const h3 = (text: string): Block => ({
  type: "heading",
  attrs: { level: 3 },
  content: [t(text)],
});
const list =
  (type: "bulletList" | "orderedList") =>
  (...items: (string | (string | Inline)[])[]): Block => ({
    type,
    content: items.map((item) => ({
      type: "listItem",
      content: [p(...(Array.isArray(item) ? item : [item]))],
    })),
  });
export const ul = list("bulletList");
export const ol = list("orderedList");
export const quote = (...paragraphs: string[]): Block => ({
  type: "blockquote",
  content: paragraphs.map((text) => p(text)),
});
export const pre = (source: string, language = "ts"): Block => ({
  type: "codeBlock",
  attrs: { language },
  content: [t(source)],
});
export const hr = (): Block => ({ type: "horizontalRule" });
export const img = (src: string, alt: string): Block => ({
  type: "image",
  attrs: { src, alt },
});

export const doc = (...content: Block[]): RichTextDoc => ({
  type: "doc",
  content,
});
