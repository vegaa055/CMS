// @vitest-environment happy-dom
/**
 * Round-trip: JSON produced by a real editor (same extensions as the admin
 * editor) must pass the server sanitizer. Hand-written fixtures miss attrs
 * the live editor adds.
 */
import { Editor } from "@tiptap/core";
import Typography from "@tiptap/extension-typography";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { afterEach, describe, expect, it } from "vitest";

import { contentExtensions } from "./extensions";
import { sanitizeDoc } from "./sanitize";
import { toPlainDoc } from "./serialize";

let editor: Editor | undefined;
afterEach(() => editor?.destroy());

function makeEditor() {
  editor = new Editor({
    extensions: [
      ...contentExtensions,
      Placeholder.configure({ placeholder: "Start writing…" }),
      Typography,
      CharacterCount,
    ],
    content: { type: "doc", content: [] },
  });
  return editor;
}

describe("editor -> sanitizer round-trip", () => {
  it("accepts an empty document", () => {
    const e = makeEditor();
    expect(sanitizeDoc(e.getJSON())).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  it("repairs a doc with no blocks (what an editor seeded with [] emits)", () => {
    expect(sanitizeDoc({ type: "doc", content: [] })).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
    expect(sanitizeDoc({ type: "doc" })).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  it("still rejects a non-doc root", () => {
    expect(() => sanitizeDoc({ type: "paragraph" })).toThrow();
  });

  it("accepts typed and formatted content", () => {
    const e = makeEditor();
    e.chain()
      .insertContent("Hello world")
      .setTextSelection({ from: 1, to: 6 })
      .toggleBold()
      .setLink({ href: "https://example.com" })
      .run();
    e.commands.insertContentAt(e.state.doc.content.size, [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Heading" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "item" }] },
            ],
          },
        ],
      },
      { type: "codeBlock", content: [{ type: "text", text: "const x = 1;" }] },
      {
        type: "blockquote",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "quote" }] },
        ],
      },
      { type: "horizontalRule" },
    ]);
    const json = e.getJSON();
    const clean = sanitizeDoc(json);
    expect(clean.content?.length).toBe(json.content?.length);
  });

  it("serializes attrs as plain objects for server actions", () => {
    const e = makeEditor();
    e.commands.setContent({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [
            {
              type: "text",
              text: "Link",
              marks: [{ type: "link", attrs: { href: "https://x.dev" } }],
            },
          ],
        },
      ],
    });
    type J = { attrs?: object; content?: J[]; marks?: J[] };
    const raw = e.getJSON() as J;
    // ProseMirror's null-prototype attrs are what React refuses to serialize.
    expect(Object.getPrototypeOf(raw.content![0]!.attrs)).toBeNull();

    const nonPlain: string[] = [];
    const walk = (n: J, path: string) => {
      for (const [key, obj] of [["attrs", n.attrs]] as const) {
        if (obj && Object.getPrototypeOf(obj) !== Object.prototype) {
          nonPlain.push(`${path}.${key}`);
        }
      }
      n.content?.forEach((c, i) => walk(c, `${path}.content[${i}]`));
      n.marks?.forEach((m, i) => walk(m, `${path}.marks[${i}]`));
    };
    walk(toPlainDoc(raw as never) as J, "doc");
    expect(nonPlain).toEqual([]);
  });
});
