"use client";

import type { ComparisonBlock, Item } from "@/lib/viewspec";
import { aggregate } from "@/lib/aggregate";
import { applyFilters, formatValue } from "@/components/blockData";
import {
  BLOCK_TITLE,
  MICRO,
  STATUS_PILL,
  STATUS_RULE,
  type Status,
} from "@/components/theme";

/**
 * Two aggregates facing each other, with the change between them given its own
 * band underneath.
 *
 * The silhouette is the pairing: a symmetric two-column readout split by a
 * centre rail, then a full-width tinted delta band. StatBlock is one number in
 * a field of whitespace; this is deliberately two-of-a-kind plus a verdict, so
 * "old price vs new price" cannot be mistaken for "total spend" at a glance.
 *
 * Each side is the SAME rows narrowed twice: block.filters (the block's own
 * scope) then leftFilters / rightFilters. Neither side can reach for data the
 * block was not handed.
 */

/**
 * Colour by MAGNITUDE of change, never by direction.
 *
 * We cannot know whether up is bad — a rising refund is good, a rising price is
 * not — so assigning critical to increases would editorialise on data we do not
 * understand. Size is the thing we can honestly judge: the professional persona
 * asked for a 40% increase to read LOUD, so >25% lands on critical and a couple
 * of percent stays calm. Direction is carried by the arrow glyph and the signed
 * number instead, so colour is never the only channel.
 */
/**
 * Readable ink per status for the large delta number. Uses --critical-ink
 * rather than --critical: the latter is the fill hue and is too dark to set
 * 30px type in (globals.css keeps both for exactly this reason).
 */
const DELTA_INK: Record<Status, string> = {
  good: "text-[var(--good)]",
  warning: "text-[var(--warning)]",
  serious: "text-[var(--serious)]",
  critical: "text-[var(--critical-ink)]",
  neutral: "text-[var(--ink)]",
};

/**
 * Percent change in this corpus is genuinely unbounded: comparing the security
 * category (sum $3.20) against subscriptions ($136,396.95) is +4,262,305%, and
 * printing that in full both overflows the pill and tells the reader nothing
 * the absolute number does not. Past 1000% we switch to a multiplier, which
 * stays short at any magnitude and reads better anyway.
 */
function formatPct(pct: number): string {
  const size = Math.abs(pct);
  if (size >= 1000) {
    // A multiplier carries its own direction, so no +/− prefix here.
    const mult = size / 100 + 1;
    const shown = mult >= 100 ? Math.round(mult).toLocaleString("en-CA") : mult.toFixed(1);
    return pct > 0 ? `${shown}× higher` : `${shown}× lower`;
  }
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${size >= 100 ? size.toFixed(0) : size.toFixed(1)}%`;
}

function magnitudeStatus(pct: number | null): Status {
  if (pct === null) return "neutral";
  const size = Math.abs(pct);
  if (size >= 25) return "critical";
  if (size >= 10) return "serious";
  if (size >= 5) return "warning";
  return "neutral";
}

export default function ComparisonBlockView({
  block,
  items,
}: {
  block: ComparisonBlock;
  items: Item[];
}) {
  // Block scope first, then each side's own slice of those same rows.
  const scoped = applyFilters(items, block.filters);
  const leftRows = applyFilters(scoped, block.leftFilters);
  const rightRows = applyFilters(scoped, block.rightFilters);

  const left = aggregate(leftRows, block.agg, block.field);
  const right = aggregate(rightRows, block.agg, block.field);

  // Either side can legitimately aggregate to null: no matching rows, or rows
  // whose amounts are all null (36 of 85 in this corpus). A delta against a
  // missing side is meaningless, so we suppress it rather than print NaN.
  const comparable = left !== null && right !== null;
  const absDelta = comparable ? right - left : null;

  // Guard the zero divisor explicitly: percent change from 0 is undefined, and
  // dividing anyway yields Infinity (or NaN for 0 → 0). Show the absolute
  // change alone in that case.
  const pctDelta = comparable && left !== 0 ? ((right - left) / Math.abs(left)) * 100 : null;

  const status = magnitudeStatus(pctDelta);
  const rising = absDelta !== null && absDelta > 0;
  const flat = absDelta !== null && absDelta === 0;
  const arrow = flat ? "→" : rising ? "↑" : "↓";

  // Both sides empty means the block matched nothing at all — a calm panel,
  // matching CardsBlock's wording, rather than a frame full of em dashes.
  if (left === null && right === null) {
    return (
      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
        <h3 className={BLOCK_TITLE}>{block.title ?? block.label}</h3>
        <p className="mt-5 rounded-lg border border-dashed border-[var(--line-strong)] px-5 py-10 text-center text-sm text-[var(--ink-3)]">
          Nothing matches this block.
        </p>
      </section>
    );
  }

  const sides = [
    { label: block.leftLabel, value: left, rows: leftRows.length },
    { label: block.rightLabel, value: right, rows: rightRows.length },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="px-5 pt-5 sm:px-6 sm:pt-6">
        <h3 className={BLOCK_TITLE}>{block.title ?? block.label}</h3>
        {block.title ? <p className={`mt-1 ${MICRO}`}>{block.label}</p> : null}
      </div>

      {/* The facing pair. A centre rule divides them so they read as two
          comparable readings, not two unrelated stats stacked in a row. */}
      <div className="mt-5 grid grid-cols-2 divide-x divide-[var(--line)] border-t border-[var(--line)]">
        {sides.map((side, i) => (
          <div
            key={`${i}-${side.label}`}
            className={`min-w-0 px-5 py-6 sm:px-6 ${i === 1 ? "text-right" : ""}`}
          >
            <p className={`truncate ${MICRO}`} title={side.label}>
              {side.label}
            </p>
            <p
              className={`mt-3 truncate text-3xl font-semibold tracking-[-0.02em] sm:text-4xl ${
                side.value === null ? "text-[var(--ink-4)]" : "text-[var(--ink)]"
              }`}
              title={formatValue(side.value, block.format)}
            >
              {formatValue(side.value, block.format)}
            </p>
            <p className="mt-2 truncate text-[11px] text-[var(--ink-4)]">
              {side.value === null
                ? "no data"
                : `${side.rows} ${side.rows === 1 ? "row" : "rows"}`}
            </p>
          </div>
        ))}
      </div>

      {/* The delta is the insight, so it gets its own tinted full-width band
          rather than being a footnote under one of the numbers. */}
      {absDelta === null ? (
        <div className="border-t border-[var(--line)] px-5 py-4 sm:px-6">
          <p className="text-[12px] text-[var(--ink-4)]">
            One side has no data — no change to report.
          </p>
        </div>
      ) : (
        <div className="relative border-t border-[var(--line)] bg-white/[0.02] px-5 py-5 sm:px-6">
          <span
            className={`absolute inset-y-0 left-0 w-[2px] ${STATUS_RULE[status]}`}
            aria-hidden
          />
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <p className={MICRO}>Change</p>
            <p
              className={`text-2xl font-semibold tracking-[-0.02em] sm:text-3xl ${DELTA_INK[status]}`}
            >
              <span aria-hidden>{arrow}</span>{" "}
              {formatValue(Math.abs(absDelta), block.format)}
            </p>
            {pctDelta !== null ? (
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums ${STATUS_PILL[status]}`}
              >
                {formatPct(pctDelta)}
              </span>
            ) : (
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${STATUS_PILL.neutral}`}
              >
                no baseline
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-[var(--ink-4)]">
            {flat
              ? "No change between the two sides."
              : `${block.rightLabel} is ${rising ? "higher" : "lower"} than ${block.leftLabel}`}
          </p>
        </div>
      )}
    </section>
  );
}
