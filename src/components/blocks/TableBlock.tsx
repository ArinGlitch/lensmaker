"use client";

import type { TableBlock, Item } from "@/lib/viewspec";
import { fieldLabel, formatCell, isDateField, prepareRows } from "@/components/blockData";
import { SCHEMA_DIGEST } from "@/lib/catalog";
import { BLOCK_TITLE, MICRO } from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";

const NUMERIC = new Set(
  SCHEMA_DIGEST.filter((f) => f.type === "number").map((f) => f.name),
);

/** Numbers and dates read better right-aligned; headers follow their cells. */
const rightAligned = (field: string) => NUMERIC.has(field) || isDateField(field);

/**
 * Renders exactly the columns the spec names — never more. There is no column
 * picker and no sort header: the model chose this shape, the user restates
 * their intent to change it.
 */
export default function TableBlockView({
  block,
  items,
}: {
  block: TableBlock;
  items: Item[];
}) {
  const selectItem = useSelectItem();
  const rows = prepareRows(items, {
    filters: block.filters,
    sortBy: block.sortBy,
    dir: block.dir ?? "desc",
    limit: block.limit ?? 15,
  });

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <h3 className={`border-b border-[var(--line)] px-5 py-3 ${BLOCK_TITLE}`}>
        {block.title ?? "Details"}
      </h3>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-[var(--ink-3)]">
          Nothing matches this block.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--line)]">
                {block.columns.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className={`px-5 py-2.5 ${MICRO} ${
                      rightAligned(col) ? "text-right" : "text-left"
                    }`}
                  >
                    {fieldLabel(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => selectItem(item)}
                  className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                >
                  {block.columns.map((col) => (
                    <td
                      key={col}
                      className={`max-w-[280px] truncate px-5 py-2.5 text-[13px] text-[var(--ink-2)] ${
                        rightAligned(col) ? "tnum text-right font-mono" : "text-left"
                      }`}
                      title={formatCell(item, col)}
                    >
                      {formatCell(item, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
