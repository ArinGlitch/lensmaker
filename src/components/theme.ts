/**
 * Visual tokens for the presentation layer. Owned by Dev B.
 *
 * The colour values live in globals.css as CSS custom properties; this file is
 * for the places that need a real string — Recharts props, and the status
 * mapping that turns a data value into a severity.
 *
 * Status hues are reserved: they mean state, never "series 4", and they always
 * ship next to a label so colour is never the only channel.
 */

/** Chart chrome. Recharts needs concrete values, not var() references. */
export const VIZ = {
  surface: "#101013",
  grid: "#1e1e23",
  axis: "#2a2a31",
  muted: "#71717a",
  ink: "#f4f4f5",
  inkSecondary: "#a1a1aa",
  /** Single-series bar hue. One series → no legend; the title names it. */
  series1: "#3987e5",
  series1Dim: "#256abf",
} as const;

export type Status = "good" | "warning" | "serious" | "critical" | "neutral";

export const STATUS_HEX: Record<Status, string> = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
  neutral: "#71717a",
};

/** Pill styling per status — tinted fill, matching hairline, readable ink. */
export const STATUS_PILL: Record<Status, string> = {
  good: "border-[#0ca30c]/35 bg-[#0ca30c]/10 text-[#3fbf3f]",
  warning: "border-[#fab219]/35 bg-[#fab219]/10 text-[#fab219]",
  serious: "border-[#ec835a]/35 bg-[#ec835a]/10 text-[#ec835a]",
  critical: "border-[#d03b3b]/40 bg-[#d03b3b]/12 text-[#e06a6a]",
  neutral: "border-white/10 bg-white/[0.04] text-[var(--ink-3)]",
};

/** A 2px severity rule, for marking a row or panel without shouting. */
export const STATUS_RULE: Record<Status, string> = {
  good: "bg-[#0ca30c]",
  warning: "bg-[#fab219]",
  serious: "bg-[#ec835a]",
  critical: "bg-[#d03b3b]",
  neutral: "bg-white/15",
};

/**
 * Maps a badge value to a status. Urgency and risk words carry meaning in this
 * dataset; anything else stays neutral rather than being assigned a random hue.
 */
export function statusFor(value: string | null | undefined): Status {
  if (!value) return "neutral";
  const v = value.toLowerCase();
  if (v === "high" || v === "yes" || v === "true" || v === "security") return "critical";
  if (v === "medium" || v === "deadline") return "warning";
  if (v === "low" || v === "no" || v === "false") return "good";
  return "neutral";
}

/** Days-remaining severity: overdue is critical, this week is a warning. */
export function statusForDays(days: number | null): Status {
  if (days === null) return "neutral";
  if (days < 0) return "critical";
  if (days <= 7) return "warning";
  if (days <= 30) return "serious";
  return "neutral";
}

/* --------------------------- shared block chrome -------------------------- */

/** The panel every block except stat/callout sits on. */
export const PANEL =
  "rounded-xl border border-[var(--line)] bg-[var(--panel)]";

/** Block heading — small, quiet, and the same in every block. */
export const BLOCK_TITLE = "text-[13px] font-medium text-[var(--ink-2)]";

/** Micro-label: uppercase, widely tracked, the smallest thing on screen. */
export const MICRO =
  "text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ink-4)]";
