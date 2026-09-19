"use client";

import { useMemo, useState } from "react";

import type { BucketsBlock, Item } from "@/lib/viewspec";
import {
  applyFilters,
  daysUntil,
  fieldValue,
  fieldLabel,
  formatCell,
} from "@/components/blockData";
import {
  BLOCK_TITLE,
  MICRO,
  STATUS_HEX,
  STATUS_PILL,
  statusForDays,
  type Status,
} from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";

/**
 * Age-of-inaction histogram: ONE full-width horizontal track split into
 * coloured bands, plus a legend. The silhouette is deliberately a single
 * continuous bar — BarBlock is several separate bars with axes, and this must
 * not be mistaken for it at a glance.
 *
 * "Group everything by HOW LONG IT'S BEEN WAITING, regardless of type." The
 * oldest band is the one that reads as alarming, because that is where the
 * failures are.
 */

/** Only used when the model omits `edges`. Documented default from the schema. */
const DEFAULT_EDGES = [2, 7, 14, 30];

interface Band {
  key: string;
  label: string;
  status: Status;
  rows: Item[];
}

/**
 * Turns ascending day edges into inclusive-upper bands plus a final overflow
 * band. Labels are DERIVED, never hardcoded, because the model can send any
 * edges it likes (e.g. [1,3] → "0-1d", "2-3d", "3d+").
 */
function buildBands(edges: number[]): Array<Omit<Band, "rows">> {
  const bands: Array<Omit<Band, "rows">> = [];
  let lower = 0;

  edges.forEach((edge, i) => {
    bands.push({
      key: `b${i}`,
      label: lower === edge ? `${edge}d` : `${lower}-${edge}d`,
      // Severity comes from the band's OLDEST day, so a band that reaches into
      // overdue territory grades up. statusForDays is written in
      // days-remaining, so an age of N days is -N remaining.
      status: statusForDays(-edge),
    });
    lower = edge + 1;
  });

  bands.push({
    key: "overflow",
    label: `${edges[edges.length - 1]}d+`,
    status: "critical",
  });

  return bands;
}

export default function BucketsBlockView({
  block,
  items,
}: {
  block: BucketsBlock;
  items: Item[];
}) {
  const selectItem = useSelectItem();
  const [openBand, setOpenBand] = useState<string | null>(null);

  const { bands, dated, undated, notYetWaiting } = useMemo(() => {
    const rows = applyFilters(items, block.filters);

    // Guard the edges from the model: sort ascending, drop duplicates, and
    // fall back to the documented default if nothing usable survives.
    const edges = Array.from(new Set(block.edges ?? DEFAULT_EDGES))
      .filter((n) => Number.isFinite(n) && n >= 0)
      .sort((a, b) => a - b);
    const safeEdges = edges.length > 0 ? edges : DEFAULT_EDGES;

    const built = buildBands(safeEdges).map((b) => ({ ...b, rows: [] as Item[] }));

    let undatedCount = 0;
    let futureCount = 0;

    for (const item of rows) {
      const remaining = daysUntil(fieldValue(item, block.dateField));
      if (remaining === null) {
        // Never hidden silently — surfaced as "N undated" below the bar.
        undatedCount += 1;
        continue;
      }

      // daysUntil is days REMAINING (negative = in the past). Age is the
      // inverse: how long ago the date was.
      const age = -remaining;
      if (age < 0) futureCount += 1;

      // A future date isn't "waiting" yet, so it lands in the youngest band
      // rather than being dropped. Counted separately for honesty.
      const idx = safeEdges.findIndex((e) => age <= e);
      built[idx < 0 ? built.length - 1 : idx].rows.push(item);
    }

    // Newest-first inside a band reads better than fixture order.
    for (const b of built) {
      b.rows.sort((x, y) => {
        const ax = daysUntil(fieldValue(x, block.dateField)) ?? 0;
        const ay = daysUntil(fieldValue(y, block.dateField)) ?? 0;
        return ay - ax;
      });
    }

    return {
      bands: built,
      dated: built.reduce((sum, b) => sum + b.rows.length, 0),
      undated: undatedCount,
      notYetWaiting: futureCount,
    };
  }, [items, block.filters, block.edges, block.dateField]);

  const heading =
    block.title ?? block.label ?? `Waiting by age · ${fieldLabel(block.dateField)}`;

  const selected = bands.find((b) => b.key === openBand) ?? null;

  // Zero-dated is the only genuinely empty case; an undated-only result still
  // has something true to report, so it gets the footnote instead of the panel.
  if (dated === 0 && undated === 0) {
    return (
      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
        <h3 className={BLOCK_TITLE}>{heading}</h3>
        <p className="mt-5 rounded-lg border border-dashed border-[var(--line-strong)] px-5 py-10 text-center text-sm text-[var(--ink-3)]">
          Nothing matches this block.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={`min-w-0 truncate ${BLOCK_TITLE}`} title={heading}>
          {heading}
        </h3>
        <span className={MICRO}>
          {dated} dated {dated === 1 ? "item" : "items"}
        </span>
      </div>

      {/* THE BAR. One continuous track; widths are share-of-total. */}
      {dated === 0 ? (
        <div className="mt-5 h-11 w-full rounded-lg border border-dashed border-[var(--line-strong)]" />
      ) : (
        <div className="mt-5 flex h-11 w-full overflow-hidden rounded-lg border border-[var(--line)] bg-black/30">
          {bands.map((band) => {
            // Divide-by-zero guard: this branch only runs when dated > 0.
            const pct = (band.rows.length / dated) * 100;
            // Zero-count bands are skipped entirely rather than rendered as
            // an invisible-but-clickable sliver.
            if (band.rows.length === 0) return null;
            const isOpen = openBand === band.key;

            return (
              <button
                key={band.key}
                type="button"
                onClick={() => setOpenBand(isOpen ? null : band.key)}
                title={`${band.label} · ${band.rows.length} (${Math.round(pct)}%)`}
                aria-pressed={isOpen}
                className="group relative flex min-w-0 items-center justify-center overflow-hidden border-r border-black/40 text-left transition-opacity last:border-r-0 hover:opacity-100"
                style={{
                  width: `${pct}%`,
                  background: STATUS_HEX[band.status],
                  opacity: isOpen || openBand === null ? 0.92 : 0.45,
                }}
              >
                {/* Count only when the segment is wide enough to hold it. */}
                {pct >= 9 ? (
                  <span className="tnum truncate px-1 text-[12px] font-semibold text-black/80">
                    {band.rows.length}
                  </span>
                ) : null}
                {isOpen ? (
                  <span
                    className="absolute inset-x-0 bottom-0 h-[3px] bg-white/80"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {/* Legend — every band appears, including the empty ones (greyed). */}
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {bands.map((band) => {
          const empty = band.rows.length === 0;
          const isOpen = openBand === band.key;
          const pct = dated > 0 ? Math.round((band.rows.length / dated) * 100) : 0;

          return (
            <li key={band.key} className="min-w-0">
              <button
                type="button"
                disabled={empty}
                onClick={() => setOpenBand(isOpen ? null : band.key)}
                aria-pressed={isOpen}
                className={`flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors ${
                  empty
                    ? "cursor-default opacity-45"
                    : "hover:bg-white/[0.05] cursor-pointer"
                } ${isOpen ? "bg-white/[0.07]" : ""}`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{
                    background: empty ? "var(--line-strong)" : STATUS_HEX[band.status],
                  }}
                  aria-hidden
                />
                <span className="tnum truncate text-[12px] text-[var(--ink-2)]">
                  {band.label}
                </span>
                <span className="tnum shrink-0 text-[12px] font-semibold text-[var(--ink)]">
                  {band.rows.length}
                </span>
                {!empty ? (
                  <span className="tnum shrink-0 text-[11px] text-[var(--ink-4)]">
                    {pct}%
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {/* What we could not classify. Never hidden — the manager trusts this
          more than a clean dashboard. */}
      {undated > 0 || notYetWaiting > 0 ? (
        <p className="mt-3 text-[11px] text-[var(--ink-4)]">
          {undated > 0 ? `${undated} undated` : null}
          {undated > 0 && notYetWaiting > 0 ? " · " : null}
          {notYetWaiting > 0
            ? `${notYetWaiting} not yet due (counted in the newest band)`
            : null}
        </p>
      ) : null}

      {/* The drill-down. Compact rows, each opens the email. */}
      {selected && selected.rows.length > 0 ? (
        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                STATUS_PILL[selected.status]
              }`}
            >
              {selected.label}
            </span>
            <span className={MICRO}>
              {selected.rows.length} {selected.rows.length === 1 ? "item" : "items"}
            </span>
          </div>

          <ul className="mt-2 divide-y divide-[var(--line)]">
            {selected.rows.map((item) => {
              const remaining = daysUntil(fieldValue(item, block.dateField));
              const age = remaining === null ? null : -remaining;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => selectItem(item)}
                    className="flex w-full items-baseline gap-3 rounded px-1 py-2 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    <span
                      className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink)]"
                      title={formatCell(item, "subject")}
                    >
                      {/* `subject` is the row's own headline, not a model-chosen
                          field: BucketsBlockSchema has no primary/secondary to
                          read from. Reported to Dev A. */}
                      {formatCell(item, "subject")}
                    </span>
                    <span className="hidden max-w-[10rem] shrink truncate text-[12px] text-[var(--ink-3)] sm:block">
                      {formatCell(item, "vendor")}
                    </span>
                    <span className="tnum shrink-0 text-[11px] tabular-nums text-[var(--ink-4)]">
                      {age === null ? "—" : `${age}d`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
