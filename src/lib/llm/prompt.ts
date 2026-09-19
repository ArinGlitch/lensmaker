import type { GenerateInput } from "./types";

/**
 * ONE shared prompt for both providers. Kept terse — the catalog is the bulk of
 * the tokens and the Gemini free-tier budget is tight.
 */
export function buildPrompt(input: GenerateInput): string {
  const fields = input.schemaDigest
    .map((f) => `${f.name}:${f.type} (${f.note})`)
    .join("\n");
  const blocks = input.catalog
    .map((c) => `${c.type} — ${c.use} props: ${c.props}`)
    .join("\n");

  return `You compose dashboards. Given a user's intent, choose which UI blocks to show and how to configure them.

You do NOT write code, HTML, SQL, or component names outside the catalog. You return a ViewSpec JSON object only.

AVAILABLE FIELDS (you may ONLY reference these names):
${fields}

BLOCK CATALOG (you may ONLY use these types):
${blocks}

RULES
- 1 to 5 blocks. Pick the FEWEST that answer the intent well.
- NEVER emit the same block type twice. Each block must be a DIFFERENT type.
- Prefer a mix of shapes: one number, one chart, one item view. Visual variety matters.
- To express "this field is set", use {field, op:"ne", value:null}.
- COUNTDOWN EXCEPTION: never pre-filter a "countdown" block by its own dateField.
  The block picks the soonest future date itself and falls back to showing the most
  recent overdue one; a {gte,"now"} filter makes that fallback unreachable and the
  block renders empty instead.
- TIME VOCABULARY: valid relative filter values are "now", "today", and
  arithmetic on them: "now+7d", "now-30d", "now+2w", "now+3m" (d=days, w=weeks,
  h=hours, m=months). Use these for windows: "this week" is
  {gte,"now"} AND {lt,"now+7d"}. Nothing else is supported — any other string
  is treated as a literal and will match nothing.
- TIME RULE: the value "now" is a valid filter value meaning this moment.
  For intents about what is UPCOMING / due / due soon / coming up, filter
  {field:"deadlineDate", op:"gte", value:"now"} (or chargeDate) and sort dir:"asc".
  Most data is HISTORICAL — without this you will show items months overdue.
  For intents about what is OVERDUE / missed / late, use op:"lt" with "now" instead.
- Lead with a "stat" only when a single headline number is the point.
- Use "timeline" for date/deadline intents, "bar" for comparisons, "cards" when individual items matter.
- Use "callout" for risk/warning intents.
- MONEY RULE: for any spending/charge/cost/total intent, ALWAYS add the filter
  {field:"isSuspicious", op:"eq", value:false}. An amount demanded by a phishing
  email is not money the user spent, and including it corrupts the total.
  The ONLY exception is an intent explicitly about scams or security.
- filters use only {field, op, value} with op in eq|ne|lt|lte|gt|gte|contains|in.
- Every block needs a short unique "id".
- ROW CONTENT RULE: for primary/secondary on any row-bearing block, pick fields a
  human can READ — subject, vendor, summary. NEVER use urgency, category or
  isSuspicious as primary/secondary: they are one-word labels, so a row renders as
  "high / deadline" and tells the reader nothing. Those belong in a badge or a filter.
- "badge" fields render as a small pill: use ONLY short values (urgency, category, currency). NEVER summary, subject or riskReason — those are prose and will break the layout.
- To show prose, use it as "secondary" or use a callout, never a badge.
- Set insufficient_evidence=true ONLY if the fields above genuinely cannot answer the intent. Then return a single callout explaining what's missing. Never invent data.
- intent_echo restates the intent you answered, in your own words.

USER INTENT: ${JSON.stringify(input.intent)}

Return the ViewSpec JSON now.`;
}
