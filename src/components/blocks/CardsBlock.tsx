"use client";

import type { CardsBlock, Item } from "@/lib/viewspec";
import { formatCell, prepareRows } from "@/components/blockData";
import { STATUS_PILL, statusFor } from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";

/**
 * A grid of boxes — used when each row matters individually. The shape (many
 * small panels) is the contrast against Stat's single number and Timeline's rail.
 */
export default function CardsBlockView({
  block,
  items,
}: {
  block: CardsBlock;
  items: Item[];
}) {
  const selectItem = useSelectItem();
  const rows = prepareRows(items, {
    filters: block.filters,
    sortBy: block.sortBy,
    dir: block.dir,
    limit: block.limit ?? 9,
  });

  return (
    <section>
      {block.title ? (
        <h3 className="mb-3 text-sm font-medium text-neutral-300">{block.title}</h3>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-[#1a1a19] px-5 py-8 text-center text-sm text-neutral-500">
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
                className="flex min-h-[122px] flex-col rounded-xl border border-white/10 bg-[#1a1a19] p-4 text-left transition-colors hover:border-white/20 focus:outline-none focus-visible:border-amber-400/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className="truncate text-[15px] font-semibold text-white"
                    title={primary}
                  >
                    {primary}
                  </p>
                  {badge && badge !== "—" ? (
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        STATUS_PILL[statusFor(badge)]
                      }`}
                    >
                      {badge}
                    </span>
                  ) : null}
                </div>

                {secondary ? (
                  <p
                    className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-400"
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
    </section>
  );
}
