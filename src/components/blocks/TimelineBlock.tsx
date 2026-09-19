"use client";

import { useState } from "react";

import type { TimelineBlock, Item } from "@/lib/viewspec";
import {
  daysUntil,
  fieldValue,
  formatCell,
  formatDays,
  prepareRows,
} from "@/components/blockData";
import {
  BLOCK_TITLE,
  STATUS_HEX,
  STATUS_PILL,
  statusForDays,
} from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";
import Pagination, { clampPage, pageSlice } from "@/components/Pagination";

/**
 * A vertical rail with dated stops. Nothing here is a box in a grid — the rail,
 * the single column, and the date gutter are what make a deadline view read as
 * a different *kind* of screen from the cards view.
 */
export default function TimelineBlockView({
  block,
  items,
}: {
  block: TimelineBlock;
  items: Item[];
}) {
  const selectItem = useSelectItem();
  const [page, setPage] = useState(0);
  /**
   * What "matches the intent" means depends on how the model expressed it.
   *
   * With filters, the filters define the match, so every matching row should be
   * reachable and `limit` is just the page size.
   *
   * With NO filters, `limit` IS the selection — "the 5 biggest", "the next 6
   * to charge" — expressed as sort + cap. Paging past it would show rows the
   * model deliberately left out, which is what made irrelevant emails appear.
   */
  const perPage = block.limit ?? 12;
  const hasFilters = (block.filters?.length ?? 0) > 0;
  const matching = prepareRows(items, {
    filters: block.filters,
    sortBy: block.dateField,
    dir: block.dir ?? "asc",
  });
  const scoped = hasFilters ? matching : matching.slice(0, perPage);
  const total = scoped.length;
  const current = clampPage(page, total, perPage);
  const rows = pageSlice(scoped, current, perPage);

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
      <h3 className={BLOCK_TITLE}>{block.title ?? "Timeline"}</h3>

      {rows.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-[var(--line-strong)] px-5 py-10 text-center text-sm text-[var(--ink-3)]">
          No dated items for this block.
        </p>
      ) : (
        <ol className="relative mt-6 ml-2 border-l border-[var(--line-strong)] pl-7">
          {rows.map((item) => {
            const days = daysUntil(fieldValue(item, block.dateField));
            const status = statusForDays(days);

            return (
              <li key={item.id} className="relative pb-7 last:pb-0">
              <button
                  type="button"
                  onClick={() => selectItem(item)}
                  className="block w-full cursor-pointer rounded-lg px-2 py-1 text-left transition-colors hover:bg-white/[0.03]"
                >
                <span
                  className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#1a1a19]"
                  style={{ background: STATUS_HEX[status] }}
                  aria-hidden
                />

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <time className="tnum font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-2)]">
                    {formatCell(item, block.dateField)}
                  </time>
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_PILL[status]}`}
                  >
                    {days === null ? "no date" : formatDays(days)}
                  </span>
                </div>

                <p className="mt-2 text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
                  {formatCell(item, block.primary)}
                </p>

                {block.secondary ? (
                  <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--ink-3)]">
                    {formatCell(item, block.secondary)}
                  </p>
                ) : null}
              </button>
              </li>
            );
          })}
        </ol>
      )}
      <Pagination
        page={current}
        total={total}
        perPage={perPage}
        onPage={setPage}
        variant="inline"
        noun="events"
      />
    </section>
  );
}
