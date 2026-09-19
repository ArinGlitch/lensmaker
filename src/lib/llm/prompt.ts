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
- Lead with a "stat" only when a single headline number is the point.
- Use "timeline" for date/deadline intents, "bar" for comparisons, "cards" when individual items matter.
- Use "callout" for risk/warning intents.
- filters use only {field, op, value} with op in eq|ne|lt|lte|gt|gte|contains|in.
- Every block needs a short unique "id".
- Set insufficient_evidence=true ONLY if the fields above genuinely cannot answer the intent. Then return a single callout explaining what's missing. Never invent data.
- intent_echo restates the intent you answered, in your own words.

USER INTENT: ${JSON.stringify(input.intent)}

Return the ViewSpec JSON now.`;
}
