"use client";

import { useState } from "react";

import type { EntityBlock, Item } from "@/lib/viewspec";
import { aggregate } from "@/lib/aggregate";
import {
  applyFilters,
  fieldLabel,
  formatValue,
  sortItems,
} from "@/components/blockData";
import { BLOCK_TITLE, MICRO } from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";
import Pagination, { clampPage, pageSlice } from "@/components/Pagination";

/**
 * One wide summary card per entity (usually a vendor), stacked vertically, each
 * carrying a tiny inline trend of monthly activity.
 *
 * Silhouette: a vertical stack of WIDE rows with a sparkline on the right. Not
 * CardsBlock (3-column grid of text cards), not TimelineBlock (dated rail), not
 * SmallMultiplesBlock (dense uniform grid of tiles). The card is wide because
 * the point is the roll-up ACROSS rows — value, row count, and last activity
 * read straight across on one line.
 *
 * The sparkline is the whole reason this block exists: a vendor ramping from
 * $800 to $4,200/month is a conversation nobody had, and that ramp is invisible
 * in any per-row view.
 */

/**
 * `receivedAt` is the only non-null date on every row (chargeDate and
 * deadlineDate are both nullable, and 27 of 36 deadlines are already past), so
 * it is the documented fallback for the activity axis. EntityBlockSchema has no
 * dateField prop, so there is nothing in `block` to read this from.
 */
const ACTIVITY_DATE_FIELD = "receivedAt";

/** Sparkline geometry, in SVG user units. */
const SPARK_W = 116;
const SPARK_H = 30;
const SPARK_PAD = 3;

interface MonthPoint {
  /** "2026-04" — calendar month bucket. */
  month: string;
  value: number;
}

function monthKey(iso: unknown): string | null {
  if (typeof iso !== "string") return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}`;
}

function latestTimestamp(rows: Item[]): number | null {
  let best: number | null = null;
  for (const row of rows) {
    const raw = (row as unknown as Record<string, unknown>)[
      ACTIVITY_DATE_FIELD
    ];
    if (typeof raw !== "string") continue;
    const ms = Date.parse(raw);
    if (Number.isNaN(ms)) continue;
    if (best === null || ms > best) best = ms;
  }
  return best;
}

/**
 * Buckets a group's rows by calendar month and aggregates each bucket the same
 * way the headline value is aggregated, so the trend and the number agree.
 *
 * Months with no rows are filled with 0 so a gap reads as a dip, not as a
 * straight line between two distant points.
 */
function monthlySeries(
  rows: Item[],
  agg: EntityBlock["agg"],
  field: string | undefined,
): MonthPoint[] {
  const buckets = new Map<string, Item[]>();
  for (const row of rows) {
    const key = monthKey(
      (row as unknown as Record<string, unknown>)[ACTIVITY_DATE_FIELD],
    );
    if (key === null) continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }
  if (buckets.size === 0) return [];

  const keys = [...buckets.keys()].sort();
  const first = keys[0];
  const last = keys[keys.length - 1];

  // Walk month-by-month from first to last so the x axis is real time.
  const out: MonthPoint[] = [];
  const [fy, fm] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  let y = fy;
  let m = fm;
  // Bounded by construction: at most (last - first) iterations.
  while (y < ly || (y === ly && m <= lm)) {
    const key = `${y}-${`${m}`.padStart(2, "0")}`;
    const bucketRows = buckets.get(key);
    out.push({
      month: key,
      // No rows in this month is a genuine zero, not missing data. A month
      // whose rows all have a null field aggregates to null → also 0 here.
      value: bucketRows ? (aggregate(bucketRows, agg ?? "count", field ?? "") ?? 0) : 0,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/**
 * Tiny inline SVG trend. Deliberately NOT Recharts — a 116x30 polyline does
 * not justify a chart runtime per card, and 12 cards of ResponsiveContainer is
 * a measurable amount of layout work.
 */
function Sparkline({ points }: { points: MonthPoint[] }) {
  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  // All-equal (includes the all-zero case) → flat line at mid height, and
  // never a divide-by-zero in the y projection.
  const span = max - min;
  const innerW = SPARK_W - SPARK_PAD * 2;
  const innerH = SPARK_H - SPARK_PAD * 2;

  const x = (i: number) =>
    points.length === 1
      ? SPARK_PAD + innerW / 2
      : SPARK_PAD + (i / (points.length - 1)) * innerW;
  const y = (v: number) =>
    span === 0
      ? SPARK_PAD + innerH / 2
      : SPARK_PAD + innerH - ((v - min) / span) * innerH;

  const lastX = x(points.length - 1);
  const lastY = y(values[values.length - 1]);
  const rising = values[values.length - 1] > values[0];

  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="shrink-0 overflow-visible"
      role="img"
      aria-label={`Trend across ${points.length} ${
        points.length === 1 ? "month" : "months"
      }`}
    >
      {/* A single data point has no line to draw — show the dot alone. */}
      {points.length > 1 ? (
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
          fill="none"
          stroke={rising ? "var(--warning)" : "var(--accent)"}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <circle
        cx={lastX}
        cy={lastY}
        r={2.25}
        fill={rising ? "var(--warning)" : "var(--accent)"}
      />
    </svg>
  );
}

interface EntityGroup {
  key: string;
  rows: Item[];
  value: number | null;
  lastMs: number | null;
  series: MonthPoint[];
}

const LAST_ACTIVITY_FMT = new Intl.DateTimeFormat("en-CA", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default function EntityBlockView({
  block,
  items,
}: {
  block: EntityBlock;
  items: Item[];
}) {
  const selectItem = useSelectItem();
  const [page, setPage] = useState(1);
  const perPage = block.limit ?? 12;

  const rows = applyFilters(items, block.filters);

  // Group by whatever field the model named. Nothing about the field is
  // assumed — a missing value becomes its own "—" group rather than vanishing.
  const buckets = new Map<string, Item[]>();
  for (const row of rows) {
    const raw = (row as unknown as Record<string, unknown>)[block.groupBy];
    const key = raw == null || raw === "" ? "—" : String(raw);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  const groups: EntityGroup[] = [...buckets.entries()].map(([key, groupRows]) => ({
    key,
    rows: groupRows,
    // `agg` and `field` are both optional in the schema: with neither, the
    // meaningful roll-up is "how many rows mention this entity".
    value:
      block.agg && block.field
        ? aggregate(groupRows, block.agg, block.field)
        : groupRows.length,
    lastMs: latestTimestamp(groupRows),
    series: monthlySeries(groupRows, block.agg ?? "count", block.field),
  }));

  // Biggest first. Nulls (every amount in the group was null) sink to the
  // bottom instead of being coerced to 0 and outranking real small values.
  groups.sort((a, b) => {
    if (a.value === null && b.value === null) return b.rows.length - a.rows.length;
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return b.value - a.value;
  });

  const total = groups.length;
  const current = clampPage(page, total, perPage);
  const shown = pageSlice(groups, current, perPage);

  const valueLabel =
    block.agg && block.field
      ? `${block.agg} of ${fieldLabel(block.field)}`
      : "items";

  const heading = block.title ?? `${fieldLabel(block.groupBy)} roll-up`;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={BLOCK_TITLE}>{heading}</h3>
        <span className={MICRO}>
          {total} {total === 1 ? "group" : "groups"} · {valueLabel}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--panel)] px-5 py-10 text-center text-sm text-[var(--ink-3)]">
          Nothing matches this block.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((group) => {
            const valueText =
              block.agg && block.field
                ? formatValue(group.value, block.format)
                : `${group.value ?? 0}`;
            const lastText =
              group.lastMs === null
                ? "no activity date"
                : LAST_ACTIVITY_FMT.format(new Date(group.lastMs));
            // Most recent row in the group is what a click should open.
            const newest =
              sortItems(group.rows, ACTIVITY_DATE_FIELD, "desc")[0] ??
              group.rows[0];

            return (
              <li key={group.key}>
                <button
                  type="button"
                  onClick={() => selectItem(newest)}
                  className="flex w-full items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-left transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--panel-raised)] sm:gap-6 sm:px-5"
                >
                  {/* min-w-0 is what lets the truncate below actually bite
                      instead of forcing the row wider than the page. */}
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]"
                      title={group.key}
                    >
                      {group.key}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-[var(--ink-4)]">
                      {group.rows.length}{" "}
                      {group.rows.length === 1 ? "item" : "items"} · last
                      activity {lastText}
                    </p>
                  </div>

                  <Sparkline points={group.series} />

                  <div className="w-[7.5rem] shrink-0 text-right sm:w-[9rem]">
                    <p
                      className="tnum truncate text-[15px] font-semibold tabular-nums text-[var(--ink)]"
                      title={valueText}
                    >
                      {valueText}
                    </p>
                    <p className={`mt-1 truncate ${MICRO}`}>{valueLabel}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={current}
        total={total}
        perPage={perPage}
        onPage={setPage}
        variant="inline"
        noun="groups"
      />
    </section>
  );
}
