import { getSchema } from "@tiptap/core";

import type { RichTextDoc } from "@/db/schema";

import { contentExtensions } from "./extensions";
import { isSafeHref } from "./links";

const schema = getSchema(contentExtensions);

/** Max serialized document size accepted from clients (~1 MB). */
const MAX_DOC_BYTES = 1_000_000;

type JsonNode = {
  type: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: JsonNode[];
  [key: string]: unknown;
};

function stripUnsafeLinks(node: JsonNode): JsonNode {
  const marks = node.marks?.filter(
    (m) => m.type !== "link" || isSafeHref(m.attrs?.href),
  );
  return {
    ...node,
    ...(marks && { marks: marks.length ? marks : undefined }),
    ...(node.content && { content: node.content.map(stripUnsafeLinks) }),
  };
}

/**
 * Validate an untrusted document against the editor schema and drop links
 * with unsafe protocols. Throws if the document is structurally invalid.
 */
export function sanitizeDoc(input: unknown): RichTextDoc {
  if (JSON.stringify(input ?? null).length > MAX_DOC_BYTES) {
    throw new Error("Document is too large");
  }
  const node = schema.nodeFromJSON(input);
  node.check();
  return stripUnsafeLinks(node.toJSON() as JsonNode) as RichTextDoc;
}

export const EMPTY_DOC: RichTextDoc = { type: "doc", content: [] };
