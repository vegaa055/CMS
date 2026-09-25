import { renderToReactElement } from "@tiptap/static-renderer/pm/react";

import type { RichTextDoc } from "@/db/schema";
import { contentExtensions } from "@/lib/editor/extensions";
import { cn } from "@/lib/utils";

/**
 * Server-renders a stored Tiptap document with the same schema as the editor.
 * No editor JS ships to the browser.
 */
export function RichText({
  doc,
  className,
}: {
  doc: RichTextDoc | null;
  className?: string;
}) {
  if (!doc?.content?.length) return null;
  return (
    <div className={cn("prose prose-folio max-w-none", className)}>
      {renderToReactElement({ content: doc, extensions: contentExtensions })}
    </div>
  );
}
