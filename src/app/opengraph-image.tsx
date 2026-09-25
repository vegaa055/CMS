import { ogSize, renderOgImage } from "@/lib/og";
import { getSiteSettings } from "@/lib/settings";

export const alt = "Site preview";
export const size = ogSize;
export const contentType = "image/png";

/** Default social card for pages without their own. */
export default async function Image() {
  const site = await getSiteSettings();
  return renderOgImage({ title: site.tagline, footer: site.description });
}
