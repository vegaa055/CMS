"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export type ActivitySeries = {
  label: string;
  /** e.g. ["like", "likes"] */
  unit: [one: string, many: string];
  /** Per 7-day period, oldest first; the last is the latest 7 days. */
  counts: number[];
};

const numberFormat = new Intl.NumberFormat("en-US", { notation: "compact" });

function Delta({ current, previous }: { current: number; previous: number }) {
  const change = current - previous;
  const Icon =
    change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : ArrowRight;
  return (
    <p
      className={cn(
        "flex items-center gap-1 text-xs",
        change > 0 ? "text-success" : "text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {change === 0
        ? "Same as the 7 days before"
        : `${change > 0 ? "+" : "−"}${Math.abs(change)} vs the 7 days before`}
    </p>
  );
}

/**
 * A stat tile: the latest 7 days, the change from the 7 before, and eight
 * periods as a small column chart (gray, with the latest in the accent).
 * Hovering or focusing a column shows its period and count.
 */
function ActivityTile({
  series,
  labels,
}: {
  series: ActivitySeries;
  labels: string[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const { counts } = series;
  const latest = counts.length - 1;
  const max = Math.max(1, ...counts);
  const describe = (i: number) =>
    `${labels[i]}: ${counts[i]} ${counts[i] === 1 ? series.unit[0] : series.unit[1]}`;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">{series.label}</p>
        <p className="text-3xl font-semibold tracking-tight">
          {numberFormat.format(counts[latest] ?? 0)}
        </p>
        <Delta
          current={counts[latest] ?? 0}
          previous={counts[latest - 1] ?? 0}
        />
      </div>
      <div
        className="flex h-12 items-end gap-0.5"
        onPointerLeave={() => setActive(null)}
      >
        {counts.map((count, i) => (
          <div
            key={labels[i]}
            role="img"
            tabIndex={0}
            aria-label={describe(i)}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            // The whole column slot is the target, not just the painted bar.
            className="group flex h-full max-w-6 flex-1 cursor-default items-end outline-none"
          >
            <div
              className={cn(
                "w-full rounded-t-[4px] transition-opacity",
                i === latest ? "bg-primary" : "bg-muted-foreground/35",
                active !== null && active !== i && "opacity-50",
                "group-focus-visible:ring-ring group-focus-visible:ring-2",
              )}
              // At least a sliver, so an empty period still shows its place.
              style={{ height: `${Math.max(4, (count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <p className="text-muted-foreground min-h-4 text-xs" aria-hidden>
        {active === null ? "Last 8 weeks" : describe(active)}
      </p>
    </div>
  );
}

/** A row of activity tiles, plus the same numbers as a table for screen readers. */
export function ActivityTiles({
  series,
  labels,
}: {
  series: ActivitySeries[];
  labels: string[];
}) {
  return (
    <>
      <div
        className={cn(
          "grid gap-4",
          series.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {series.map((s) => (
          <ActivityTile key={s.label} series={s} labels={labels} />
        ))}
      </div>
      <table className="sr-only">
        <caption>Activity per 7-day period, oldest first</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {series.map((s) => (
              <th key={s.label} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {series.map((s) => (
                <td key={s.label}>{s.counts[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
