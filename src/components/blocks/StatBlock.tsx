"use client";

import type { StatBlock, Item } from "@/lib/viewspec";
import { aggregate } from "@/lib/aggregate";
import { applyFilters, formatValue } from "@/components/blockData";
import { MICRO } from "@/components/theme";

/**
 * One headline number and nothing else.
 *
 * Deliberately the emptiest block in the set — the whitespace is what makes a
 * "how much?" answer read differently from a grid or a chart at a glance.
 */
const SIZE = {
  low: "text-4xl sm:text-5xl",
  normal: "text-5xl sm:text-[4rem]",
  high: "text-6xl sm:text-[5.5rem]",
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
  const empty = value === null;

  return (
    <section className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] px-7 py-11 sm:px-12 sm:py-16">
      {/* a short accent rule instead of a heading rule — marks the readout */}
      <span
        className="absolute left-0 top-0 h-px w-24 bg-[var(--accent)]"
        aria-hidden
      />

      {block.title ? (
        <h3 className="mb-7 text-[13px] font-medium text-[var(--ink-2)]">
          {block.title}
        </h3>
      ) : null}

      <p className={MICRO}>{block.label}</p>

      <p
        className={`mt-4 font-semibold leading-[0.95] tracking-[-0.03em] ${SIZE[emphasis]} ${
          empty ? "text-[var(--ink-4)]" : "text-[var(--ink)]"
        }`}
      >
        {formatValue(value, block.format)}
      </p>

      <div className="mt-9 border-t border-[var(--line)] pt-3">
        <p className="text-[11px] text-[var(--ink-4)]">
          {block.agg === "count"
            ? `${rows.length} ${rows.length === 1 ? "row" : "rows"} counted`
            : `${block.agg} of ${block.field} · ${rows.length} ${
                rows.length === 1 ? "row" : "rows"
              }`}
        </p>
      </div>
    </section>
  );
}
