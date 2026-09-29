"use client";

import { useSyncExternalStore } from "react";

import { formatDate, formatDateTime, formatRelative } from "@/lib/format";

const subscribe = () => () => {};

/**
 * "3 hours ago" in the browser, a plain date in server HTML. For cached
 * pages, where a relative time rendered on the server would go stale.
 */
export function RelativeTime({
  date,
  className,
}: {
  date: string;
  className?: string;
}) {
  const inBrowser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <time
      dateTime={date}
      title={inBrowser ? formatDateTime(date) : undefined}
      className={className}
    >
      {inBrowser ? formatRelative(date) : formatDate(date)}
    </time>
  );
}
