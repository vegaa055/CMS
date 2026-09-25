import Image from "next/image";
import Link from "next/link";

import { PostMeta } from "@/components/site/post-meta";
import { TagLinks } from "@/components/site/tag-links";
import { postPath } from "@/lib/posts/urls";
import type { PostSummary } from "@/lib/queries/public";

export function PostListItem({ post }: { post: PostSummary }) {
  const href = postPath(post.slug);
  return (
    <article className="group grid gap-5 py-8 first:pt-0 sm:grid-cols-[1fr_11rem]">
      <div className="flex flex-col gap-3">
        <PostMeta
          publishedAt={post.publishedAt}
          readingTime={post.readingTime}
        />
        <h3 className="font-display text-2xl leading-tight tracking-tight text-balance sm:text-3xl">
          <Link href={href} className="hover:text-primary transition-colors">
            {post.title}
          </Link>
        </h3>
        {post.excerpt && (
          <p className="text-muted-foreground line-clamp-3 text-pretty">
            {post.excerpt}
          </p>
        )}
        <TagLinks tags={post.tags} />
      </div>
      {post.cover && (
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden
          className="bg-muted relative order-first aspect-[16/10] overflow-hidden rounded-lg sm:order-none sm:aspect-[4/3]"
        >
          <Image
            src={post.cover.url}
            alt=""
            fill
            sizes="(min-width: 640px) 11rem, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </Link>
      )}
    </article>
  );
}

export function PostList({ posts }: { posts: PostSummary[] }) {
  return (
    <div className="divide-y">
      {posts.map((post) => (
        <PostListItem key={post.id} post={post} />
      ))}
    </div>
  );
}

/** Large lead story for the home page. */
export function FeaturedPost({ post }: { post: PostSummary }) {
  const href = postPath(post.slug);
  return (
    <article className="group grid gap-6 lg:grid-cols-2 lg:items-center lg:gap-10">
      {post.cover ? (
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden
          className="bg-muted relative aspect-[16/10] overflow-hidden rounded-xl"
        >
          <Image
            src={post.cover.url}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 30rem, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </Link>
      ) : (
        <div
          aria-hidden
          className="hidden aspect-[16/10] rounded-xl border bg-[radial-gradient(ellipse_at_top_left,var(--accent),transparent_70%)] lg:block"
        />
      )}
      <div className="flex flex-col gap-4">
        <span className="text-primary text-xs font-medium tracking-widest uppercase">
          Latest
        </span>
        <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">
          <Link href={href} className="hover:text-primary transition-colors">
            {post.title}
          </Link>
        </h2>
        {post.excerpt && (
          <p className="text-muted-foreground text-lg text-pretty">
            {post.excerpt}
          </p>
        )}
        <PostMeta
          publishedAt={post.publishedAt}
          readingTime={post.readingTime}
          author={post.author}
        />
      </div>
    </article>
  );
}
