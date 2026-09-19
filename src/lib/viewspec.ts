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
  value: z.union([
    z.string().max(200),
    z.number(),
    z.boolean(),
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

export const BlockSchema = z.discriminatedUnion("type", [
  StatBlockSchema,
  CardsBlockSchema,
  BarBlockSchema,
  TimelineBlockSchema,
  ListBlockSchema,
  TableBlockSchema,
  CalloutBlockSchema,
]);

/* -------------------------------- viewspec -------------------------------- */

export const ViewSpecSchema = z.object({
  title: z.string().min(1).max(120),
  intent_echo: z.string().min(1).max(200),
  blocks: z.array(BlockSchema).min(1).max(5),
  confidence: z.enum(["low", "medium", "high"]),
  insufficient_evidence: z.boolean(),
  notes: z.string().max(400).optional(),
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
  raw?: string;
}
