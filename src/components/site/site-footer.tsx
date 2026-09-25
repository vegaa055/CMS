import { Rss } from "lucide-react";
import Link from "next/link";

import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {siteConfig.author.name}
        </p>
        <nav aria-label="Footer" className="flex items-center gap-4">
          <Link
            href="/feed.xml"
            className="hover:text-foreground flex items-center gap-1.5"
          >
            <Rss className="size-3.5" /> RSS
          </Link>
          <a href={siteConfig.links.github} className="hover:text-foreground">
            GitHub
          </a>
          <Link href="/admin" className="hover:text-foreground">
            Dashboard
          </Link>
        </nav>
      </div>
    </footer>
  );
}
