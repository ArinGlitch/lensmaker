"use client";

import { useState } from "react";
import type { Item } from "@/lib/viewspec";
import { formatMoney, formatCell } from "@/components/blockData";
import { useSelectItem } from "@/components/ItemSelection";
import Pagination, { clampPage, pageSlice } from "@/components/Pagination";
import SpendingBreakdown from "@/components/SpendingBreakdown";

const PER_PAGE = 15;

/**
 * The ablation. This layout is frozen: the same totals and the same table,
 * whatever you wanted to know. It is deliberately ordinary — that contrast is
 * the argument. Do not dress it up.
 *
 * Paging is the one concession: every record is reachable, but the shape of the
 * screen never changes and nothing here adapts to the question.
 */

/** Money is attached to the day it moves, falling back to when it arrived. */
function moneyDate(item: Item): Date | null {
  const raw = item.chargeDate ?? item.receivedAt;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : new Date(ms);
}

export default function FixedDashboard({ items }: { items: Item[] }) {
  const selectItem = useSelectItem();
  const [page, setPage] = useState(0);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const now = new Date();
  let monthTotal = 0;
  let yearTotal = 0;
  for (const item of items) {
    if (item.amount === null) continue;
    const d = moneyDate(item);
    if (!d || d.getFullYear() !== now.getFullYear()) continue;
    yearTotal += item.amount;
    if (d.getMonth() === now.getMonth()) monthTotal += item.amount;
  }

  const current = clampPage(page, items.length, PER_PAGE);
  const rows = pageSlice(items, current, PER_PAGE);

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border border-neutral-700 bg-neutral-900 p-4">
          <p className="text-xs text-neutral-400">Total items</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-100">
            {items.length}
          </p>
        </div>

        {/* One spending tile: the month is the headline, the year is context,
            and the whole tile opens the month-by-month history. */}
        <button
          type="button"
          onClick={() => setBreakdownOpen(true)}
          className="group border border-neutral-700 bg-neutral-900 p-4 text-left transition-colors hover:border-neutral-500"
        >
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-neutral-400">Spending</span>
            <span className="text-[11px] text-neutral-500 group-hover:text-neutral-300">
              Breakdown →
            </span>
          </span>
          <span className="mt-1 block text-2xl font-semibold text-neutral-100">
            {formatMoney(yearTotal)}
          </span>
          <span className="mt-1 block text-xs text-neutral-400">
            this year · {formatMoney(monthTotal)} this month
          </span>
        </button>
      </div>

      <div className="border border-neutral-700 bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-700 bg-neutral-800/60">
                {["Vendor", "Subject", "Category", "Amount", "Received"].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-normal text-neutral-400"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-neutral-500"
                  >
                    No data
                  </td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => selectItem(item)}
                    className="cursor-pointer border-b border-neutral-800 last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2 text-neutral-200">{item.vendor}</td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-neutral-300">
                      {item.subject}
                    </td>
                    <td className="px-3 py-2 text-neutral-400">
                      {item.category}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-neutral-300">
                      {item.amount === null
                        ? "—"
                        : formatMoney(item.amount, item.currency)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-neutral-400">
                      {formatCell(item, "receivedAt")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={current}
          total={items.length}
          perPage={PER_PAGE}
          onPage={setPage}
          noun="emails"
          plain
        />
      </div>

      <SpendingBreakdown
        items={items}
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
      />
    </section>
  );
}
