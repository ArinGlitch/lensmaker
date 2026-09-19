"use client";

/**
 * The honest answer. This is a feature, not an error: when the extracted fields
 * genuinely cannot answer the question, we say so instead of drawing a chart
 * out of nothing.
 */
export default function EmptyState({
  notes,
  intent,
}: {
  notes?: string;
  intent?: string;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#1a1a19] px-6 py-12 text-center sm:px-10">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        className="mx-auto h-8 w-8 text-neutral-500"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5M8 11h6" />
      </svg>

      <h3 className="mt-4 text-base font-medium text-neutral-100">
        Not enough evidence to answer that
      </h3>

      {intent ? (
        <p className="mt-2 text-sm text-neutral-500">
          You asked: <span className="text-neutral-300">“{intent}”</span>
        </p>
      ) : null}

      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-neutral-400">
        {notes ??
          "The extracted fields do not contain what this question needs. Rather than fabricate a chart, the model declined to build one."}
      </p>

      <p className="mt-6 text-xs text-neutral-600">
        Try asking about charges, deadlines, vendors or flagged senders.
      </p>
    </section>
  );
}
