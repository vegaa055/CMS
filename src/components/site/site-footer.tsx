import { Rss } from "lucide-react";
import Link from "next/link";

import { getSiteSettings } from "@/lib/settings";
import { SOCIAL_LINKS } from "@/lib/validation/settings";

export async function SiteFooter() {
  const site = await getSiteSettings();
  const socials = SOCIAL_LINKS.filter(({ key }) => site.links[key]);

  return (
    <footer className="mt-24 border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.ownerName || site.name}
        </p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-4">
          <Link
            href="/feed.xml"
            className="hover:text-foreground flex items-center gap-1.5"
          >
            <Rss className="size-3.5" /> RSS
          </Link>
          {socials.map(({ key, label }) => (
            <a
              key={key}
              href={site.links[key]}
              rel="me noopener noreferrer"
              target="_blank"
              className="hover:text-foreground"
            >
              {label}
            </a>
          ))}
          <Link href="/admin" className="hover:text-foreground">
            Dashboard
          </Link>
        </nav>
      </div>
    </footer>
  );
}
