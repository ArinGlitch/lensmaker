"use client";

/**
 * Page through a block's rows, so every record is reachable without any block
 * growing to an unreadable length.
 *
 * Replaces the old "Show all" footer. That hid rows behind a toggle and, when
 * expanded, dumped forty rows into one panel; paging keeps every page the same
 * comfortable height.
 *
 * The model's `limit` becomes the page size rather than a hard cap — it still
 * decides how dense the block is, but nothing is unreachable any more.
 */
export function pageSlice<T>(rows: T[], page: number, perPage: number): T[] {
  const start = page * perPage;
  return rows.slice(start, start + perPage);
}

export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}

/** Clamps a page index that a shrinking result set has left out of range. */
export function clampPage(page: number, total: number, perPage: number): number {
  return Math.min(Math.max(0, page), pageCount(total, perPage) - 1);
}

export default function Pagination({
  page,
  total,
  perPage,
  onPage,
  noun = "rows",
  plain = false,
  variant = "panel",
}: {
  page: number;
  total: number;
  perPage: number;
  onPage: (next: number) => void;
  noun?: string;
  /** Matches the ablation dashboard's deliberately plain chrome. */
  plain?: boolean;
  /**
   * "panel" sits flush inside a bordered card and supplies its own gutter.
   * "inline" is for a parent that already pads its content.
   */
  variant?: "panel" | "inline";
}) {
  const pages = pageCount(total, perPage);
  if (total === 0) return null;

  const current = clampPage(page, total, perPage);
  const from = current * perPage + 1;
  const to = Math.min(total, (current + 1) * perPage);

  const btn = plain
    ? "border border-neutral-700 px-2.5 py-1 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
    : "rounded-md border border-[var(--line-strong)] px-2.5 py-1 text-[var(--ink-2)] transition-colors hover:bg-white/5 disabled:opacity-30";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 text-[11px] ${
        variant === "panel" ? "px-5 py-3" : "mt-4 pt-3"
      } ${
        plain
          ? "border-t border-neutral-700 text-neutral-400"
          : "border-t border-[var(--line)] text-[var(--ink-4)]"
      }`}
    >
      <span className="tnum">
        {from}–{to} of {total} {noun}
      </span>

      {pages <= 1 ? null : (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(current - 1)}
          disabled={current === 0}
          className={btn}
          aria-label={`Previous page of ${noun}`}
        >
          Prev
        </button>
        <span className="tnum px-1">
          {current + 1} / {pages}
        </span>
        <button
          type="button"
          onClick={() => onPage(current + 1)}
          disabled={current >= pages - 1}
          className={btn}
          aria-label={`Next page of ${noun}`}
        >
          Next
        </button>
      </div>
      )}
    </div>
  );
}
