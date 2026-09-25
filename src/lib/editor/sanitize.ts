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
 * with unsafe protocols. Missing required content (e.g. an empty doc) is
 * filled in; anything else structurally invalid throws.
 */
export function sanitizeDoc(input: unknown): RichTextDoc {
  if (JSON.stringify(input ?? null).length > MAX_DOC_BYTES) {
    throw new Error("Document is too large");
  }
  const parsed = schema.nodeFromJSON(input);
  if (parsed.type !== schema.topNodeType) {
    throw new Error(`Expected a ${schema.topNodeType.name} node`);
  }
  const node =
    parsed.type.createAndFill(parsed.attrs, parsed.content, parsed.marks) ??
    parsed;
  node.check();
  return stripUnsafeLinks(node.toJSON() as JsonNode) as RichTextDoc;
}
