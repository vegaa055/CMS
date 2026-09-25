import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { postPath, tagPath } from "@/lib/posts/urls";
import { getLivePostSlugs, getLiveTags } from "@/lib/queries/public";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, tags] = await Promise.all([getLivePostSlugs(), getLiveTags()]);
  const url = (path: string) => new URL(path, siteConfig.url).href;
  const latest = posts[0]?.updatedAt;

  return [
    {
      url: url("/"),
      lastModified: latest,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: url("/posts"),
      lastModified: latest,
      changeFrequency: "daily",
      priority: 0.8,
    },
    { url: url("/tags"), changeFrequency: "weekly", priority: 0.5 },
    ...posts.map((p) => ({
      url: url(postPath(p.slug)),
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...tags.map((t) => ({
      url: url(tagPath(t.slug)),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}
