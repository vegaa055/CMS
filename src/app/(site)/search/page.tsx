import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { PostMeta } from "@/components/site/post-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postPath } from "@/lib/posts/urls";
import {
  HIGHLIGHT_END,
  HIGHLIGHT_START,
  searchPosts,
} from "@/lib/queries/public";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

/** Render ts_headline output: highlighted spans become <mark>, never raw HTML. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(HIGHLIGHT_START);
  return (
    <>
      {parts.map((part, i) => {
        if (i === 0) return <Fragment key={i}>{part}</Fragment>;
        const [hit, rest] = part.split(HIGHLIGHT_END);
        return (
          <Fragment key={i}>
            <mark className="bg-primary/20 text-foreground rounded-sm px-0.5">
              {hit}
            </mark>
            {rest}
          </Fragment>
        );
      })}
    </>
  );
}

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 200) ?? "";
  const results = q ? await searchPosts(q) : [];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-6">
        <h1 className="font-display text-5xl tracking-tight">Search</h1>
        <form action="/search" role="search" className="flex max-w-xl gap-2">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search posts…"
              aria-label="Search posts"
              className="h-10 pl-9"
              autoFocus={!q}
            />
          </div>
          <Button type="submit" size="lg" className="h-10">
            Search
          </Button>
        </form>
      </header>

      {q && (
        <section className="flex flex-col gap-2" aria-live="polite">
          <p className="text-muted-foreground text-sm">
            {results.length
              ? `${results.length} ${results.length === 1 ? "result" : "results"} for “${q}”`
              : `No results for “${q}”.`}
          </p>
          <ol className="divide-y">
            {results.map((post) => (
              <li key={post.id} className="flex flex-col gap-2 py-6">
                <h2 className="font-display text-2xl tracking-tight">
                  <Link
                    href={postPath(post.slug)}
                    className="hover:text-primary transition-colors"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="text-muted-foreground text-pretty">
                  {post.snippet ? (
                    <Snippet text={post.snippet} />
                  ) : (
                    post.excerpt
                  )}
                </p>
                <PostMeta
                  publishedAt={post.publishedAt}
                  readingTime={post.readingTime}
                />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
