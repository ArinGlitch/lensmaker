"use client";

import { MICRO } from "@/components/theme";

/**
 * The honest answer. This is a feature, not an error: when the extracted fields
 * genuinely cannot answer the question, we say so instead of drawing a chart
 * out of nothing. Styled calm and deliberate — nothing here is red.
 */
export default function EmptyState({
  notes,
  intent,
}: {
  notes?: string;
  intent?: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] px-6 py-14 text-center sm:px-10">
      <span
        className="absolute left-0 top-0 h-px w-24 bg-[var(--ink-4)]"
        aria-hidden
      />

      <p className={MICRO}>No answer available</p>

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        className="mx-auto mt-6 h-9 w-9 text-[var(--ink-4)]"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.6-3.6M8 11h6" />
      </svg>

      <h3 className="mt-5 text-base font-semibold tracking-[-0.01em] text-[var(--ink)]">
        Not enough evidence to answer that
      </h3>

      {intent ? (
        <p className="mt-2 text-[13px] text-[var(--ink-4)]">
          You asked{" "}
          <span className="text-[var(--ink-2)]">&ldquo;{intent}&rdquo;</span>
        </p>
      ) : null}

      <p className="mx-auto mt-5 max-w-md text-[13px] leading-relaxed text-[var(--ink-3)]">
        {notes ??
          "The extracted fields do not contain what this question needs. Rather than fabricate a chart, the model declined to build one."}
      </p>

      <p className="mt-8 text-[11px] text-[var(--ink-4)]">
        Try asking about charges, deadlines, vendors or flagged senders.
      </p>
    </section>
  );
}
