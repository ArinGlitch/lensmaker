"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Item } from "@/lib/viewspec";
import { formatMoney } from "@/components/blockData";
import { MICRO } from "@/components/theme";

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
}

/**
 * Every month between the first and last record, including the empty ones —
 * a gap is information, and skipping it would misrepresent the trend.
 */
export function monthlyBreakdown(items: Item[]): MonthBucket[] {
  const byKey = new Map<string, { total: number; count: number }>();
  let min: Date | null = null;
  let max: Date | null = null;

  for (const item of items) {
    const d = moneyDate(item);
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
    if (item.amount === null) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = byKey.get(key) ?? { total: 0, count: 0 };
    bucket.total += item.amount;
    bucket.count += 1;
    byKey.set(key, bucket);
  }

  if (!min || !max) return [];

  const out: MonthBucket[] = [];
  const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
  const end = new Date(max.getFullYear(), max.getMonth(), 1);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const bucket = byKey.get(key) ?? { total: 0, count: 0 };
    out.push({
      key,
      label: cursor.toLocaleString(undefined, { month: "long", year: "numeric" }),
      total: bucket.total,
      count: bucket.count,
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
  useEffect(() => setMounted(true), []);

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
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[var(--ground)]/95 backdrop-blur-sm">
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
            {months.map((m) => (
              <li
                key={m.key}
                className="border-b border-[var(--line)] px-5 py-3.5 last:border-0"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[13px] text-[var(--ink-2)]">
                    {m.label}
                  </span>
                  <span className="tnum text-[14px] font-medium text-[var(--ink)]">
                    {m.total === 0 ? "—" : formatMoney(m.total)}
                  </span>
                </div>

                {/* proportional bar: the shape of the year at a glance */}
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{
                        width: peak > 0 ? `${(m.total / peak) * 100}%` : "0%",
                      }}
                    />
                  </div>
                  <span className="tnum w-20 shrink-0 text-right text-[11px] text-[var(--ink-4)]">
                    {m.count} {m.count === 1 ? "charge" : "charges"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
