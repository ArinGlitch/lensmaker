"use client";

import type { VerdictBlock, Item, Dir } from "@/lib/viewspec";
import { applyFilters, formatCell, prepareRows } from "@/components/blockData";
import { MICRO, type Status } from "@/components/theme";
import { useSelectItem } from "@/components/ItemSelection";

/**
 * The answer as a WORD. Every persona's top intent wanted a verdict before a
 * figure ("am I screwed this week?", "what's blocked on me?"), and a number
 * cannot say "you're clear".
 *
 * Silhouette: a tone-tinted panel with a thick left edge, one very large
 * left-aligned sentence, and — only when the model asks for rows — a short,
 * deliberately subordinate stack of hairline-separated lines beneath it. Stat
 * is a centred-ish huge NUMERAL over a rule; this is prose in a coloured frame,
 * so the two never read as the same screen.
 *
 * Calm is a requirement, not a preference: the casual persona said a screen
 * that "opens with red warnings and alarming counts" adds to the pile. So the
 * tint is low-alpha, `good`/`neutral` get no alarm affordances at all, and zero
 * rows is treated as a SUCCESS state rather than an empty frame.
 */

/**
 * tone → the status family already reserved in theme.ts, so verdict colour
 * matches the pills and rules every other block uses. No new hues, no raw hex.
 */
const TONE_STATUS: Record<VerdictBlock["tone"], Status> = {
  good: "good",
  warn: "warning",
  danger: "critical",
  neutral: "neutral",
};

/**
 * Per-tone chrome. Values are the same status hues theme.ts reserves (good
 * #0ca30c / warning #fab219 / critical #d03b3b), expressed here as the
 * panel-scale tint + edge + headline ink that STATUS_PILL does at pill scale —
 * a pill's fill is far too hot to cover a whole panel behind 48px type.
 */
const TONE = {
  good: {
    /** Eyebrow word, so colour is never the only channel carrying the tone. */
    eyebrow: "All clear",
    edge: "bg-[#0ca30c]",
    tint: "bg-[#0ca30c]/[0.055]",
    border: "border-[#0ca30c]/25",
    headline: "text-[#3fbf3f]",
    eyebrowInk: "text-[#3fbf3f]",
    rowRule: "border-[#0ca30c]/15",
  },
  warn: {
    eyebrow: "Needs you",
    edge: "bg-[#fab219]",
    tint: "bg-[#fab219]/[0.055]",
    border: "border-[#fab219]/25",
    headline: "text-[#fab219]",
    eyebrowInk: "text-[#fab219]",
    rowRule: "border-[#fab219]/15",
  },
  danger: {
    eyebrow: "Act now",
    edge: "bg-[#d03b3b]",
    tint: "bg-[#d03b3b]/[0.07]",
    border: "border-[#d03b3b]/30",
    headline: "text-[#e06a6a]",
    eyebrowInk: "text-[#e06a6a]",
    rowRule: "border-[#d03b3b]/15",
  },
  neutral: {
    eyebrow: "Verdict",
    edge: "bg-white/20",
    tint: "bg-transparent",
    border: "border-[var(--line)]",
    headline: "text-[var(--ink)]",
    eyebrowInk: "text-[var(--ink-3)]",
    rowRule: "border-[var(--line)]",
  },
} as const satisfies Record<VerdictBlock["tone"], unknown>;

export default function VerdictBlockView({
  block,
  items,
}: {
  block: VerdictBlock;
  items: Item[];
}) {
  const selectItem = useSelectItem();
  const tone = TONE[block.tone];
  const status = TONE_STATUS[block.tone];
  const alarming = block.tone === "danger" || block.tone === "warn";

  /**
   * Rows are opt-in: no `primary` means headline + detail only, which is the
   * whole point of a "you're clear" screen. `sortBy` falls back to `primary`
   * so a model that names a field but forgets the sort still gets stable order
   * rather than insertion order.
   */
  const wantsRows = Boolean(block.primary);
  const primary = block.primary;

  const matched = applyFilters(items, block.filters);
  const rows = wantsRows
    ? prepareRows(items, {
        filters: block.filters,
        sortBy: block.sortBy ?? primary,
        dir: (block.dir ?? "asc") as Dir,
        limit: block.limit,
      })
    : [];

  /**
   * "Nothing matched" is a NORMAL, GOOD outcome for this block — it is what
   * "You're clear" looks like in data — so the empty note only appears when the
   * model asked for rows AND the tone claims something is wrong. A green
   * verdict with an "empty" apology under it undercuts its own headline.
   */
  const showEmptyNote = wantsRows && rows.length === 0 && alarming;

  /** Row count only earns a mention when rows were actually hidden by `limit`. */
  const hidden = wantsRows ? Math.max(0, matched.length - rows.length) : 0;

  return (
    <section
      // `alert` only for the tones that genuinely interrupt. Announcing a
      // reassuring verdict as an alert is the opposite of what it says.
      role={alarming ? "alert" : undefined}
      className={`relative overflow-hidden rounded-xl border pl-6 pr-5 py-7 sm:pl-9 sm:pr-8 sm:py-9 ${tone.border} ${tone.tint}`}
    >
      {/* the thick tone edge — the tell that separates this from any panel */}
      <span
        className={`absolute inset-y-0 left-0 w-[3px] ${tone.edge}`}
        aria-hidden
      />

      {/* Eyebrow carries the tone as a WORD; the block title, when the model
          sends one, replaces it so we never stack two labels. */}
      <p className={`${MICRO} ${tone.eyebrowInk}`}>
        {block.title ?? tone.eyebrow}
      </p>

      {/* The hero. Readable across a room, left-aligned, and allowed to wrap —
          `break-words` + no nowrap is what keeps an 80-char headline from
          pushing the page sideways at this type size. */}
      <p
        className={`mt-3 max-w-[34ch] text-[2rem] font-semibold leading-[1.08] tracking-[-0.025em] break-words sm:text-4xl lg:text-5xl ${tone.headline}`}
      >
        {block.headline}
      </p>

      {block.detail ? (
        <p className="mt-4 max-w-[54ch] text-[14px] leading-relaxed text-[var(--ink-2)]">
          {block.detail}
        </p>
      ) : null}

      {showEmptyNote ? (
        <p className="mt-6 text-[13px] text-[var(--ink-3)]">
          Nothing matches this block.
        </p>
      ) : null}

      {rows.length > 0 && primary ? (
        // Subordinate by construction: hairlines instead of cards, small type,
        // secondary ink. It must never compete with the headline above it.
        <ul className={`mt-7 border-t ${tone.rowRule}`}>
          {rows.map((item) => {
            const head = formatCell(item, primary);
            const sub = block.secondary
              ? formatCell(item, block.secondary)
              : null;
            // Only shown when it adds something the primary line doesn't.
            const showSub =
              sub !== null && sub !== "—" && sub !== head;

            return (
              <li key={item.id} className={`border-b ${tone.rowRule}`}>
                <button
                  type="button"
                  onClick={() => selectItem(item)}
                  className="flex w-full items-baseline gap-3 px-1 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span
                    className={`mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full ${tone.edge}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[13.5px] text-[var(--ink)]"
                      title={head}
                    >
                      {head}
                    </span>
                    {showSub ? (
                      <span
                        className="mt-0.5 block truncate text-[12px] text-[var(--ink-3)]"
                        title={sub}
                      >
                        {sub}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {hidden > 0 ? (
        // No "Show all" control here on purpose: this block is the calm
        // summary, and `limit` is the model saying "max 5 rows" (the student
        // persona's words). The count keeps the rest from reading as data loss.
        <p className="mt-3 text-[11px] text-[var(--ink-4)]">
          {rows.length} of {matched.length} shown
        </p>
      ) : null}

      {/* status is named in the DOM so the tone is never colour-only */}
      <span className="sr-only">{`Verdict status: ${status}`}</span>
    </section>
  );
}
