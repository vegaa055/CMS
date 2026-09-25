import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import { desc } from "drizzle-orm";

import { siteConfig } from "@/config/site";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { contentExtensions } from "@/lib/editor/extensions";
import { summarize } from "@/lib/posts/excerpt";
import { postPath } from "@/lib/posts/urls";
import { livePostWhere } from "@/lib/posts/visibility";

// Cached like the rest of the public site; refreshed on publish.
export const dynamic = "force-static";
export const revalidate = 300;

const FEED_SIZE = 20;

const xml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const cdata = (value: string) =>
  `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

/** Make root-relative src/href attributes absolute for feed readers. */
const absolutize = (html: string) =>
  html.replace(
    /(src|href)="\/(?!\/)/g,
    `$1="${siteConfig.url.replace(/\/$/, "")}/`,
  );

/** RSS 2.0 feed of the latest posts with full content. */
export async function GET() {
  const rows = await db.query.posts.findMany({
    where: livePostWhere(),
    orderBy: desc(posts.publishedAt),
    limit: FEED_SIZE,
    columns: {
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      contentText: true,
      publishedAt: true,
    },
    with: {
      author: { columns: { name: true } },
      postTags: { with: { tag: { columns: { name: true } } } },
    },
  });

  const site = siteConfig.url.replace(/\/$/, "");
  const items = rows.map((post) => {
    const link = `${site}${postPath(post.slug)}`;
    const html = post.content
      ? absolutize(
          renderToHTMLString({
            content: post.content,
            extensions: contentExtensions,
          }),
        )
      : "";
    return `    <item>
      <title>${xml(post.title || "Untitled")}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${post.publishedAt!.toUTCString()}</pubDate>
      ${post.author ? `<dc:creator>${xml(post.author.name)}</dc:creator>` : ""}
      ${post.postTags.map((pt) => `<category>${xml(pt.tag.name)}</category>`).join("")}
      <description>${xml(post.excerpt || summarize(post.contentText, 280))}</description>
      <content:encoded>${cdata(html)}</content:encoded>
    </item>`;
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${xml(siteConfig.name)}</title>
    <link>${site}</link>
    <description>${xml(siteConfig.description)}</description>
    <language>en</language>
    <atom:link href="${site}/feed.xml" rel="self" type="application/rss+xml" />
    ${rows[0]?.publishedAt ? `<lastBuildDate>${rows[0].publishedAt.toUTCString()}</lastBuildDate>` : ""}
${items.join("\n")}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
