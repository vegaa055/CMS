import { formatDate } from "@/lib/format";

export function PostMeta({
  publishedAt,
  readingTime,
  author,
}: {
  publishedAt: Date;
  readingTime: number;
  author?: string | null;
}) {
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
      {author && (
        <>
          <span>{author}</span>
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
