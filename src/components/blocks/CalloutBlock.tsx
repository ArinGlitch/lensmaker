"use client";

import type { CalloutBlock, Item } from "@/lib/viewspec";

/**
 * One message, coloured by tone. Status colour never carries the meaning alone:
 * every tone ships with an icon and a word.
 */
const TONE = {
  info: {
    label: "Note",
    wrap: "border-[#3987e5]/30 border-l-[#3987e5] bg-[#3987e5]/[0.07]",
    accent: "text-[#3987e5]",
    path: "M12 8h.01M11 12h1v4h1",
  },
  warn: {
    label: "Heads up",
    wrap: "border-[#fab219]/30 border-l-[#fab219] bg-[#fab219]/[0.07]",
    accent: "text-[#fab219]",
    path: "M12 9v4m0 4h.01",
  },
  danger: {
    label: "Risk",
    wrap: "border-[#d03b3b]/35 border-l-[#d03b3b] bg-[#d03b3b]/[0.09]",
    accent: "text-[#e06a6a]",
    path: "M12 9v4m0 4h.01",
  },
} as const;

export default function CalloutBlockView({
  block,
}: {
  block: CalloutBlock;
  items: Item[];
}) {
  const tone = TONE[block.tone];

  return (
    <section
      role={block.tone === "info" ? undefined : "alert"}
      className={`flex items-start gap-3.5 rounded-xl border border-l-[3px] px-5 py-4 ${tone.wrap}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        className={`mt-0.5 h-5 w-5 shrink-0 ${tone.accent}`}
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d={tone.path} />
      </svg>

      <div className="min-w-0">
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${tone.accent}`}
        >
          {block.title ?? tone.label}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-2)]">
          {block.message}
        </p>
      </div>
    </section>
  );
}
