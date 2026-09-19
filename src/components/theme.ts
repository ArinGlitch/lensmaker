/**
 * Visual tokens for the presentation layer. Owned by Dev B.
 *
 * The app renders on a dark plane, so every value here is the dark-surface step
 * of the palette — chosen for the dark band, not flipped from a light one.
 * Status hues are reserved: they mean state, never "series 4", and they always
 * ship next to a label so colour is not the only channel.
 */

/** Chart chrome, for Recharts props that need real colour values. */
export const VIZ = {
  surface: "#1a1a19",
  grid: "#2c2c2a",
  axis: "#383835",
  muted: "#898781",
  ink: "#ffffff",
  inkSecondary: "#c3c2b7",
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
  neutral: "#898781",
};

/** Pill styling per status — tinted fill, matching border, readable ink. */
export const STATUS_PILL: Record<Status, string> = {
  good: "border-[#0ca30c]/40 bg-[#0ca30c]/15 text-[#0ca30c]",
  warning: "border-[#fab219]/40 bg-[#fab219]/15 text-[#fab219]",
  serious: "border-[#ec835a]/40 bg-[#ec835a]/15 text-[#ec835a]",
  critical: "border-[#d03b3b]/45 bg-[#d03b3b]/15 text-[#e06a6a]",
  neutral: "border-white/12 bg-white/5 text-neutral-300",
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
