import Image from "next/image";

import { RichText } from "@/components/content/rich-text";
import { AuthorLink } from "@/components/site/post-meta";
import { TagLinks } from "@/components/site/tag-links";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { readingTime } from "@/lib/posts/status";
import type { RenderablePost } from "@/lib/queries/posts";

/** Full post layout, shared by the draft preview and the public post page. */
export function PostArticle({
  post,
  linkTags = false,
}: {
  post: RenderablePost;
  /** Link tags to their archive pages (public site) vs. plain badges (preview). */
  linkTags?: boolean;
}) {
  const words = post.contentText.split(/\s+/).filter(Boolean).length;

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-5">
        {linkTags ? (
          <TagLinks tags={post.postTags.map((pt) => pt.tag)} />
        ) : (
          post.postTags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
              {post.postTags.map(({ tag }) => (
                <li key={tag.slug}>
                  <Badge variant="outline">{tag.name}</Badge>
                </li>
              ))}
            </ul>
          )
        )}
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
          {post.title || "Untitled"}
        </h1>
        {post.excerpt && (
          <p className="text-muted-foreground text-lg text-pretty">
            {post.excerpt}
          </p>
        )}
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
          {post.author && <AuthorLink author={post.author} />}
          {post.publishedAt && (
            <>
              <span aria-hidden>·</span>
              <time dateTime={post.publishedAt.toISOString()}>
                {formatDate(post.publishedAt)}
              </time>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{readingTime(words)} min read</span>
        </p>
      </header>
      {post.coverImage && (
        <figure className="bg-muted relative -mx-4 aspect-[16/9] overflow-hidden sm:mx-0 sm:rounded-xl">
          <Image
            src={post.coverImage.url}
            alt={post.coverImage.alt ?? ""}
            fill
            priority
            sizes="(min-width: 672px) 42rem, 100vw"
            className="object-cover"
          />
        </figure>
      )}
      <RichText doc={post.content} />
    </article>
  );
}
