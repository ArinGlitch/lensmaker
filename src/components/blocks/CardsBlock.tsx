"use client";

import { useState } from "react";

import type { CardsBlock, Item } from "@/lib/viewspec";
import { formatCell, prepareRows, applyFilters } from "@/components/blockData";
import { BLOCK_TITLE, STATUS_PILL, statusFor } from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";
import ShowAll from "@/components/ShowAll";

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
  const [expanded, setExpanded] = useState(false);
  const total = applyFilters(items, block.filters).length;
  const rows = prepareRows(items, {
    filters: block.filters,
    sortBy: block.sortBy,
    dir: block.dir,
    limit: expanded ? undefined : block.limit,
  });

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
      <ShowAll
        shown={rows.length}
        total={total}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        noun="cards"
      />
    </section>
  );
}
