"use client";

/**
 * "Showing N of M · Show all" footer for any block that truncates.
 *
 * Blocks render only the first `limit` rows the model asked for. Without this
 * the hidden rows are invisible AND unmentioned, which reads as data loss —
 * and there is no pagination in this app to fall back on.
 */
export default function ShowAll({
  shown,
  total,
  expanded,
  onToggle,
  noun = "rows",
}: {
  shown: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  noun?: string;
}) {
  if (total <= shown && !expanded) return null;

  return (
    <div className="mt-3 flex items-center justify-between gap-4 text-xs text-[var(--ink-3)]">
      <span>
        Showing {shown} of {total} {noun}
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="rounded border border-[var(--line-strong)] px-2.5 py-1 text-[11px] text-[var(--ink-2)] transition-colors hover:bg-white/5"
      >
        {expanded ? "Show fewer" : `Show all ${total}`}
      </button>
    </div>
  );
}
