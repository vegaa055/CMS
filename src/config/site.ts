/**
 * Static site identity. "Folio" is a placeholder name — change it here.
 * In Phase 7 these become defaults that can be overridden from the admin
 * settings page (stored in the `settings` table).
 */
export const siteConfig = {
  name: "Folio",
  tagline: "A modern content platform",
  description:
    "Folio is a sleek, modern CMS for writing, publishing, and showcasing work.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  author: {
    name: "Tony Vega",
  },
  links: {
    github: "https://github.com/vegaa055/CMS",
  },
} as const;

export type SiteConfig = typeof siteConfig;
