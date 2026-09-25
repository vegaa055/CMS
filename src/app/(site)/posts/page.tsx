import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Pagination, parsePage } from "@/components/site/pagination";
import { PostList } from "@/components/site/post-list";
import { getLivePosts } from "@/lib/queries/public";

export const metadata: Metadata = {
  title: "Writing",
  description: "Every published post, newest first.",
  alternates: { canonical: "/posts" },
};

export default async function PostsArchivePage({
  searchParams,
}: PageProps<"/posts">) {
  const page = parsePage((await searchParams).page);
  if (!page) notFound();

  const { posts, total, pageCount } = await getLivePosts({ page });
  if (page > pageCount) notFound();

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-5xl tracking-tight">Writing</h1>
        <p className="text-muted-foreground">
          {total} {total === 1 ? "post" : "posts"}
        </p>
      </header>
      {posts.length ? (
        <PostList posts={posts} />
      ) : (
        <p className="text-muted-foreground">Nothing published yet.</p>
      )}
      <Pagination page={page} pageCount={pageCount} basePath="/posts" />
    </div>
  );
}
