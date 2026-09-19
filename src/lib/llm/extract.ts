/**
 * Pipeline A — the model as the INPUT module.
 *
 * One call per email turns unstructured prose into the structured row the app
 * stores. This is what makes "nobody typed these fields" a true statement, and
 * it is where `isSuspicious` / `riskReason` are genuinely decided rather than
 * hardcoded.
 *
 * Runs offline via `SEED_RUN_EXTRACTION=1`; its output is committed as
 * `prisma/fixtures/extracted.json` so demo-day seeding costs zero tokens.
 */
import { z } from "zod";

export const ExtractionSchema = z.object({
  category: z.enum(["subscription", "deadline", "receipt", "security", "general"]),
  summary: z.string().min(1).max(240),
  urgency: z.enum(["low", "medium", "high"]),
  /**
   * These are `.nullish()` with a default rather than `.nullable()` because
   * Bedrock's tool-call path OMITS a key entirely instead of sending null —
   * so a strictly-nullable field fails on 22 of 29 real emails.
   */
  amount: z.number().nullish().transform((v) => v ?? null),
  currency: z.string().max(8).nullish().transform((v) => v ?? null),
  /** Days from the email's received date until money moves. */
  chargeInDays: z
    .number()
    .int()
    .min(0)
    .max(400)
    .nullish()
    .transform((v) => v ?? null),
  /** Days from the email's received date until a hard deadline. */
  deadlineInDays: z
    .number()
    .int()
    .min(0)
    .max(400)
    .nullish()
    .transform((v) => v ?? null),
  isSuspicious: z.boolean(),
  riskReason: z.string().max(300).nullish().transform((v) => v ?? null),
  /** Verbatim sentence the fields were taken from — must appear in the body. */
  sourceExcerpt: z.string().min(1).max(300),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    category: {
      type: "string",
      enum: ["subscription", "deadline", "receipt", "security", "general"],
    },
    summary: { type: "string" },
    urgency: { type: "string", enum: ["low", "medium", "high"] },
    amount: { type: "number", nullable: true },
    currency: { type: "string", nullable: true },
    chargeInDays: { type: "integer", nullable: true },
    deadlineInDays: { type: "integer", nullable: true },
    isSuspicious: { type: "boolean" },
    riskReason: { type: "string", nullable: true },
    sourceExcerpt: { type: "string" },
  },
  // Nullable fields are intentionally NOT required: Bedrock omits them rather
  // than emitting null, and forcing them produces invented values.
  required: [
    "category",
    "summary",
    "urgency",
    "isSuspicious",
    "sourceExcerpt",
  ],
} as const;

export interface ExtractInput {
  vendor: string;
  subject: string;
  body: string;
  receivedAt: string;
}

export function buildExtractionPrompt(input: ExtractInput): string {
  return `Read this email and extract structured fields. Return JSON only.

FIELDS
- category: subscription (a recurring charge or trial converting to paid) | deadline (a date something must be done by) | receipt (money already taken) | security (phishing or account-threat) | general (newsletter, digest, nothing required)
- summary: ONE sentence saying why this matters to the recipient. Concrete, not generic.
- urgency: high if money moves or a deadline lands within ~7 days, or if it is a security risk. medium if within ~30 days. low otherwise.
- amount: the money figure as a number, or null. No currency symbols.
- currency: e.g. "CAD", or null.
- chargeInDays: whole days from THIS email's date until money is taken, or null.
- deadlineInDays: whole days from THIS email's date until a hard deadline, or null.
- isSuspicious: true ONLY for phishing / fraud / credential harvesting. Judge on signals such as: a sender name that imitates a real brand with altered characters, a link whose domain does not belong to the claimed brand, requests for card numbers, CVV, passwords or government IDs, and manufactured urgency ("within 24 hours", "permanently suspended"). Legitimate marketing is NOT suspicious.
- riskReason: if isSuspicious, one sentence naming the SPECIFIC signals you saw. Otherwise null.
- sourceExcerpt: the single most important sentence, copied VERBATIM from the body — the one carrying the amount, the deadline, or the fraudulent request. Copy it exactly; do not paraphrase.

Deadlines and charges are often buried in the final paragraph of a long email. Read all of it.

EMAIL
From: ${input.vendor}
Date: ${input.receivedAt}
Subject: ${input.subject}

${input.body}`;
}
