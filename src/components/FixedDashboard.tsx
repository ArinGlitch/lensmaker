"use client";

import type { Item } from "@/lib/viewspec";
import { formatMoney, formatCell } from "@/components/blockData";
import { useSelectItem } from "@/components/ItemSelection";
import { MICRO, statusFor } from "@/components/theme";
import MailRow from "@/components/MailRow";

/**
 * The ablation — what the app looks like with the model switched off.
 *
 * Polished, but **frozen**: the same two totals and the same inbox, in the same
 * order, whatever you wanted to know. That is the argument the toggle makes, so
 * the contrast to protect is *genericness*, not ugliness — every field is here
 * because it is always here, not because it answers anything.
 *
 * So: no filters, no sorting, no per-intent adaptation, and nothing on this
 * screen changes when the question does. Keep it that way.
 */
export default function FixedDashboard({ items }: { items: Item[] }) {
  const selectItem = useSelectItem();
  const total = items.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const withAmount = items.filter((i) => i.amount !== null).length;
  const rows = items.slice(0, 15);

  const tiles = [
    { label: "Total items", value: String(items.length), note: "all messages" },
    {
      label: "Total amount",
      value: formatMoney(total),
      note: `${withAmount} with a value`,
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-5"
          >
            <p className={MICRO}>{t.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
              {t.value}
            </p>
            <p className="mt-2 text-[11px] text-[var(--ink-4)]">{t.note}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] px-5 py-3">
          <h3 className="text-[13px] font-medium text-[var(--ink-2)]">Inbox</h3>
          <p className={MICRO}>Newest first · always</p>
        </div>

        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--ink-3)]">
            No data.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {rows.map((item) => (
              <li key={item.id}>
                <MailRow
                  seed={item.vendor}
                  primary={item.vendor}
                  secondary={item.subject}
                  meta={[{ label: "Category", value: item.category }]}
                  trailingTop={
                    item.amount === null
                      ? "—"
                      : formatMoney(item.amount, item.currency)
                  }
                  trailingBottom={formatCell(item, "receivedAt")}
                  status={statusFor(item.urgency)}
                  statusLabel={item.urgency}
                  onClick={() => selectItem(item)}
                />
              </li>
            ))}
          </ul>
        )}

        {items.length > rows.length ? (
          <p className="border-t border-[var(--line)] px-5 py-3 text-[11px] text-[var(--ink-4)]">
            Showing {rows.length} of {items.length}. This view does not change.
          </p>
        ) : null}
      </div>
    </section>
  );
}
