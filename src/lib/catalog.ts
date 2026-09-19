/**
 * Block catalog + schema digest. Owned by Dev A. Dev B must not edit.
 *
 * These two exports are the ONLY things the model is told about. If a field is
 * not in ALLOWED_FIELDS, the model cannot reference it and any block that tries
 * is dropped server-side.
 */

export const SCHEMA_VERSION = "1";

export interface FieldInfo {
  name: string;
  type: "string" | "number" | "date" | "boolean";
  note: string;
}

/** Every field the model may name in a block. Enforced as an allowlist. */
export const SCHEMA_DIGEST: FieldInfo[] = [
  { name: "vendor", type: "string", note: "company/sender, e.g. Netflix" },
  { name: "subject", type: "string", note: "LONG-ish, a full subject line" },
  {
    name: "category",
    type: "string",
    note: "one of: subscription, deadline, receipt, security, general",
  },
  { name: "amount", type: "number", note: "money involved, may be null" },
  { name: "currency", type: "string", note: "CAD/USD" },
  { name: "chargeDate", type: "date", note: "when money will be taken" },
  { name: "deadlineDate", type: "date", note: "hard deadline, may be null" },
  { name: "receivedAt", type: "date", note: "when the email arrived" },
  { name: "summary", type: "string", note: "LONG prose, one sentence — never use as a badge" },
  { name: "urgency", type: "string", note: "low | medium | high" },
  { name: "isSuspicious", type: "boolean", note: "flagged as phishing" },
  {
    name: "riskReason",
    type: "string",
    note: "LONG prose, up to a paragraph — never use as a badge",
  },
];

export const ALLOWED_FIELDS: ReadonlySet<string> = new Set(
  SCHEMA_DIGEST.map((f) => f.name),
);

/**
 * Fields that render safely in a small pill. Anything else is prose and will
 * overflow the card layout, so a badge naming a prose field is stripped
 * server-side rather than trusted. Enforced in /api/view — the prompt asks
 * nicely, this makes it true.
 */
export const BADGE_SAFE_FIELDS: ReadonlySet<string> = new Set([
  "urgency",
  "category",
  "currency",
  "amount",
  "chargeDate",
  "deadlineDate",
  "receivedAt",
  "isSuspicious",
]);

export interface CatalogEntry {
  type: string;
  use: string;
  props: string;
}

/** Terse on purpose — this is the bulk of the prompt and tokens are tight. */
export const CATALOG: CatalogEntry[] = [
  {
    type: "stat",
    use: "ONE headline number. Use for totals/counts.",
    props: "label, agg(sum|count|avg|min|max), field, format?, emphasis?",
  },
  {
    type: "cards",
    use: "Grid of items. Use when each item matters individually.",
    props:
      "primary, secondary?, badge?, sortBy?, dir?, limit?(1-24). " +
      "badge MUST be a short field (urgency, category, currency, amount) — " +
      "never summary, subject or riskReason.",
  },
  {
    type: "bar",
    use: "Compare a metric across categories.",
    props: "groupBy, agg, field?, format?, limit?(1-12)",
  },
  {
    type: "timeline",
    use: "Chronological/date-driven. Use for deadlines and upcoming events.",
    props: "dateField, primary, secondary?, dir?, limit?(1-20)",
  },
  {
    type: "list",
    use: "Compact ranked rows. Use when order matters more than detail.",
    props: "primary, secondary?, sortBy?, dir?, limit?(1-20)",
  },
  {
    type: "table",
    use: "Dense multi-field comparison. Use sparingly.",
    props: "columns(1-6), sortBy?, dir?, limit?(1-25)",
  },
  {
    type: "callout",
    use: "ONE urgent message. Use for warnings/risks.",
    props: "tone(info|warn|danger), message",
  },
  {
    type: "verdict",
    use:
      "THE ANSWER AS A WORD, not a number. Use FIRST for any 'am I ok / what needs me / " +
      "what is blocked / anything urgent' intent. Prefer this over stat when the user wants " +
      "reassurance or an alarm rather than a figure.",
    props:
      "headline(short phrase e.g. '3 things need you'), tone(good|warn|danger|neutral), " +
      "detail?, primary?, secondary?, sortBy?, dir?, limit?(1-10)",
  },
  {
    type: "calendar",
    use: "Month or week GRID. Use when the user thinks in dates rather than a ranked order.",
    props: "dateField, primary, scale?(month|week)",
  },
  {
    type: "buckets",
    use:
      "How long things have been waiting, as age bands. Use for 'what have I been " +
      "ignoring / sitting on / not responded to'.",
    props: "dateField, edges?(day boundaries asc, default 2/7/14/30), label?, primary?, secondary?",
  },
  {
    type: "comparison",
    use:
      "TWO numbers side by side with the delta. Use for old vs new price, this month vs " +
      "last, budget vs actual. Each side is a filtered slice of the same rows.",
    props:
      "label, field, agg, format?, leftLabel, leftFilters[], rightLabel, rightFilters[]",
  },
  {
    type: "countdown",
    use:
      "Live time remaining until the soonest matching date. Use when a single deadline " +
      "is the whole answer and precision matters.",
    props: "dateField, label?, primary?",
  },
  {
    type: "digest",
    use:
      "Grouped counts split into still-actionable vs already-expired. Use for " +
      "'what did I miss' / 'catch me up'.",
    props: "groupBy, dateField?, primary?(defaults to subject)",
  },
  {
    type: "entity",
    use:
      "One row per group (usually vendor) rolled up across everything. Use for " +
      "'who am I paying' / 'per-vendor totals'.",
    props: "groupBy, field?, agg?, format?, limit?(1-12)",
  },
  {
    type: "smallMultiples",
    use:
      "Grid of identical mini-cards, one per group, so outliers stand out. Use for " +
      "'compare across categories/people at a glance'.",
    props: "groupBy, field?, agg?, format?, limit?(1-12)",
  },
];
