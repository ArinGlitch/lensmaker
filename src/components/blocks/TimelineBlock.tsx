"use client";

import type { TimelineBlock, Item } from "@/lib/viewspec";
import {
  daysUntil,
  fieldValue,
  formatCell,
  formatDays,
  prepareRows,
} from "@/components/blockData";
import { STATUS_HEX, STATUS_PILL, statusForDays } from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";

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
  const rows = prepareRows(items, {
    filters: block.filters,
    sortBy: block.dateField,
    dir: block.dir ?? "asc",
    limit: block.limit ?? 12,
  });

  return (
    <section className="rounded-xl border border-white/10 bg-[#1a1a19] p-5 sm:p-6">
      <h3 className="text-sm font-medium text-neutral-300">
        {block.title ?? "Timeline"}
      </h3>

      {rows.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-white/10 px-5 py-8 text-center text-sm text-neutral-500">
          No dated items for this block.
        </p>
      ) : (
        <ol className="relative mt-5 ml-2 border-l border-white/10 pl-6">
          {rows.map((item) => {
            const days = daysUntil(fieldValue(item, block.dateField));
            const status = statusForDays(days);

            return (
              <li key={item.id} className="relative pb-7 last:pb-0">
              <button type="button" onClick={() => selectItem(item)} className="block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/60">
                <span
                  className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#1a1a19]"
                  style={{ background: STATUS_HEX[status] }}
                  aria-hidden
                />

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <time className="font-mono text-xs uppercase tracking-wide text-neutral-400">
                    {formatCell(item, block.dateField)}
                  </time>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_PILL[status]}`}
                  >
                    {days === null ? "no date" : formatDays(days)}
                  </span>
                </div>

                <p className="mt-1.5 text-[15px] font-semibold text-white">
                  {formatCell(item, block.primary)}
                </p>

                {block.secondary ? (
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-neutral-400">
                    {formatCell(item, block.secondary)}
                  </p>
                ) : null}
              </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
