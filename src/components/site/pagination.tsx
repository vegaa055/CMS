import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Previous/next pagination for ?page=N archives. Page 1 has no query. */
export function Pagination({
  page,
  pageCount,
  basePath,
}: {
  page: number;
  pageCount: number;
  basePath: string;
}) {
  if (pageCount <= 1) return null;
  const href = (n: number) => (n <= 1 ? basePath : `${basePath}?page=${n}`);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 border-t pt-6 text-sm"
    >
      {page > 1 ? (
        <Button variant="ghost" asChild>
          <Link href={href(page - 1)} rel="prev">
            <ArrowLeft /> Newer
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground tabular-nums">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Button variant="ghost" asChild>
          <Link href={href(page + 1)} rel="next">
            Older <ArrowRight />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Parse ?page=, returning null for anything that isn't a positive integer. */
export function parsePage(value: string | string[] | undefined) {
  if (value === undefined) return 1;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : null;
}
