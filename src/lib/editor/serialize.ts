import type { JSONContent } from "@tiptap/core";

import type { RichTextDoc } from "@/db/schema";

/**
 * Editor JSON -> plain JSON safe to pass to a server action.
 *
 * ProseMirror builds node/mark `attrs` with `Object.create(null)`. React's
 * server-action serializer only sends plain objects as data; anything else
 * becomes an opaque "temporary client reference", so attrs like a heading's
 * `level` or a link's `href` would silently vanish. A JSON round-trip
 * produces ordinary objects.
 */
export function toPlainDoc(json: JSONContent): RichTextDoc {
  return JSON.parse(JSON.stringify(json)) as RichTextDoc;
}
