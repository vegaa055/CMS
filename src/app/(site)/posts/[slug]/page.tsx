import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PostArticle } from "@/components/content/post-article";
import { PostListItem } from "@/components/site/post-list";
import { siteConfig } from "@/config/site";
import { postPath } from "@/lib/posts/urls";
import {
  getAdjacentPosts,
  getLivePostBySlug,
  getLivePostSlugs,
  getRelatedPosts,
} from "@/lib/queries/public";

export const revalidate = 300;

// Deduplicate the lookup between generateMetadata and the page.
const getPost = cache(getLivePostBySlug);

export async function generateStaticParams() {
  return (await getLivePostSlugs()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/posts/[slug]">): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return {};
  const title = post.seoTitle || post.title;
  return {
    title,
    description: post.description,
    alternates: { canonical: postPath(post.slug) },
    authors: post.author ? [{ name: post.author.name }] : undefined,
    openGraph: {
      type: "article",
      title,
      description: post.description,
      url: postPath(post.slug),
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: post.author ? [post.author.name] : undefined,
      tags: post.postTags.map((pt) => pt.tag.name),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: post.description,
    },
  };
}

/** schema.org BlogPosting for rich results. */
function JsonLd({
  post,
}: {
  post: NonNullable<Awaited<ReturnType<typeof getPost>>>;
}) {
  const url = new URL(postPath(post.slug), siteConfig.url).href;
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.seoTitle || post.title,
    description: post.description,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    url,
    mainEntityOfPage: url,
    image: post.coverImage
      ? new URL(post.coverImage.url, siteConfig.url).href
      : new URL(`${postPath(post.slug)}/opengraph-image`, siteConfig.url).href,
    author: post.author
      ? { "@type": "Person", name: post.author.name }
      : undefined,
    publisher: { "@type": "Organization", name: siteConfig.name },
    keywords: post.postTags.map((pt) => pt.tag.name).join(", ") || undefined,
  };
  return (
    <script
      type="application/ld+json"
      // Escape "<" so post text can't close the script tag.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export default async function PostPage({ params }: PageProps<"/posts/[slug]">) {
  const post = await getPost((await params).slug);
  if (!post) notFound();

  const [adjacent, related] = await Promise.all([
    getAdjacentPosts({ id: post.id, publishedAt: post.publishedAt! }),
    getRelatedPosts(
      post.id,
      post.postTags.map((pt) => pt.tag.id),
    ),
  ]);

  return (
    <div className="flex flex-col gap-16">
      <JsonLd post={post} />
      <PostArticle post={post} linkTags />

      {(adjacent.older || adjacent.newer) && (
        <nav
          aria-label="More posts"
          className="mx-auto grid w-full max-w-2xl gap-4 border-t pt-8 sm:grid-cols-2"
        >
          {adjacent.older ? (
            <Link
              href={postPath(adjacent.older.slug)}
              rel="prev"
              className="group hover:border-primary/50 flex flex-col gap-1 rounded-lg border p-4 transition-colors"
            >
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <ArrowLeft className="size-3" /> Previous
              </span>
              <span className="font-display group-hover:text-primary text-lg leading-snug">
                {adjacent.older.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {adjacent.newer && (
            <Link
              href={postPath(adjacent.newer.slug)}
              rel="next"
              className="group hover:border-primary/50 flex flex-col gap-1 rounded-lg border p-4 text-right transition-colors"
            >
              <span className="text-muted-foreground flex items-center justify-end gap-1 text-xs">
                Next <ArrowRight className="size-3" />
              </span>
              <span className="font-display group-hover:text-primary text-lg leading-snug">
                {adjacent.newer.title}
              </span>
            </Link>
          )}
        </nav>
      )}

      {related.length > 0 && (
        <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <h2 className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
            Related
          </h2>
          <div className="divide-y">
            {related.map((p) => (
              <PostListItem key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
