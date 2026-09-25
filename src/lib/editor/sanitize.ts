import { getSchema } from "@tiptap/core";

import type { RichTextDoc } from "@/db/schema";

import { contentExtensions } from "./extensions";
import { isSafeHref, isSafeImageSrc } from "./links";

const schema = getSchema(contentExtensions);

/** Max serialized document size accepted from clients (~1 MB). */
const MAX_DOC_BYTES = 1_000_000;

type JsonNode = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: JsonNode[];
  [key: string]: unknown;
};

/** Drop images with unsafe sources and links with unsafe protocols. */
function stripUnsafe(node: JsonNode): JsonNode | null {
  if (node.type === "image" && !isSafeImageSrc(node.attrs?.src)) return null;
  const marks = node.marks?.filter(
    (m) => m.type !== "link" || isSafeHref(m.attrs?.href),
  );
  return {
    ...node,
    ...(marks && { marks: marks.length ? marks : undefined }),
    ...(node.content && {
      content: node.content
        .map(stripUnsafe)
        .filter((n): n is JsonNode => n !== null),
    }),
  };
}

/**
 * Validate an untrusted document against the editor schema, then drop unsafe
 * links and images. Missing required content (e.g. an empty doc) is filled
 * in; anything else structurally invalid throws.
 */
export function sanitizeDoc(input: unknown): RichTextDoc {
  if (JSON.stringify(input ?? null).length > MAX_DOC_BYTES) {
    throw new Error("Document is too large");
  }
  // First parse rejects unknown node/mark types and attributes.
  const parsed = schema.nodeFromJSON(input);
  if (parsed.type !== schema.topNodeType) {
    throw new Error(`Expected a ${schema.topNodeType.name} node`);
  }
  const cleaned = schema.nodeFromJSON(stripUnsafe(parsed.toJSON() as JsonNode));
  const node =
    cleaned.type.createAndFill(cleaned.attrs, cleaned.content, cleaned.marks) ??
    cleaned;
  node.check();
  return node.toJSON() as RichTextDoc;
}
