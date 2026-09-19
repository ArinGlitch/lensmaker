"use client";

import { useEffect, useState } from "react";

import type { CountdownBlock, Item } from "@/lib/viewspec";
import {
  applyFilters,
  fieldValue,
  formatCell,
  sortItems,
} from "@/components/blockData";
import {
  BLOCK_TITLE,
  MICRO,
  STATUS_HEX,
  STATUS_PILL,
  STATUS_RULE,
  statusForDays,
  type Status,
} from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";

/**
 * A live-ticking clock aimed at ONE moment: a row of huge numbers with small
 * unit labels beneath them.
 *
 * Silhouette: three or four oversized digit groups sitting side by side above
 * an exact timestamp. Deliberately unlike stat (one number, no units, no
 * ticking), cards/small-multiples (a grid of boxes), bar, timeline (a dated
 * vertical rail), list, table and callout.
 *
 * The student intent this exists for is course enrolment: the window opens at a
 * specific MINUTE, and missing it costs a term. So the exact absolute date and
 * time are always printed under the countdown — "in 3 days" alone is useless
 * here.
 */

/** Exact absolute target, to the minute, in the viewer's own timezone. */
const EXACT_FMT = new Intl.DateTimeFormat("en-CA", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

interface Unit {
  key: string;
  value: number;
  label: string;
}

/** Whole days/hours/minutes/seconds in a millisecond span. */
function splitDuration(ms: number): Unit[] {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  return [
    { key: "d", value: days, label: days === 1 ? "day" : "days" },
    { key: "h", value: hours, label: hours === 1 ? "hour" : "hours" },
    { key: "m", value: minutes, label: minutes === 1 ? "minute" : "minutes" },
    { key: "s", value: seconds, label: seconds === 1 ? "second" : "seconds" },
  ];
}

/**
 * Severity of the countdown itself. `statusForDays` is the shared mapping, but
 * it works in whole days and cannot tell 47 hours from 3 hours — under two days
 * this block escalates to critical so the last-48-hours case reads as urgent
 * rather than as a mild warning.
 */
function countdownStatus(ms: number, overdue: boolean): Status {
  if (overdue) return "critical";
  const hours = ms / 3_600_000;
  if (hours <= 48) return "critical";
  const days = Math.floor(hours / 24);
  return statusForDays(days);
}

export default function CountdownBlockView({
  block,
  items,
}: {
  block: CountdownBlock;
  items: Item[];
}) {
  const selectItem = useSelectItem();

  // Ticks once per second. `now` is the ONLY thing that changes — every
  // displayed number is recomputed from the fixed target timestamp on each
  // render, so the clock can never drift out of sync with reality the way a
  // decremented counter does.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const title = block.title ?? block.label;

  /* Candidates: filtered rows that actually carry a parseable date in the
     model-chosen dateField. Everything else is simply not a candidate. */
  const dated = sortItems(
    applyFilters(items, block.filters).filter((item) => {
      const raw = fieldValue(item, block.dateField);
      return typeof raw === "string" && !Number.isNaN(Date.parse(raw));
    }),
    block.dateField,
    "asc",
  );

  const stamp = (item: Item): number =>
    Date.parse(String(fieldValue(item, block.dateField)));

  if (dated.length === 0) {
    return (
      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
        {title ? <h3 className={`mb-3 ${BLOCK_TITLE}`}>{title}</h3> : null}
        <p className="rounded-lg border border-dashed border-[var(--line-strong)] px-5 py-10 text-center text-sm text-[var(--ink-3)]">
          Nothing matches this block.
        </p>
      </section>
    );
  }

  // Before the first tick (server render / first paint) treat "now" as the real
  // clock so the chosen target is stable and nothing renders NaN.
  const nowMs = now ?? Date.now();

  /* Prefer the SOONEST still-future date. If every match is already past — the
     common case in this corpus, where 27 of 36 deadlines have gone — fall back
     to the MOST RECENT past one and present it as overdue on purpose. */
  const upcoming = dated.find((item) => stamp(item) >= nowMs);
  const target = upcoming ?? dated[dated.length - 1];
  const targetMs = stamp(target);
  const overdue = !upcoming;

  const deltaMs = Math.abs(targetMs - nowMs);
  const units = splitDuration(deltaMs);
  const status = countdownStatus(deltaMs, overdue);
  const accent = STATUS_HEX[status];

  // `primary` is optional: when the model names a field, that field names the
  // thing being counted down to. Otherwise the block stays anonymous rather
  // than guessing at a field name.
  const subject = block.primary ? formatCell(target, block.primary) : null;

  return (
    <section className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <span
        className={`absolute inset-x-0 top-0 h-[2px] ${STATUS_RULE[status]}`}
        aria-hidden
      />

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {title ? <h3 className={BLOCK_TITLE}>{title}</h3> : <span />}
          <span
            className={`shrink truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_PILL[status]}`}
          >
            {overdue ? "Overdue" : "Time remaining"}
          </span>
        </div>

        {subject && subject !== "—" ? (
          <p
            className="mt-3 truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]"
            title={subject}
          >
            {subject}
          </p>
        ) : null}

        {overdue ? (
          <p className="mt-3 text-[13px] text-[var(--ink-2)]">
            This window closed. Nothing ahead of you in this block.
          </p>
        ) : null}

        {/* The digit row. flex-wrap + min-w-0 so four large groups reflow onto
            a second line on narrow screens instead of overflowing sideways. */}
        <div
          className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4 sm:gap-x-9"
          role="timer"
          aria-live="off"
        >
          {units.map((unit) => (
            <div key={unit.key} className="min-w-0">
              <div
                className="tnum text-[clamp(2.25rem,9vw,3.75rem)] font-semibold leading-none tracking-[-0.03em]"
                style={{ color: overdue ? accent : "var(--ink)" }}
              >
                {unit.value.toString().padStart(2, "0")}
              </div>
              <div className={`mt-2 ${MICRO}`}>{unit.label}</div>
            </div>
          ))}
        </div>

        {overdue ? (
          <p className="mt-5 text-[13px] text-[var(--ink-2)]">
            past the deadline, and counting
          </p>
        ) : null}

        {/* The exact minute — the part the student actually needs. */}
        <div className="mt-6 border-t border-[var(--line)] pt-4">
          <div className={MICRO}>
            {overdue ? "Deadline was" : "Exact deadline"}
          </div>
          <p className="mt-1.5 text-[13px] font-medium text-[var(--ink)]">
            {EXACT_FMT.format(new Date(targetMs))}
          </p>
          <button
            type="button"
            onClick={() => selectItem(target)}
            className="mt-2 max-w-full truncate rounded text-left text-[12px] text-[var(--ink-3)] underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--ink-2)]"
            title={target.subject}
          >
            {target.subject}
          </button>
        </div>
      </div>
    </section>
  );
}
