/**
 * Canonical origin: NEXT_PUBLIC_APP_URL if set (use it for production with a
 * custom domain), otherwise Vercel's system env (production domain or the
 * preview deployment's URL), otherwise localhost.
 */
function resolveAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const host =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
      ? process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      : (process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL ??
        process.env.NEXT_PUBLIC_VERCEL_URL);
  return host ? `https://${host}` : "http://localhost:3000";
}

/**
 * Default site identity. "Folio" is a placeholder name — change it here.
 * Admins override these from Settings (stored in the `settings` table);
 * read them with `getSiteSettings()`.
 */
export const siteConfig = {
  name: "Folio",
  tagline: "A modern content platform",
  description:
    "Folio is a sleek, modern CMS for writing, publishing, and showcasing work.",
  url: resolveAppUrl(),
  author: {
    name: "Tony Vega",
  },
  links: {
    github: "https://github.com/vegaa055/CMS",
  },
} as const;

export type SiteConfig = typeof siteConfig;
