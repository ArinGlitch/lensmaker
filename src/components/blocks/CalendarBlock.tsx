"use client";

import { useMemo, useState } from "react";

import type { CalendarBlock, Item } from "@/lib/viewspec";
import {
  fieldValue,
  formatCell,
  prepareRows,
} from "@/components/blockData";
import {
  BLOCK_TITLE,
  MICRO,
  STATUS_HEX,
  statusForDays,
} from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";

/**
 * A month or week GRID. Three of four personas asked for a date grid rather
 * than a ranked list, and TimelineBlock already owns the vertical rail — so the
 * whole point of this block is the rectangle: seven columns, weekday headers,
 * uniform day cells. The silhouette is the contribution.
 *
 * Everything is driven by `block`: `dateField` says which date buckets a row,
 * `primary` says what a chip reads, `scale` picks month vs week. No field name
 * is hardcoded anywhere.
 */

/** Sunday-first weekday headers. Two letters so a 7-column grid fits a phone. */
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

const MONTH_FMT = new Intl.DateTimeFormat("en-CA", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const RANGE_FMT = new Intl.DateTimeFormat("en-CA", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** How many chips fit in a cell before the rest collapse into "+N". */
const CHIPS_PER_CELL = 2;

const MS_PER_DAY = 86_400_000;

/**
 * Bucket key for a date: the UTC calendar day.
 *
 * Deliberately UTC rather than local. The stored values are UTC ISO strings, so
 * a UTC key puts a row on the same day the raw data says — using local
 * components would drift a late-evening UTC deadline into the next cell for
 * anyone west of Greenwich, and the grid would disagree with the date text that
 * `formatCell` renders beside it.
 */
function dayKey(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Parses a row's date field. Returns null for nulls and unparseable values. */
function dateMs(item: Item, field: string): number | null {
  const raw = fieldValue(item, field);
  if (typeof raw !== "string") return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

/** Whole days from today (UTC) to a day key. Negative = past. */
function daysFromToday(key: number, todayKey: number): number {
  return Math.round((key - todayKey) / MS_PER_DAY);
}

export default function CalendarBlockView({
  block,
  items,
}: {
  block: CalendarBlock;
  items: Item[];
}) {
  const selectItem = useSelectItem();
  // Which period we're looking at, as an offset in months (or weeks) from the
  // data-derived anchor. This steps the rendered *range*; it is not a filter or
  // a sort control, so it does not violate the no-controls rule.
  const [offset, setOffset] = useState(0);

  // "month" is the default when the model omits `scale` — documented optional.
  const scale = block.scale ?? "month";

  const model = useMemo(() => {
    // Rows the block is scoped to, in date order. No slicing: `calendar` has no
    // `limit` in the contract, so every matching row must be placed somewhere.
    const rows = prepareRows(items, {
      filters: block.filters,
      sortBy: block.dateField,
      dir: "asc",
    });

    // Rows with no usable date cannot be placed on a grid. Counted, not hidden.
    const dated: Array<{ item: Item; key: number }> = [];
    for (const item of rows) {
      const ms = dateMs(item, block.dateField);
      if (ms !== null) dated.push({ item, key: dayKey(ms) });
    }

    if (dated.length === 0) {
      return { dated, byDay: new Map<number, Item[]>(), undatedCount: rows.length };
    }

    const byDay = new Map<number, Item[]>();
    for (const { item, key } of dated) {
      const bucket = byDay.get(key);
      if (bucket) bucket.push(item);
      else byDay.set(key, [item]);
    }

    return { dated, byDay, undatedCount: rows.length - dated.length };
  }, [items, block.filters, block.dateField]);

  const { dated, byDay, undatedCount } = model;

  // The real current date, per the brief — not the corpus "now". Only used to
  // ring today if it happens to land in the rendered range.
  const todayKey = useMemo(() => dayKey(Date.now()), []);

  const grid = useMemo(() => {
    if (dated.length === 0) return null;

    // Anchor on the EARLIEST matching date, never on new Date(): the corpus
    // spans Feb–Sep 2026 and most deadlines are already past, so anchoring on
    // the real clock would routinely render an empty grid.
    const anchor = new Date(dated[0].key);

    if (scale === "week") {
      // Start of the week (Sunday) containing the anchor, then step by weeks.
      const start =
        dated[0].key - anchor.getUTCDay() * MS_PER_DAY + offset * 7 * MS_PER_DAY;
      const days = Array.from({ length: 7 }, (_, i) => ({
        key: start + i * MS_PER_DAY,
        outside: false,
      }));
      return {
        days,
        rangeStart: start,
        rangeEnd: start + 6 * MS_PER_DAY,
        heading: `${RANGE_FMT.format(new Date(start))} – ${RANGE_FMT.format(
          new Date(start + 6 * MS_PER_DAY),
        )}`,
      };
    }

    // Month grid: pad to whole weeks so the shape is always a full rectangle.
    const year = anchor.getUTCFullYear();
    const monthIndex = anchor.getUTCMonth() + offset;
    const first = Date.UTC(year, monthIndex, 1);
    const firstDate = new Date(first);
    const monthStart = firstDate.getUTCMonth();
    const monthYear = firstDate.getUTCFullYear();
    const lead = firstDate.getUTCDay();
    const daysInMonth = new Date(Date.UTC(monthYear, monthStart + 1, 0)).getUTCDate();
    const cellCount = Math.ceil((lead + daysInMonth) / 7) * 7;
    const gridStart = first - lead * MS_PER_DAY;

    const days = Array.from({ length: cellCount }, (_, i) => {
      const key = gridStart + i * MS_PER_DAY;
      const d = new Date(key);
      return {
        key,
        // Days from the neighbouring months render as dimmed padding so the
        // grid is always a complete rectangle.
        outside: d.getUTCMonth() !== monthStart || d.getUTCFullYear() !== monthYear,
      };
    });

    return {
      days,
      rangeStart: first,
      rangeEnd: Date.UTC(monthYear, monthStart, daysInMonth),
      heading: MONTH_FMT.format(firstDate),
    };
  }, [dated, scale, offset]);

  const title = block.title ?? "Calendar";

  /* ------------------------------ empty state ----------------------------- */

  // Zero matching rows, or none of them carry a usable date: the calm panel,
  // same style as CardsBlock. Never an empty frame, never NaN.
  if (!grid) {
    return (
      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
        <h3 className={BLOCK_TITLE}>{title}</h3>
        <p className="mt-5 rounded-lg border border-dashed border-[var(--line-strong)] px-5 py-10 text-center text-sm text-[var(--ink-3)]">
          Nothing matches this block.
        </p>
      </section>
    );
  }

  // How many matching rows fall outside the period on screen, so stepping away
  // from the anchor never looks like data loss.
  const outsideRange = dated.filter(
    (d) => d.key < grid.rangeStart || d.key > grid.rangeEnd,
  ).length;

  const stepLabel = scale === "week" ? "week" : "month";

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={BLOCK_TITLE}>{title}</h3>
        <p className={MICRO}>{grid.heading}</p>
      </div>

      {/*
        The grid never scrolls sideways: seven equal fractional columns, small
        type, and truncating chips keep it inside any viewport.
      */}
      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--line)]">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className={`bg-[var(--panel-raised)] py-1.5 text-center ${MICRO}`}
          >
            {day}
          </div>
        ))}

        {grid.days.map((cell) => {
          const dayItems = byDay.get(cell.key) ?? [];
          const shown = dayItems.slice(0, CHIPS_PER_CELL);
          const hidden = dayItems.length - shown.length;
          const isToday = cell.key === todayKey;
          const dayNumber = new Date(cell.key).getUTCDate();

          return (
            <div
              key={cell.key}
              className={`relative min-h-[4.5rem] p-1 sm:min-h-[5.5rem] sm:p-1.5 ${
                // Empty cells stay visibly quieter but still form the grid —
                // the rectangle is the silhouette, so no cell is ever omitted.
                dayItems.length > 0
                  ? "bg-[var(--panel-raised)]"
                  : "bg-[var(--panel)]"
              } ${cell.outside ? "opacity-40" : ""}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`tnum inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none ${
                    isToday
                      ? "ring-1 ring-[var(--accent)] text-[var(--ink)]"
                      : dayItems.length > 0
                        ? "text-[var(--ink-2)]"
                        : "text-[var(--ink-4)]"
                  }`}
                >
                  {dayNumber}
                </span>
                {dayItems.length > CHIPS_PER_CELL ? (
                  <span className={`tnum ${MICRO}`}>{dayItems.length}</span>
                ) : null}
              </div>

              <div className="mt-1 flex flex-col gap-0.5">
                {shown.map((item) => {
                  const label = formatCell(item, block.primary);
                  // Chip severity comes from the cell's own date — overdue,
                  // imminent, or far off. Derived from `block.dateField`, so no
                  // field name is assumed here.
                  const status = statusForDays(daysFromToday(cell.key, todayKey));

                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => selectItem(item)}
                      title={`${label} · ${formatCell(item, block.dateField)}`}
                      className="flex w-full min-w-0 items-center gap-1 rounded px-0.5 py-px text-left transition-colors hover:bg-white/[0.06]"
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: STATUS_HEX[status] }}
                      />
                      {/* min-w-0 + truncate: a long subject must shrink, never
                          widen the column and push the grid off-screen. */}
                      <span className="min-w-0 flex-1 truncate text-[10px] leading-tight text-[var(--ink-2)] sm:text-[11px]">
                        {label}
                      </span>
                    </button>
                  );
                })}

                {hidden > 0 ? (
                  <span className="px-0.5 text-[10px] leading-tight text-[var(--ink-3)]">
                    +{hidden}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-[var(--ink-3)]">
        <span>
          {dated.length} dated {dated.length === 1 ? "item" : "items"}
          {outsideRange > 0 ? ` · ${outsideRange} outside this ${stepLabel}` : ""}
          {undatedCount > 0 ? ` · ${undatedCount} with no date` : ""}
        </span>

        {/*
          Range stepping, not filtering: the matching rows span several months,
          and without this the ones outside the anchor period are unreachable.
        */}
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset((v) => v - 1)}
            aria-label={`Previous ${stepLabel}`}
            className="rounded border border-[var(--line-strong)] px-2 py-1 text-[11px] leading-none text-[var(--ink-2)] transition-colors hover:bg-white/5"
          >
            ‹
          </button>
          {offset !== 0 ? (
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="rounded border border-[var(--line-strong)] px-2 py-1 text-[11px] leading-none text-[var(--ink-2)] transition-colors hover:bg-white/5"
            >
              Reset
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setOffset((v) => v + 1)}
            aria-label={`Next ${stepLabel}`}
            className="rounded border border-[var(--line-strong)] px-2 py-1 text-[11px] leading-none text-[var(--ink-2)] transition-colors hover:bg-white/5"
          >
            ›
          </button>
        </span>
      </div>
    </section>
  );
}
