import type { Metadata } from "next";
import Link from "next/link";

import { tagPath } from "@/lib/posts/urls";
import { getLiveTags } from "@/lib/queries/public";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Topics",
  description: "Browse posts by topic.",
  alternates: { canonical: "/tags" },
};

export default async function TagsIndexPage() {
  const tags = await getLiveTags();

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-5xl tracking-tight">Topics</h1>
        <p className="text-muted-foreground">
          {tags.length} {tags.length === 1 ? "topic" : "topics"}
        </p>
      </header>
      {tags.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <li key={tag.slug}>
              <Link
                href={tagPath(tag.slug)}
                className="group hover:border-primary/50 flex items-baseline justify-between gap-4 rounded-xl border p-5 transition-colors"
              >
                <span className="font-display group-hover:text-primary text-2xl tracking-tight">
                  {tag.name}
                </span>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {tag.postCount} {tag.postCount === 1 ? "post" : "posts"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No topics yet.</p>
      )}
    </div>
  );
}
