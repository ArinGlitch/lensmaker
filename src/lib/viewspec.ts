/**
 * THE CONTRACT. Owned by Dev A. Dev B imports types from here and must not edit.
 *
 * The model returns ONLY a ViewSpec — never code, never SQL, never a component name
 * outside the catalog. Everything here is validated at runtime before it reaches React.
 */
import { z } from "zod";

/* ---------------------------------- atoms --------------------------------- */

export const FilterOpSchema = z.enum([
  "eq",
  "ne",
  "lt",
  "lte",
  "gt",
  "gte",
  "contains",
  "in",
]);

export const FilterSchema = z.object({
  field: z.string().min(1).max(40),
  op: FilterOpSchema,
  /**
   * `null` is permitted and meaningful: {op:"ne", value:null} is how the model
   * expresses "this field is set", which it reaches for constantly on nullable
   * fields like deadlineDate. Rejecting null sent valid specs to the fallback.
   */
  value: z.union([
    z.string().max(200),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.union([z.string().max(200), z.number()])).max(20),
  ]),
});

export const AggSchema = z.enum(["sum", "count", "avg", "min", "max"]);

export const FormatSchema = z.enum([
  "currency",
  "number",
  "percent",
  "date",
  "relativeDays",
  "text",
]);

export const DirSchema = z.enum(["asc", "desc"]);

const base = {
  id: z.string().min(1).max(40),
  title: z.string().max(120).optional(),
  filters: z.array(FilterSchema).max(6).optional(),
};

/* --------------------------------- blocks --------------------------------- */

export const StatBlockSchema = z.object({
  ...base,
  type: z.literal("stat"),
  label: z.string().min(1).max(80),
  agg: AggSchema,
  field: z.string().min(1).max(40),
  format: FormatSchema.optional(),
  emphasis: z.enum(["low", "normal", "high"]).optional(),
});

export const CardsBlockSchema = z.object({
  ...base,
  type: z.literal("cards"),
  primary: z.string().min(1).max(40),
  secondary: z.string().max(40).optional(),
  badge: z.string().max(40).optional(),
  sortBy: z.string().max(40).optional(),
  dir: DirSchema.optional(),
  limit: z.number().int().min(1).max(24).optional(),
});

export const BarBlockSchema = z.object({
  ...base,
  type: z.literal("bar"),
  groupBy: z.string().min(1).max(40),
  agg: AggSchema,
  field: z.string().max(40).optional(),
  format: FormatSchema.optional(),
  limit: z.number().int().min(1).max(12).optional(),
});

export const TimelineBlockSchema = z.object({
  ...base,
  type: z.literal("timeline"),
  dateField: z.string().min(1).max(40),
  primary: z.string().min(1).max(40),
  secondary: z.string().max(40).optional(),
  dir: DirSchema.optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

export const ListBlockSchema = z.object({
  ...base,
  type: z.literal("list"),
  primary: z.string().min(1).max(40),
  secondary: z.string().max(40).optional(),
  sortBy: z.string().max(40).optional(),
  dir: DirSchema.optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

export const TableBlockSchema = z.object({
  ...base,
  type: z.literal("table"),
  columns: z.array(z.string().min(1).max(40)).min(1).max(6),
  sortBy: z.string().max(40).optional(),
  dir: DirSchema.optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

export const CalloutBlockSchema = z.object({
  ...base,
  type: z.literal("callout"),
  tone: z.enum(["info", "warn", "danger"]),
  message: z.string().min(1).max(280),
});

/* ---------------------- persona-driven blocks (round 2) -------------------- */

/**
 * The answer as a WORD, not a number. Every persona's top-ranked intent wanted
 * a verdict first ("am I screwed this week?", "what's blocked on me?"), and a
 * StatBlock cannot express one.
 */
export const VerdictBlockSchema = z.object({
  ...base,
  type: z.literal("verdict"),
  /** Short phrase, e.g. "3 things need you" or "You're clear". */
  headline: z.string().min(1).max(80),
  tone: z.enum(["good", "warn", "danger", "neutral"]),
  /** Optional one-liner under the headline. */
  detail: z.string().max(200).optional(),
  /** Supporting rows: which field to show, sorted how. */
  primary: z.string().max(40).optional(),
  secondary: z.string().max(40).optional(),
  sortBy: z.string().max(40).optional(),
  dir: DirSchema.optional(),
  limit: z.number().int().min(1).max(10).optional(),
});

/** Month or week GRID. Timeline is a vertical rail; this is a different shape. */
export const CalendarBlockSchema = z.object({
  ...base,
  type: z.literal("calendar"),
  dateField: z.string().min(1).max(40),
  primary: z.string().min(1).max(40),
  /** "month" shows a 7-column grid; "week" shows a single row of 7 days. */
  scale: z.enum(["month", "week"]).optional(),
});

/** Age-of-inaction histogram: how long things have been sitting. */
export const BucketsBlockSchema = z.object({
  ...base,
  type: z.literal("buckets"),
  dateField: z.string().min(1).max(40),
  /** Day boundaries, ascending. Defaults to 2/7/14/30 when omitted. */
  edges: z.array(z.number().int().min(1).max(3650)).min(1).max(6).optional(),
  label: z.string().max(80).optional(),
  /** Display fields for the drill-down list. Added so the block need not name
   * `subject`/`vendor` literally — every other row-bearing block gets these. */
  primary: z.string().max(40).optional(),
  secondary: z.string().max(40).optional(),
});

/** Two numbers side by side: old vs new price, budget vs actual, MoM. */
export const ComparisonBlockSchema = z.object({
  ...base,
  type: z.literal("comparison"),
  label: z.string().min(1).max(80),
  field: z.string().min(1).max(40),
  agg: AggSchema,
  format: FormatSchema.optional(),
  /** The two sides, each a filtered slice of the same rows. */
  leftLabel: z.string().min(1).max(40),
  leftFilters: z.array(FilterSchema).max(6),
  rightLabel: z.string().min(1).max(40),
  rightFilters: z.array(FilterSchema).max(6),
});

/** Live-ticking time remaining until the soonest matching date. */
export const CountdownBlockSchema = z.object({
  ...base,
  type: z.literal("countdown"),
  dateField: z.string().min(1).max(40),
  label: z.string().max(80).optional(),
  primary: z.string().max(40).optional(),
});

/**
 * Grouped counts, splitting still-actionable from already-expired. Answers
 * "what did I miss while I was out".
 */
export const DigestBlockSchema = z.object({
  ...base,
  type: z.literal("digest"),
  groupBy: z.string().min(1).max(40),
  /** Date field used to decide actionable vs expired. */
  dateField: z.string().max(40).optional(),
  primary: z.string().max(40).optional(),
});

/** One entity (vendor) rolled up across every row that mentions it. */
export const EntityBlockSchema = z.object({
  ...base,
  type: z.literal("entity"),
  groupBy: z.string().min(1).max(40),
  field: z.string().max(40).optional(),
  agg: AggSchema.optional(),
  format: FormatSchema.optional(),
  limit: z.number().int().min(1).max(12).optional(),
});

/** Grid of identical mini-cards, one per group, so outliers pop. */
export const SmallMultiplesBlockSchema = z.object({
  ...base,
  type: z.literal("smallMultiples"),
  groupBy: z.string().min(1).max(40),
  field: z.string().max(40).optional(),
  agg: AggSchema.optional(),
  format: FormatSchema.optional(),
  limit: z.number().int().min(1).max(12).optional(),
});

export const BlockSchema = z.discriminatedUnion("type", [
  StatBlockSchema,
  CardsBlockSchema,
  BarBlockSchema,
  TimelineBlockSchema,
  ListBlockSchema,
  TableBlockSchema,
  CalloutBlockSchema,
  VerdictBlockSchema,
  CalendarBlockSchema,
  BucketsBlockSchema,
  ComparisonBlockSchema,
  CountdownBlockSchema,
  DigestBlockSchema,
  EntityBlockSchema,
  SmallMultiplesBlockSchema,
]);

/* -------------------------------- viewspec -------------------------------- */

export const ViewSpecSchema = z.object({
  title: z.string().min(1).max(200),
  intent_echo: z.string().min(1).max(400),
  blocks: z.array(BlockSchema).min(1).max(8),
  confidence: z.enum(["low", "medium", "high"]),
  insufficient_evidence: z.boolean(),
  notes: z.string().max(800).optional(),
});

/**
 * The envelope WITHOUT validating block shapes — blocks come through as
 * `unknown` so the server can validate each one individually.
 *
 * Parsing blocks as part of the whole object meant one malformed block failed
 * the entire spec and discarded the good blocks with it, so every intent
 * served the fallback. Validate the envelope with this, then each block with
 * `BlockSchema`, and drop only the failures.
 */
export const ViewSpecEnvelopeSchema = z.object({
  /**
   * These three are TRUNCATED, never rejected. They are cosmetic prose, and a
   * length cap on them used to fail the whole spec — discarding four perfectly
   * good blocks because the model explained itself at length. Same class of bug
   * as the riskReason cap in llm/extract.ts.
   */
  title: z
    .string()
    .min(1)
    .transform((v) => v.slice(0, 120)),
  intent_echo: z
    .string()
    .min(1)
    .transform((v) => v.slice(0, 200)),
  notes: z
    .string()
    .transform((v) => v.slice(0, 400))
    .optional(),
  blocks: z.array(z.unknown()).min(1).max(8),
  confidence: z.enum(["low", "medium", "high"]),
  insufficient_evidence: z.boolean(),
});

/* ---------------------------------- types --------------------------------- */

export type FilterOp = z.infer<typeof FilterOpSchema>;
export type Filter = z.infer<typeof FilterSchema>;
export type Agg = z.infer<typeof AggSchema>;
export type Format = z.infer<typeof FormatSchema>;
export type Dir = z.infer<typeof DirSchema>;

export type StatBlock = z.infer<typeof StatBlockSchema>;
export type CardsBlock = z.infer<typeof CardsBlockSchema>;
export type BarBlock = z.infer<typeof BarBlockSchema>;
export type TimelineBlock = z.infer<typeof TimelineBlockSchema>;
export type ListBlock = z.infer<typeof ListBlockSchema>;
export type TableBlock = z.infer<typeof TableBlockSchema>;
export type CalloutBlock = z.infer<typeof CalloutBlockSchema>;
export type VerdictBlock = z.infer<typeof VerdictBlockSchema>;
export type CalendarBlock = z.infer<typeof CalendarBlockSchema>;
export type BucketsBlock = z.infer<typeof BucketsBlockSchema>;
export type ComparisonBlock = z.infer<typeof ComparisonBlockSchema>;
export type CountdownBlock = z.infer<typeof CountdownBlockSchema>;
export type DigestBlock = z.infer<typeof DigestBlockSchema>;
export type EntityBlock = z.infer<typeof EntityBlockSchema>;
export type SmallMultiplesBlock = z.infer<typeof SmallMultiplesBlockSchema>;
export type Block = z.infer<typeof BlockSchema>;
export type ViewSpec = z.infer<typeof ViewSpecSchema>;

/**
 * A row of extracted data. Mirrors the Prisma `Item` model, but dates are
 * serialised to ISO strings because this crosses the network to the client.
 */
export interface Item {
  id: string;
  vendor: string;
  subject: string;
  category: string;
  amount: number | null;
  currency: string;
  chargeDate: string | null;
  deadlineDate: string | null;
  receivedAt: string;
  summary: string;
  urgency: string;
  isSuspicious: boolean;
  riskReason: string | null;
  sourceExcerpt: string;
  /** Full original message text, for the detail view. */
  body: string;
}

export interface SavedViewSummary {
  id: string;
  intent: string;
  spec: ViewSpec;
  pinned: boolean;
  createdAt: string;
}

export type ViewSource = "model" | "cache" | "fallback";

export interface ViewResponse {
  spec: ViewSpec;
  source: ViewSource;
  provider: string;
  latencyMs: number;
  /**
   * Why a fallback happened: "provider" means the call itself failed (expired
   * token, bad key, quota), "invalid" means the model answered but the spec
   * failed validation. The UI must not conflate them — saying "the model was
   * not reached" when it answered is a lie that sends you debugging the wrong
   * thing.
   */
  failureKind?: "provider" | "invalid";
  raw?: string;
}
