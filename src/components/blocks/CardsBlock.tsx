"use client";

import { useState } from "react";

import type { CardsBlock, Item } from "@/lib/viewspec";
import { formatCell, prepareRows } from "@/components/blockData";
import { BLOCK_TITLE, STATUS_PILL, statusFor } from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";
import Pagination, { clampPage, pageSlice } from "@/components/Pagination";

/**
 * A grid of panels — used when each row matters individually. Many small boxes
 * is the silhouette that sets this apart from Stat's single number and
 * Timeline's single column.
 *
 * Each card opens the original email (Dev A's reading pane), so the whole card
 * is the hit target rather than a link buried inside it.
 */
export default function CardsBlockView({
  block,
  items,
}: {
  block: CardsBlock;
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
  const perPage = block.limit ?? 9;
  const hasFilters = (block.filters?.length ?? 0) > 0;
  const matching = prepareRows(items, {
    filters: block.filters,
    sortBy: block.sortBy,
    dir: block.dir,
  });
  const scoped = hasFilters ? matching : matching.slice(0, perPage);
  const total = scoped.length;
  const current = clampPage(page, total, perPage);
  const rows = pageSlice(scoped, current, perPage);

  return (
    <section>
      {block.title ? (
        <h3 className={`mb-3 ${BLOCK_TITLE}`}>{block.title}</h3>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--panel)] px-5 py-10 text-center text-sm text-[var(--ink-3)]">
          Nothing matches this block.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((item) => {
            const badge = block.badge ? formatCell(item, block.badge) : null;
            const primary = formatCell(item, block.primary);
            const secondary = block.secondary
              ? formatCell(item, block.secondary)
              : null;

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => selectItem(item)}
                className="flex min-h-[128px] flex-col rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-left transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--panel-raised)]"
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <p
                    className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]"
                    title={primary}
                  >
                    {primary}
                  </p>
                  {badge && badge !== "—" ? (
                    <span
                      // max-w + truncate, NOT shrink-0: a badge holding an
                      // unexpectedly long value used to push the card wider
                      // than the grid and overflow the page horizontally.
                      title={badge}
                      className={`max-w-[9rem] shrink truncate whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        STATUS_PILL[statusFor(badge)]
                      }`}
                    >
                      {badge}
                    </span>
                  ) : null}
                </div>

                {secondary ? (
                  <p
                    className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-[var(--ink-3)]"
                    title={secondary}
                  >
                    {secondary}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      <Pagination
        page={current}
        total={total}
        perPage={perPage}
        onPage={setPage}
        variant="inline"
        noun="cards"
      />
    </section>
  );
}
