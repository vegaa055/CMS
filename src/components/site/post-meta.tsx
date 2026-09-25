import Link from "next/link";

import { formatDate } from "@/lib/format";
import { authorPath } from "@/lib/posts/urls";

export type Byline = { name: string; username: string | null } | null;

/** Author name, linked to their page when they have a public username. */
export function AuthorLink({ author }: { author: NonNullable<Byline> }) {
  return author.username ? (
    <Link
      href={authorPath(author.username)}
      className="text-foreground/80 hover:text-foreground underline-offset-4 hover:underline"
    >
      {author.name}
    </Link>
  ) : (
    <span>{author.name}</span>
  );
}

export function PostMeta({
  publishedAt,
  readingTime,
  author,
}: {
  publishedAt: Date;
  readingTime: number;
  author?: Byline;
}) {
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
      {author && (
        <>
          <AuthorLink author={author} />
          <span aria-hidden>·</span>
        </>
      )}
      <time dateTime={publishedAt.toISOString()}>
        {formatDate(publishedAt)}
      </time>
      <span aria-hidden>·</span>
      <span>{readingTime} min read</span>
    </p>
  );
}
