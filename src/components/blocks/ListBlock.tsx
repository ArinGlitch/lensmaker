"use client";

import { useState } from "react";

import type { ListBlock, Item } from "@/lib/viewspec";
import { formatCell, prepareRows, applyFilters } from "@/components/blockData";
import { BLOCK_TITLE } from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";
import ShowAll from "@/components/ShowAll";

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
  const selectItem = useSelectItem();
  const [expanded, setExpanded] = useState(false);
  const total = applyFilters(items, block.filters).length;
  const rows = prepareRows(items, {
    filters: block.filters,
    sortBy: block.sortBy,
    dir: block.dir ?? "desc",
    limit: expanded ? undefined : block.limit,
  });

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4">
      <h3 className={BLOCK_TITLE}>{block.title ?? "Ranked"}</h3>

      {rows.length === 0 ? (
        <p className="mt-4 py-8 text-center text-sm text-[var(--ink-3)]">
          Nothing matches this block.
        </p>
      ) : (
        <ol className="mt-2 divide-y divide-[var(--line)]">
          {rows.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => selectItem(item)}
                className="flex w-full items-baseline gap-4 px-1 py-2 text-left transition-colors hover:bg-white/[0.03]"
              >
              <span className="tnum w-6 shrink-0 text-right font-mono text-[11px] text-[var(--ink-4)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink)]">
                {formatCell(item, block.primary)}
              </span>
              {block.secondary ? (
                <span className="tnum shrink-0 font-mono text-[12px] text-[var(--ink-2)]">
                  {formatCell(item, block.secondary)}
                </span>
              ) : null}
            </button>
            </li>
          ))}
        </ol>
      )}
      <ShowAll
        shown={rows.length}
        total={total}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        noun="rows"
      />
    </section>
  );
}
