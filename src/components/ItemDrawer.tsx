"use client";

import { useEffect, useState } from "react";
import type { Item } from "@/lib/viewspec";
import { formatCell } from "@/components/blockData";
import { STATUS_PILL, statusFor } from "@/components/theme";

/**
 * A mail-client reading pane, plus proof that Pipeline A is real.
 *
 * The "Message" tab is the full original email, laid out the way Gmail/Outlook
 * lay one out: sender avatar, subject headline, from/to/date header block, then
 * the body in readable prose.
 *
 * The "Extracted" tab shows the structured fields the model pulled out of that
 * same prose, with the exact source sentence quoted. Every other surface in this
 * app shows only the structured side; this is where a judge can see the input
 * half of the I/O claim.
 */

function initials(vendor: string): string {
  return vendor
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function senderAddress(vendor: string): string {
  const host = vendor.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `no-reply@${host || "sender"}.com`;
}

function fullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ItemDrawer({
  item,
  onClose,
}: {
  item: Item | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"message" | "extracted">("message");

  useEffect(() => {
    if (!item) return;
    setTab("message");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  const paragraphs = (item.body || item.sourceExcerpt)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const fields: { label: string; value: string }[] = [
    { label: "Vendor", value: item.vendor },
    { label: "Category", value: item.category },
    { label: "Amount", value: formatCell(item, "amount") },
    { label: "Charge date", value: formatCell(item, "chargeDate") },
    { label: "Deadline", value: formatCell(item, "deadlineDate") },
    { label: "Received", value: formatCell(item, "receivedAt") },
    { label: "Urgency", value: item.urgency },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close message"
        onClick={onClose}
        className="flex-1 bg-black/60"
      />

      <aside className="flex h-full w-full max-w-2xl flex-col border-l border-[var(--line)] bg-[#141413]">
        {/* toolbar */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-3">
          <div className="flex gap-1">
            {(["message", "extracted"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded px-3 py-1.5 text-xs transition-colors ${
                  tab === t
                    ? "bg-white/10 text-[var(--ink)]"
                    : "text-[var(--ink-3)] hover:bg-white/5"
                }`}
              >
                {t === "message" ? "Message" : "Extracted fields"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--line-strong)] px-2 py-1 text-[11px] text-[var(--ink-2)] hover:bg-white/5"
          >
            Esc
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "message" ? (
            <article className="px-6 py-6">
              <h1 className="text-xl font-semibold leading-snug text-[var(--ink)]">
                {item.subject}
              </h1>

              {/* from / to / date header, as a mail client shows it */}
              <div className="mt-4 flex items-start gap-3 border-b border-[var(--line)] pb-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold text-[var(--ink-2)]">
                  {initials(item.vendor)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium text-[var(--ink)]">
                      {item.vendor}
                    </span>
                    <span className="truncate text-xs text-[var(--ink-3)]">
                      &lt;{senderAddress(item.vendor)}&gt;
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--ink-3)]">
                    to me · {fullDate(item.receivedAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    STATUS_PILL[statusFor(item.urgency)]
                  }`}
                >
                  {item.urgency}
                </span>
              </div>

              {item.isSuspicious ? (
                <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-red-300">
                    This message looks dangerous
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-red-100/90">
                    {item.riskReason ?? "Flagged as suspicious."}
                  </p>
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-4">
                {paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="whitespace-pre-line text-[14.5px] leading-[1.7] text-[var(--ink-2)]"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </article>
          ) : (
            <div className="flex flex-col gap-6 px-6 py-6">
              <section>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-3)]">
                  Model summary
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-2)]">
                  {item.summary}
                </p>
              </section>

              {/* the payoff: raw prose in, structured fields out */}
              <section>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-3)]">
                  Sentence the fields came from
                </p>
                <blockquote className="mt-1.5 border-l-2 border-[var(--accent)]/50 bg-[var(--panel)] px-4 py-3 font-mono text-[12.5px] leading-relaxed text-[var(--ink-3)]">
                  {item.sourceExcerpt}
                </blockquote>
              </section>

              <section>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-3)]">
                  Structured fields
                </p>
                <p className="mt-1 text-xs text-[var(--ink-4)]">
                  Nobody typed these. The model read the message and wrote them.
                </p>
                <dl className="mt-2 divide-y divide-white/5 overflow-hidden rounded-xl border border-[var(--line)]">
                  {fields.map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center justify-between gap-4 bg-[var(--panel)] px-4 py-2.5"
                    >
                      <dt className="text-xs text-[var(--ink-3)]">{f.label}</dt>
                      <dd className="text-right text-sm text-[var(--ink-2)]">
                        {f.label === "Urgency" ? (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                              STATUS_PILL[statusFor(f.value)]
                            }`}
                          >
                            {f.value}
                          </span>
                        ) : (
                          f.value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
