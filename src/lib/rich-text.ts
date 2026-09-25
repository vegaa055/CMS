import type { RichTextDoc } from "@/db/schema";

type Node = { type?: string; text?: string; content?: Node[] };

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "codeBlock",
]);

/** Flatten a Tiptap document to plain text (for search indexing and excerpts). */
export function richTextToPlainText(
  doc: RichTextDoc | null | undefined,
): string {
  if (!doc) return "";
  const parts: string[] = [];

  const walk = (node: Node) => {
    if (node.text) parts.push(node.text);
    node.content?.forEach(walk);
    if (node.type && BLOCK_TYPES.has(node.type)) parts.push("\n");
  };
  walk(doc as Node);

  return parts
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
