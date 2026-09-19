"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Item } from "@/lib/viewspec";
import { formatCell, formatMoney } from "@/components/blockData";
import { MICRO } from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";

/**
 * Month-by-month spending, from the first recorded email to the last.
 *
 * Rendered as a full-screen overlay rather than its own route: every protected
 * path in this app is listed explicitly in middleware.ts, which is Dev A's
 * file, so a new route would ship unauthenticated until that matcher was
 * updated. An overlay inherits the gate on the page it opens from.
 */

/** Money belongs to the day it moves, falling back to when it arrived. */
function moneyDate(item: Item): Date | null {
  const raw = item.chargeDate ?? item.receivedAt;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : new Date(ms);
}

export interface MonthBucket {
  key: string;
  label: string;
  total: number;
  count: number;
  /** The emails behind the figure, largest first. */
  items: Item[];
}

/**
 * Every month between the first and last record, including the empty ones —
 * a gap is information, and skipping it would misrepresent the trend.
 */
export function monthlyBreakdown(items: Item[]): MonthBucket[] {
  const byKey = new Map<string, { total: number; count: number; items: Item[] }>();
  let min: Date | null = null;
  let max: Date | null = null;

  for (const item of items) {
    const d = moneyDate(item);
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
    if (item.amount === null) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = byKey.get(key) ?? { total: 0, count: 0, items: [] };
    bucket.total += item.amount;
    bucket.count += 1;
    bucket.items.push(item);
    byKey.set(key, bucket);
  }

  if (!min || !max) return [];

  const out: MonthBucket[] = [];
  const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
  const end = new Date(max.getFullYear(), max.getMonth(), 1);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const bucket = byKey.get(key) ?? { total: 0, count: 0, items: [] };
    out.push({
      key,
      label: cursor.toLocaleString(undefined, { month: "long", year: "numeric" }),
      total: bucket.total,
      count: bucket.count,
      items: [...bucket.items].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out.reverse();
}

export default function SpendingBreakdown({
  items,
  open,
  onClose,
}: {
  items: Item[];
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const selectItem = useSelectItem();
  useEffect(() => setMounted(true), []);

  function toggleMonth(key: string) {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const months = useMemo(() => monthlyBreakdown(items), [items]);
  const peak = useMemo(
    () => months.reduce((m, b) => Math.max(m, b.total), 0),
    [months],
  );
  const grand = useMemo(
    () => months.reduce((s, b) => s + b.total, 0),
    [months],
  );

  if (!open || !mounted) return null;

  return createPortal(
    <div className="reading-inset fixed inset-0 z-[45] overflow-y-auto bg-[var(--ground)]/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={MICRO}>Spending breakdown</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
              {formatMoney(grand)}
            </h2>
            <p className="mt-1 text-[13px] text-[var(--ink-3)]">
              across {months.length} {months.length === 1 ? "month" : "months"} of
              recorded email
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--line-strong)] px-3 py-1.5 text-xs text-[var(--ink-2)] transition-colors hover:bg-white/5"
          >
            Close
          </button>
        </header>

        {months.length === 0 ? (
          <p className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-12 text-center text-sm text-[var(--ink-3)]">
            Nothing with a date and an amount yet.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            {months.map((m) => {
              const isOpen = openMonths.has(m.key);
              return (
                <li key={m.key} className="border-b border-[var(--line)] last:border-0">
                  <button
                    type="button"
                    onClick={() => m.count > 0 && toggleMonth(m.key)}
                    aria-expanded={isOpen}
                    disabled={m.count === 0}
                    className="w-full px-5 py-3.5 text-left transition-colors enabled:hover:bg-white/[0.03] disabled:cursor-default"
                  >
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="flex items-baseline gap-2">
                        <span
                          className={`text-[10px] text-[var(--ink-4)] transition-transform ${
                            isOpen ? "rotate-90" : ""
                          } ${m.count === 0 ? "opacity-0" : ""}`}
                          aria-hidden
                        >
                          ▸
                        </span>
                        <span className="text-[13px] text-[var(--ink-2)]">
                          {m.label}
                        </span>
                      </span>
                      <span className="tnum text-[14px] font-medium text-[var(--ink)]">
                        {m.total === 0 ? "—" : formatMoney(m.total)}
                      </span>
                    </span>

                    {/* proportional bar: the shape of the year at a glance */}
                    <span className="mt-2 flex items-center gap-3">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <span
                          className="block h-full rounded-full bg-[var(--accent)]"
                          style={{
                            width: peak > 0 ? `${(m.total / peak) * 100}%` : "0%",
                          }}
                        />
                      </span>
                      <span className="tnum w-20 shrink-0 text-right text-[11px] text-[var(--ink-4)]">
                        {m.count} {m.count === 1 ? "charge" : "charges"}
                      </span>
                    </span>
                  </button>

                  {isOpen ? (
                    <ul className="border-t border-[var(--line)] bg-black/20">
                      {m.items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => selectItem(item)}
                            className="flex w-full items-baseline gap-3 px-5 py-2.5 pl-11 text-left transition-colors hover:bg-white/[0.03]"
                          >
                            <span className="w-28 shrink-0 truncate text-[12px] text-[var(--ink-2)]">
                              {item.vendor}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink-3)]">
                              {item.subject}
                            </span>
                            <span className="tnum shrink-0 text-[11px] text-[var(--ink-4)]">
                              {formatCell(item, item.chargeDate ? "chargeDate" : "receivedAt")}
                            </span>
                            <span className="tnum w-24 shrink-0 text-right text-[12px] text-[var(--ink)]">
                              {item.amount === null
                                ? "—"
                                : formatMoney(item.amount, item.currency)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
