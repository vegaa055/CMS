import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { UserAvatar } from "@/components/admin/user-avatar";
import { Pagination, parsePage } from "@/components/site/pagination";
import { PostList } from "@/components/site/post-list";
import { authorPath } from "@/lib/posts/urls";
import { getAuthorByUsername, getLivePosts } from "@/lib/queries/public";

const getAuthor = cache(getAuthorByUsername);

export async function generateMetadata({
  params,
}: PageProps<"/authors/[username]">): Promise<Metadata> {
  const author = await getAuthor((await params).username);
  if (!author?.username) return {};
  return {
    title: author.name,
    description: author.bio || `Posts by ${author.name}.`,
    alternates: { canonical: authorPath(author.username) },
    openGraph: { type: "profile", title: author.name },
  };
}

export default async function AuthorPage({
  params,
  searchParams,
}: PageProps<"/authors/[username]">) {
  const [{ username }, query] = await Promise.all([params, searchParams]);
  const page = parsePage(query.page);
  const author = await getAuthor(username);
  if (!author?.username || !page) notFound();

  const { posts, total, pageCount } = await getLivePosts({
    page,
    authorId: author.id,
  });
  if (page > pageCount) notFound();

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <UserAvatar
          name={author.name}
          image={author.image}
          className="size-20 text-2xl"
        />
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-5xl tracking-tight">
            {author.name}
          </h1>
          {author.bio && (
            <p className="text-muted-foreground max-w-xl text-pretty">
              {author.bio}
            </p>
          )}
          <p className="text-muted-foreground text-sm">
            {total} {total === 1 ? "post" : "posts"}
          </p>
        </div>
      </header>
      {posts.length ? (
        <PostList posts={posts} />
      ) : (
        <p className="text-muted-foreground">No published posts yet.</p>
      )}
      <Pagination
        page={page}
        pageCount={pageCount}
        basePath={authorPath(author.username)}
      />
    </div>
  );
}
