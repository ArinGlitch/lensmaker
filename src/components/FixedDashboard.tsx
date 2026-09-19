"use client";

import type { Item } from "@/lib/viewspec";
import { formatMoney, formatCell } from "@/components/blockData";
import { useSelectItem } from "@/components/ItemSelection";

/**
 * The ablation. This layout is frozen: the same two boxes and the same table,
 * whatever you wanted to know. It is deliberately ordinary — that contrast is
 * the argument. Do not improve it.
 */
export default function FixedDashboard({ items }: { items: Item[] }) {
  const selectItem = useSelectItem();
  const total = items.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const rows = items.slice(0, 15);

  return (
    <section className="flex flex-col gap-4">
      <p className="text-xs uppercase tracking-wider text-neutral-500">
        Fixed dashboard · same layout for every question
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border border-neutral-700 bg-neutral-900 p-4">
          <p className="text-xs text-neutral-400">Total items</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-100">
            {items.length}
          </p>
        </div>
        <div className="border border-neutral-700 bg-neutral-900 p-4">
          <p className="text-xs text-neutral-400">Total amount</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-100">
            {formatMoney(total)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border border-neutral-700 bg-neutral-900">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-700 bg-neutral-800/60">
              {["Vendor", "Subject", "Category", "Amount", "Received"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-normal text-neutral-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                  No data
                </td>
              </tr>
            ) : (
              rows.map((item) => (
                <tr key={item.id} onClick={() => selectItem(item)} className="cursor-pointer border-b border-neutral-800 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-3 py-2 text-neutral-200">{item.vendor}</td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-neutral-300">
                    {item.subject}
                  </td>
                  <td className="px-3 py-2 text-neutral-400">{item.category}</td>
                  <td className="px-3 py-2 text-neutral-300 tabular-nums">
                    {item.amount === null ? "—" : formatMoney(item.amount, item.currency)}
                  </td>
                  <td className="px-3 py-2 text-neutral-400 tabular-nums">
                    {formatCell(item, "receivedAt")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
