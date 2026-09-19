"use client";

import type { StatBlock, Item } from "@/lib/viewspec";
import { aggregate } from "@/lib/aggregate";
import { applyFilters, formatValue } from "@/components/blockData";

/**
 * One headline number and nothing else. Deliberately the emptiest block in the
 * set — whitespace is what makes it read differently from a grid or a chart.
 */
const SIZE = {
  low: "text-4xl sm:text-5xl",
  normal: "text-5xl sm:text-6xl",
  high: "text-6xl sm:text-7xl",
} as const;

const INK = {
  low: "text-neutral-300",
  normal: "text-white",
  high: "text-white",
} as const;

export default function StatBlockView({
  block,
  items,
}: {
  block: StatBlock;
  items: Item[];
}) {
  const rows = applyFilters(items, block.filters);
  const value = aggregate(rows, block.agg, block.field);
  const emphasis = block.emphasis ?? "normal";
  // No rows is an honest answer, not a headline — render the dash recessively.
  const ink = value === null ? "text-neutral-600" : INK[emphasis];

  return (
    <section className="rounded-xl border border-white/10 bg-[#1a1a19] px-7 py-10 sm:px-10 sm:py-14">
      {block.title ? (
        <h3 className="mb-6 text-sm font-medium text-neutral-400">{block.title}</h3>
      ) : null}

      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
        {block.label}
      </p>

      <p
        className={`mt-3 font-semibold leading-none ${SIZE[emphasis]} ${ink}`}
      >
        {formatValue(value, block.format)}
      </p>

      <p className="mt-6 text-xs text-neutral-500">
        {block.agg === "count"
          ? `${rows.length} ${rows.length === 1 ? "row" : "rows"} counted`
          : `${block.agg} of ${block.field} · ${rows.length} ${
              rows.length === 1 ? "row" : "rows"
            }`}
      </p>
    </section>
  );
}
