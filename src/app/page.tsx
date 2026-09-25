import { ArrowRight, FileText, ImageIcon, Users } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { getPublishedPosts } from "@/lib/queries/posts";

const features = [
  {
    icon: FileText,
    title: "Posts & pages",
    description: "Rich-text editing, drafts, scheduling, and tags.",
  },
  {
    icon: ImageIcon,
    title: "Media library",
    description: "Direct-to-storage uploads with alt text and reuse.",
  },
  {
    icon: Users,
    title: "Roles",
    description: "Admin, editor, and author permissions out of the box.",
  },
];

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

// Placeholder home page; replaced by the public post feed in Phase 6.
export default async function Home() {
  const latest = await getPublishedPosts({ limit: 3 });

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <span className="font-display text-2xl tracking-tight">
            {siteConfig.name}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-4 py-20">
        <section className="flex flex-col items-start gap-6">
          <Badge variant="secondary">Phase 1 · Database</Badge>
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight text-balance sm:text-7xl">
            Write, publish, and <em className="text-primary">showcase</em> your
            work.
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg">
            {siteConfig.description}
          </p>
          <div className="flex gap-3">
            <Button size="lg" disabled>
              Open dashboard <ArrowRight data-icon="inline-end" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href={siteConfig.links.github}>View source</a>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardHeader>
                <Icon className="text-primary mb-2 size-5" />
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
            Latest posts
          </h2>
          <ul className="divide-y rounded-xl border">
            {latest.map((post) => (
              <li key={post.id} className="flex flex-col gap-1 p-4">
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  {post.publishedAt && (
                    <time dateTime={post.publishedAt.toISOString()}>
                      {dateFormat.format(post.publishedAt)}
                    </time>
                  )}
                  {post.author && <span>· {post.author.name}</span>}
                  {post.postTags.map(({ tag }) => (
                    <Badge key={tag.slug} variant="outline">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
                <span className="font-medium">{post.title}</span>
                {post.excerpt && (
                  <p className="text-muted-foreground text-sm">
                    {post.excerpt}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto w-full max-w-5xl px-4 py-6 text-sm">
          © {new Date().getFullYear()} {siteConfig.name}
        </div>
      </footer>
    </div>
  );
}
