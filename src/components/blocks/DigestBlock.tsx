"use client";

import { useState } from "react";

import type { DigestBlock, Item } from "@/lib/viewspec";
import {
  applyFilters,
  daysUntil,
  fieldLabel,
  fieldValue,
  formatCell,
  sortItems,
} from "@/components/blockData";
import {
  BLOCK_TITLE,
  MICRO,
  STATUS_PILL,
  statusForDays,
} from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";

/**
 * "What did I miss while I was out." A ledger of groups with a prominent count
 * each, expandable to the rows inside, plus a SEPARATE collapsed section
 * holding everything that already expired.
 *
 * Silhouette: a stack of wide count rows — big number on the right, group name
 * on the left — with a dimmed, folded-away block beneath. Unlike bar (no axes,
 * no proportional geometry), cards/small-multiples (not a grid), stat (many
 * numbers, not one), timeline, list, table and callout.
 *
 * Three personas asked for exactly this split: the still-actionable stuff up
 * top, and the "too late, sorry" pile acknowledged but out of the way. Showing
 * that most of it resolved itself IS the value, so the expired count is always
 * stated even while its rows stay hidden.
 */

interface Group {
  name: string;
  live: Item[];
  expired: Item[];
}

/** Placeholder for rows whose groupBy field is null/blank. */
const UNGROUPED = "Uncategorized";

export default function DigestBlockView({
  block,
  items,
}: {
  block: DigestBlock;
  items: Item[];
}) {
  const selectItem = useSelectItem();
  /** Which primary groups the user has opened. */
  const [open, setOpen] = useState<Record<string, boolean>>({});
  /** The expired pile is COLLAPSED BY DEFAULT, by design. */
  const [showExpired, setShowExpired] = useState(false);

  const rows = applyFilters(items, block.filters);

  /* A row is "expired" only when the model named a dateField AND that field
     holds a parseable date already in the past. No dateField => one section,
     everything actionable. A row with no date is still actionable: an
     undated obligation has not passed. */
  const isExpired = (item: Item): boolean => {
    if (!block.dateField) return false;
    const raw = fieldValue(item, block.dateField);
    if (typeof raw !== "string") return false;
    const ms = Date.parse(raw);
    if (Number.isNaN(ms)) return false;
    return ms < Date.now();
  };

  /* Group names are derived from the data — never a hardcoded category list.
     Insertion order follows the sorted rows so grouping is deterministic. */
  const sorted = sortItems(rows, block.groupBy, "asc");
  const byName = new Map<string, Group>();
  for (const item of sorted) {
    const raw = fieldValue(item, block.groupBy);
    const name =
      raw == null || String(raw).trim() === ""
        ? UNGROUPED
        : formatCell(item, block.groupBy);
    let group = byName.get(name);
    if (!group) {
      group = { name, live: [], expired: [] };
      byName.set(name, group);
    }
    (isExpired(item) ? group.expired : group.live).push(item);
  }

  const groups = [...byName.values()];
  // Busiest actionable group first — that is what the reader is scanning for.
  const liveGroups = groups
    .filter((g) => g.live.length > 0)
    .sort((a, b) => b.live.length - a.live.length || a.name.localeCompare(b.name));
  const expiredGroups = groups
    .filter((g) => g.expired.length > 0)
    .sort(
      (a, b) => b.expired.length - a.expired.length || a.name.localeCompare(b.name),
    );

  const liveTotal = liveGroups.reduce((sum, g) => sum + g.live.length, 0);
  const expiredTotal = expiredGroups.reduce((sum, g) => sum + g.expired.length, 0);

  const title = block.title ?? `By ${fieldLabel(block.groupBy).toLowerCase()}`;

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
        <h3 className={`mb-3 ${BLOCK_TITLE}`}>{title}</h3>
        <p className="rounded-lg border border-dashed border-[var(--line-strong)] px-5 py-10 text-center text-sm text-[var(--ink-3)]">
          Nothing matches this block.
        </p>
      </section>
    );
  }

  /** One row per item inside an opened group. */
  const renderItems = (list: Item[], dim: boolean) => (
    <ul className={dim ? "opacity-60" : undefined}>
      {list.map((item) => {
        const days = block.dateField
          ? daysUntil(fieldValue(item, block.dateField))
          : null;
        // `primary` is optional; `subject` is the documented fallback for the
        // row's own label, since every Item always has one.
        const label = block.primary
          ? formatCell(item, block.primary)
          : item.subject;

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => selectItem(item)}
              className="flex w-full items-center gap-3 border-t border-[var(--line)] px-3 py-2 text-left transition-colors hover:bg-white/[0.03] sm:px-4"
            >
              <span
                className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink-2)]"
                title={label}
              >
                {label}
              </span>
              {block.dateField ? (
                <span
                  className={`max-w-[10rem] shrink truncate whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                    STATUS_PILL[statusForDays(days)]
                  }`}
                  title={formatCell(item, block.dateField)}
                >
                  {formatCell(item, block.dateField)}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );

  /** The count row itself: name left, big count right, click to expand. */
  const renderGroupRow = (group: Group, count: number, list: Item[], dim: boolean) => {
    const key = `${dim ? "x" : "a"}:${group.name}`;
    const isOpen = open[key] ?? false;
    return (
      <li
        key={key}
        className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel-raised)]"
      >
        <button
          type="button"
          onClick={() => setOpen((prev) => ({ ...prev, [key]: !isOpen }))}
          aria-expanded={isOpen}
          className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.03] sm:px-4"
        >
          <span
            className={`w-3 shrink-0 text-center text-[10px] text-[var(--ink-4)] ${
              isOpen ? "rotate-90" : ""
            }`}
            aria-hidden
          >
            ▸
          </span>
          <span
            className={`min-w-0 flex-1 truncate text-[14px] font-medium ${
              dim ? "text-[var(--ink-3)]" : "text-[var(--ink)]"
            }`}
            title={group.name}
          >
            {group.name}
          </span>
          <span
            className={`tnum shrink-0 text-[22px] font-semibold leading-none tracking-[-0.02em] sm:text-[26px] ${
              dim ? "text-[var(--ink-3)]" : "text-[var(--ink)]"
            }`}
          >
            {count}
          </span>
        </button>
        {isOpen ? renderItems(list, dim) : null}
      </li>
    );
  };

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 className={BLOCK_TITLE}>{title}</h3>
        <span className={MICRO}>
          {block.dateField ? "still actionable" : "all items"} · {liveTotal}
        </span>
      </div>

      {liveGroups.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-[var(--line-strong)] px-5 py-8 text-center text-sm text-[var(--ink-3)]">
          Nothing still actionable — all of it has passed.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {liveGroups.map((g) => renderGroupRow(g, g.live.length, g.live, false))}
        </ul>
      )}

      {/* Separate, collapsed, dimmed: the "too late, sorry" pile. Its count is
          always visible even when its rows are not. */}
      {expiredTotal > 0 ? (
        <div className="mt-5 border-t border-dashed border-[var(--line-strong)] pt-4">
          <button
            type="button"
            onClick={() => setShowExpired((v) => !v)}
            aria-expanded={showExpired}
            className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
          >
            <span
              className={`w-3 shrink-0 text-center text-[10px] text-[var(--ink-4)] ${
                showExpired ? "rotate-90" : ""
              }`}
              aria-hidden
            >
              ▸
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink-3)]">
              {expiredTotal} already passed
            </span>
            <span className="shrink-0 text-[11px] text-[var(--ink-4)]">
              {showExpired ? "hide" : "show"}
            </span>
          </button>

          {showExpired ? (
            <ul className="mt-3 space-y-2">
              {expiredGroups.map((g) =>
                renderGroupRow(g, g.expired.length, g.expired, true),
              )}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
