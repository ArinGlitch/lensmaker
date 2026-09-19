"use client";

import { useState } from "react";

import type { SmallMultiplesBlock, Item } from "@/lib/viewspec";
import { aggregate } from "@/lib/aggregate";
import { applyFilters, fieldLabel, formatValue } from "@/components/blockData";
import { BLOCK_TITLE, MICRO } from "@/components/theme";
import ShowAll from "@/components/ShowAll";

/**
 * A dense grid of identical mini-tiles, one per group, all drawn against ONE
 * shared scale.
 *
 * Silhouette: many small uniform tiles, 2 per row on mobile up to 4 on desktop.
 * Denser and smaller than CardsBlock's 3-column text cards, and each tile
 * carries a bar rather than prose. EntityBlock is the wide-stack counterpart to
 * this — same grouping, opposite shape.
 *
 * The shared scale is the entire point. Normalising each tile to its own max
 * would make every bar full-width and destroy the comparison: "one person has 6
 * blocked items and everyone else has 1" is only visible when all six bars are
 * measured with the same ruler.
 */

/** Tiles at or above this multiple of the median read as hot (outliers). */
const OUTLIER_FACTOR = 2;

interface Tile {
  key: string;
  count: number;
  value: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export default function SmallMultiplesBlockView({
  block,
  items,
}: {
  block: SmallMultiplesBlock;
  items: Item[];
}) {
  const [expanded, setExpanded] = useState(false);

  const rows = applyFilters(items, block.filters);

  // Group by the field the model named; nothing about it is assumed. A missing
  // value becomes its own "—" tile rather than being dropped.
  const buckets = new Map<string, Item[]>();
  for (const row of rows) {
    const raw = (row as unknown as Record<string, unknown>)[block.groupBy];
    const key = raw == null || raw === "" ? "—" : String(raw);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  const tiles: Tile[] = [...buckets.entries()].map(([key, groupRows]) => ({
    key,
    count: groupRows.length,
    // `agg`/`field` are both optional: with neither, the comparable quantity
    // is how many rows fell into the group.
    value:
      block.agg && block.field
        ? aggregate(groupRows, block.agg, block.field)
        : groupRows.length,
  }));

  // Descending by value; null (all values in the group were null) sinks rather
  // than being coerced to 0 and outranking real data.
  tiles.sort((a, b) => {
    if (a.value === null && b.value === null) return b.count - a.count;
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return b.value - a.value;
  });

  const total = tiles.length;
  const shown =
    !expanded && typeof block.limit === "number" && block.limit > 0
      ? tiles.slice(0, block.limit)
      : tiles;

  /**
   * ONE max across every tile shown, computed once — this is the shared ruler.
   * Negative-only data would otherwise give a negative denominator, so the max
   * is floored at 0 and a 0 max means every bar is empty (never NaN).
   */
  const present = shown
    .map((t) => t.value)
    .filter((v): v is number => v !== null);
  const sharedMax = present.length ? Math.max(0, ...present) : 0;
  const med = median(present);
  const hotThreshold = med !== null && med > 0 ? med * OUTLIER_FACTOR : null;

  const valueLabel =
    block.agg && block.field
      ? `${block.agg} of ${fieldLabel(block.field)}`
      : "items";
  const heading = block.title ?? `${fieldLabel(block.groupBy)} compared`;

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={BLOCK_TITLE}>{heading}</h3>
        <span className={MICRO}>shared scale · {valueLabel}</span>
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-[var(--line-strong)] px-5 py-10 text-center text-sm text-[var(--ink-3)]">
          Nothing matches this block.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((tile) => {
            const valueText =
              block.agg && block.field
                ? formatValue(tile.value, block.format)
                : `${tile.value ?? 0}`;
            // Proportion of the SHARED max — never of this tile's own value.
            const pct =
              tile.value === null || sharedMax <= 0
                ? 0
                : Math.max(0, Math.min(100, (tile.value / sharedMax) * 100));
            const hot =
              hotThreshold !== null &&
              tile.value !== null &&
              tile.value >= hotThreshold;

            return (
              <li
                key={tile.key}
                className={`min-w-0 rounded-lg border px-2.5 py-2 ${
                  hot
                    ? "border-[#fab219]/35 bg-[#fab219]/[0.06]"
                    : "border-[var(--line)] bg-[var(--panel-raised)]"
                }`}
              >
                <p
                  className="truncate text-[11px] leading-tight text-[var(--ink-2)]"
                  title={tile.key}
                >
                  {tile.key}
                </p>

                <p
                  className={`tnum mt-1 truncate text-[15px] font-semibold tabular-nums ${
                    hot ? "text-[#fab219]" : "text-[var(--ink)]"
                  }`}
                  title={valueText}
                >
                  {valueText}
                </p>

                {/* The mini-bar. Same track width in every tile, so bar width
                    is directly comparable across the whole grid. */}
                <div
                  className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]"
                  role="img"
                  aria-label={`${valueText}${
                    hot ? " — above typical" : ""
                  }`}
                >
                  <div
                    className={`h-full rounded-full ${
                      hot ? "bg-[#fab219]" : "bg-[var(--accent)]"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <p className={`mt-1.5 truncate ${MICRO}`}>
                  {tile.count} {tile.count === 1 ? "row" : "rows"}
                  {hot ? " · high" : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <ShowAll
        shown={shown.length}
        total={total}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        noun="tiles"
      />
    </section>
  );
}
