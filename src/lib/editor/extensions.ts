import type { Extensions } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";

import type { RichTextDoc } from "@/db/schema";

/**
 * Schema-defining extensions shared by the editor (client), the sanitizer,
 * and the static renderer (server). Anything that changes which nodes/marks
 * exist must go here so stored documents always render.
 */
export const contentExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: null },
    },
  }),
  Image.configure({
    inline: false,
    allowBase64: false,
    HTMLAttributes: { loading: "lazy", decoding: "async" },
  }),
];

/** Smallest valid document (the schema requires at least one block). */
export const EMPTY_DOC: RichTextDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
