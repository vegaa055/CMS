import { formatDate } from "@/lib/format";
import { ogSize, renderOgImage } from "@/lib/og";
import { getLivePostBySlug } from "@/lib/queries/public";

export const alt = "Post preview";
export const size = ogSize;
export const contentType = "image/png";
export const revalidate = 300;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const post = await getLivePostBySlug((await params).slug);
  if (!post) return renderOgImage({ title: "Post not found" });
  return renderOgImage({
    title: post.title,
    eyebrow: post.postTags[0]?.tag.name,
    footer: [
      post.author?.name,
      post.publishedAt && formatDate(post.publishedAt),
    ]
      .filter(Boolean)
      .join(" · "),
  });
}
