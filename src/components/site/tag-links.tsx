import Link from "next/link";

import { tagPath } from "@/lib/posts/urls";
import { cn } from "@/lib/utils";

export function TagLinks({
  tags,
  className,
}: {
  tags: { name: string; slug: string; postCount?: number }[];
  className?: string;
}) {
  if (!tags.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag.slug}>
          <Link
            href={tagPath(tag.slug)}
            className="text-muted-foreground hover:border-primary/50 hover:text-foreground inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors"
          >
            {tag.name}
            {tag.postCount !== undefined && (
              <span className="text-muted-foreground/70 tabular-nums">
                {tag.postCount}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
