import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { FeaturedPost, PostList } from "@/components/site/post-list";
import { TagLinks } from "@/components/site/tag-links";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { getLivePosts, getLiveTags } from "@/lib/queries/public";

// Rebuilt on publish (revalidatePublicSite) and every 5 minutes so scheduled
// posts appear on time.
export const revalidate = 300;

export default async function HomePage() {
  const [{ posts, total }, tags] = await Promise.all([
    getLivePosts({ perPage: 7 }),
    getLiveTags(),
  ]);
  const [featured, ...recent] = posts;

  return (
    <div className="flex flex-col gap-20">
      <section className="flex max-w-3xl flex-col gap-5">
        <h1 className="font-display text-5xl leading-[1.02] tracking-tight text-balance sm:text-7xl">
          {siteConfig.tagline}
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg text-pretty">
          {siteConfig.description}
        </p>
      </section>

      {featured ? (
        <FeaturedPost post={featured} />
      ) : (
        <p className="text-muted-foreground">Nothing published yet.</p>
      )}

      {recent.length > 0 && (
        <section className="grid gap-12 lg:grid-cols-[1fr_16rem]">
          <div className="flex flex-col gap-8">
            <h2 className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
              Recent writing
            </h2>
            <PostList posts={recent} />
            {total > posts.length && (
              <Button variant="outline" className="self-start" asChild>
                <Link href="/posts">
                  All {total} posts <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
          {tags.length > 0 && (
            <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
              <h2 className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
                Topics
              </h2>
              <TagLinks tags={tags.slice(0, 20)} />
            </aside>
          )}
        </section>
      )}
    </div>
  );
}
