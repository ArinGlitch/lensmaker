"use client";

import { useState } from "react";

import type { ListBlock, Item } from "@/lib/viewspec";
import { formatCell, prepareRows } from "@/components/blockData";
import { BLOCK_TITLE } from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";
import Pagination, { clampPage, pageSlice } from "@/components/Pagination";


/**
 * Rows per page. Both sides of the ablation toggle page at the same size, so
 * the two screens feel like one product.
 *
 * `block.limit` still wins when the spec carries one — that is the model
 * choosing density. It currently never does: /api/view strips `limit` from
 * every block (bugs.MD #10), so this default is what actually applies.
 */
const PER_PAGE = 15;

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
  const perPage = block.limit ?? PER_PAGE;
  const hasFilters = (block.filters?.length ?? 0) > 0;
  const matching = prepareRows(items, {
    filters: block.filters,
    sortBy: block.sortBy,
    dir: block.dir ?? "desc",
  });
  const scoped = hasFilters ? matching : matching.slice(0, perPage);
  const total = scoped.length;
  const current = clampPage(page, total, perPage);
  const rows = pageSlice(scoped, current, perPage);

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
                {String(current * perPage + index + 1).padStart(2, "0")}
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
      <Pagination
        page={current}
        total={total}
        perPage={perPage}
        onPage={setPage}
        variant="inline"
        noun="rows"
      />
    </section>
  );
}
