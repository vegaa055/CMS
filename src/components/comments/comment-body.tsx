import { Fragment } from "react";

import { parseCommentBody } from "@/lib/comments";
import { cn } from "@/lib/utils";

/**
 * A comment's plain text as paragraphs, with web addresses linked (never
 * rendered as HTML). Links are marked as user content and not followed by
 * search engines; moderators see them as text so spam isn't a click away.
 */
export function CommentBody({
  text,
  links = true,
  className,
}: {
  text: string;
  links?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 wrap-break-word", className)}>
      {parseCommentBody(text).map((lines, p) => (
        <p key={p}>
          {lines.map((segments, l) => (
            <Fragment key={l}>
              {l > 0 && <br />}
              {segments.map((segment, s) =>
                segment.type === "link" && links ? (
                  <a
                    key={s}
                    href={segment.href}
                    target="_blank"
                    rel="nofollow ugc noopener noreferrer"
                    className="text-primary break-all underline underline-offset-2"
                  >
                    {segment.value}
                  </a>
                ) : (
                  <Fragment key={s}>{segment.value}</Fragment>
                ),
              )}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
