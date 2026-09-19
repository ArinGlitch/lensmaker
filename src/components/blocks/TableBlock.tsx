"use client";

import { useState } from "react";

import type { TableBlock, Item } from "@/lib/viewspec";
import {
  fieldLabel,
  formatCell,
  isDateField,
  prepareRows,
} from "@/components/blockData";
import { SCHEMA_DIGEST } from "@/lib/catalog";
import { BLOCK_TITLE, MICRO, statusFor } from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";
import Pagination, { clampPage, pageSlice } from "@/components/Pagination";
import MailRow from "@/components/MailRow";

const NUMERIC = new Set(
  SCHEMA_DIGEST.filter((f) => f.type === "number").map((f) => f.name),
);

/** Numbers and dates belong in the right-hand column people scan. */
const isTrailing = (field: string) => NUMERIC.has(field) || isDateField(field);

/** Short enough to sit in a pill rather than a labelled meta pair. */
const BADGE_FIELDS = new Set(["urgency", "isSuspicious"]);

/**
 * Renders exactly the columns the spec names — never more. There is no column
 * picker and no sort header: the model chose this shape, and the user restates
 * their intent to change it.
 *
 * Laid out as a mail list rather than a spreadsheet. The columns still drive
 * everything — the first becomes the headline, short flags become a pill,
 * numbers and dates go right, and anything else is a labelled pair — but rows
 * read as messages, which is what they are, and nothing scrolls sideways.
 */
export default function TableBlockView({
  block,
  items,
}: {
  block: TableBlock;
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
  const perPage = block.limit ?? 15;
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

  const [headline, ...rest] = block.columns;
  const badgeCol = rest.find((c) => BADGE_FIELDS.has(c));
  const trailing = rest.filter((c) => isTrailing(c)).slice(0, 2);
  const metaCols = rest.filter(
    (c) => c !== badgeCol && !trailing.includes(c),
  );

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] px-5 py-3">
        <h3 className={BLOCK_TITLE}>{block.title ?? "Details"}</h3>
        {/* the columns the model chose, stated plainly — this is the whole
            contract of this block, so it should be visible */}
        <p className={MICRO}>{block.columns.map(fieldLabel).join(" · ")}</p>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-[var(--ink-3)]">
          Nothing matches this block.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {rows.map((item) => (
            <li key={item.id}>
              <MailRow
                seed={item.vendor || formatCell(item, headline)}
                primary={formatCell(item, headline)}
                meta={metaCols.map((c) => ({
                  label: fieldLabel(c),
                  value: formatCell(item, c),
                }))}
                trailingTop={trailing[0] ? formatCell(item, trailing[0]) : undefined}
                trailingBottom={
                  trailing[1] ? formatCell(item, trailing[1]) : undefined
                }
                status={badgeCol ? statusFor(formatCell(item, badgeCol)) : undefined}
                statusLabel={badgeCol ? formatCell(item, badgeCol) : undefined}
                onClick={() => selectItem(item)}
              />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={current}
        total={total}
        perPage={perPage}
        onPage={setPage}
        noun="rows"
      />
    </section>
  );
}
