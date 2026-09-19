"use client";

import type { ListBlock, Item } from "@/lib/viewspec";
import { formatCell, prepareRows } from "@/components/blockData";

/**
 * Compact ranked rows — the densest block in the set. Numbered, divided by
 * hairlines, no panels: order is the message, so nothing competes with it.
 */
export default function ListBlockView({
  block,
  items,
}: {
  block: ListBlock;
  items: Item[];
}) {
  const rows = prepareRows(items, {
    filters: block.filters,
    sortBy: block.sortBy,
    dir: block.dir ?? "desc",
    limit: block.limit ?? 10,
  });

  return (
    <section className="rounded-xl border border-white/10 bg-[#1a1a19] px-5 py-4">
      <h3 className="text-sm font-medium text-neutral-300">
        {block.title ?? "Ranked"}
      </h3>

      {rows.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-neutral-500">
          Nothing matches this block.
        </p>
      ) : (
        <ol className="mt-2 divide-y divide-white/10">
          {rows.map((item, index) => (
            <li key={item.id} className="flex items-baseline gap-4 py-2.5">
              <span className="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-neutral-600">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-white">
                {formatCell(item, block.primary)}
              </span>
              {block.secondary ? (
                <span className="shrink-0 text-xs tabular-nums text-neutral-400">
                  {formatCell(item, block.secondary)}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
