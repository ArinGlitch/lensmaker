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
  { name: "subject", type: "string", note: "email subject line" },
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
  { name: "summary", type: "string", note: "one-sentence why-it-matters" },
  { name: "urgency", type: "string", note: "low | medium | high" },
  { name: "isSuspicious", type: "boolean", note: "flagged as phishing" },
  { name: "riskReason", type: "string", note: "why it was flagged, may be null" },
];

export const ALLOWED_FIELDS: ReadonlySet<string> = new Set(
  SCHEMA_DIGEST.map((f) => f.name),
);

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
    props: "primary, secondary?, badge?, sortBy?, dir?, limit?(1-24)",
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
];
