import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Pagination, parsePage } from "@/components/site/pagination";
import { PostList } from "@/components/site/post-list";
import { tagPath } from "@/lib/posts/urls";
import { getLivePosts, getTagBySlug } from "@/lib/queries/public";

const getTag = cache(getTagBySlug);

export async function generateMetadata({
  params,
}: PageProps<"/tags/[slug]">): Promise<Metadata> {
  const tag = await getTag((await params).slug);
  if (!tag) return {};
  return {
    title: tag.name,
    description: `Posts about ${tag.name}.`,
    alternates: { canonical: tagPath(tag.slug) },
  };
}

export default async function TagPage({
  params,
  searchParams,
}: PageProps<"/tags/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const page = parsePage(query.page);
  const tag = await getTag(slug);
  if (!tag || !page) notFound();

  const { posts, total, pageCount } = await getLivePosts({
    page,
    tagSlug: tag.slug,
  });
  if (!total || page > pageCount) notFound();

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <Link
          href="/tags"
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-3.5" /> All topics
        </Link>
        <h1 className="font-display text-5xl tracking-tight">{tag.name}</h1>
        <p className="text-muted-foreground">
          {total} {total === 1 ? "post" : "posts"}
        </p>
      </header>
      <PostList posts={posts} />
      <Pagination
        page={page}
        pageCount={pageCount}
        basePath={tagPath(tag.slug)}
      />
    </div>
  );
}
