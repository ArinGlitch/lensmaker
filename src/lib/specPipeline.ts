/**
 * The shared spec pipeline. Both a fresh generation (/api/view) and an
 * incremental refinement (/api/view/refine) run model output through EXACTLY
 * this code, so a refinement can never bypass a safety rule that a generation
 * enforces. Duplicating it is how the two filter paths drifted before.
 */
import {
  ALLOWED_FIELDS,
  BADGE_SAFE_FIELDS,
  LABEL_ONLY_FIELDS,
  READABLE_FIELDS,
} from "@/lib/catalog";
import {
  BlockSchema,
  ViewSpecEnvelopeSchema,
  type Block,
  type ViewSpec,
} from "@/lib/viewspec";

function referencedFields(block: Block): string[] {
  switch (block.type) {
    case "stat":
      return [block.field];
    case "cards":
      return [block.primary, block.secondary, block.badge, block.sortBy].filter(
        (s): s is string => typeof s === "string",
      );
    case "bar":
      return [block.groupBy, block.field].filter(
        (s): s is string => typeof s === "string",
      );
    case "timeline":
      return [block.dateField, block.primary, block.secondary].filter(
        (s): s is string => typeof s === "string",
      );
    case "list":
      return [block.primary, block.secondary, block.sortBy].filter(
        (s): s is string => typeof s === "string",
      );
    case "table":
      return [...block.columns, block.sortBy].filter(
        (s): s is string => typeof s === "string",
      );
    case "callout":
      return [];
    case "verdict":
      return [block.primary, block.secondary, block.sortBy].filter(
        (x): x is string => typeof x === "string",
      );
    case "calendar":
      return [block.dateField, block.primary, block.secondary].filter(
        (x): x is string => typeof x === "string",
      );
    case "buckets":
      return [block.dateField, block.primary, block.secondary].filter(
        (x): x is string => typeof x === "string",
      );
    case "comparison":
      return [
        block.field,
        block.primary,
        block.secondary,
        ...block.leftFilters.map((f) => f.field),
        ...block.rightFilters.map((f) => f.field),
      ].filter((x): x is string => typeof x === "string");
    case "countdown":
      return [block.dateField, block.primary].filter(
        (x): x is string => typeof x === "string",
      );
    case "digest":
      return [block.groupBy, block.dateField, block.primary].filter(
        (x): x is string => typeof x === "string",
      );
    case "smallMultiples":
      return [block.groupBy, block.field].filter(
        (x): x is string => typeof x === "string",
      );
    case "entity":
      return [block.groupBy, block.field, block.dateField].filter(
        (x): x is string => typeof x === "string",
      );
  }
}

export function validateAndPrune(raw: unknown): {
  spec: ViewSpec | null;
  droppedBlocks: number;
} {
  const envelope = ViewSpecEnvelopeSchema.safeParse(raw);
  if (!envelope.success) return { spec: null, droppedBlocks: 0 };

  const seenTypes = new Set<string>();
  const kept: Block[] = [];
  let dropped = 0;

  for (const candidate of envelope.data.blocks) {
    const block = BlockSchema.safeParse(candidate);
    if (!block.success) {
      dropped += 1;
      continue;
    }
    const b = block.data;

    const fields = [
      ...referencedFields(b),
      ...(b.filters?.map((f) => f.field) ?? []),
    ];
    if (!fields.every((f) => ALLOWED_FIELDS.has(f) || f === "id")) {
      dropped += 1;
      continue;
    }

    // Visual variety is the demo. Two blocks of one type reads as lazy output,
    // so keep only the first of each type even if the model repeats itself.
    if (seenTypes.has(b.type)) {
      dropped += 1;
      continue;
    }
    // A row whose primary is a one-word label ("high", "deadline") is unreadable.
    // Promote it to the first readable field not already in use.
    if ("primary" in b && typeof b.primary === "string" && LABEL_ONLY_FIELDS.has(b.primary)) {
      const taken = new Set(
        [
          "secondary" in b ? (b.secondary as string | undefined) : undefined,
        ].filter(Boolean) as string[],
      );
      const swap = READABLE_FIELDS.find((f) => !taken.has(f)) ?? "subject";
      console.warn(`[spec] primary "${b.primary}" is a label; using "${swap}"`);
      (b as { primary: string }).primary = swap;
    }
    if (
      "secondary" in b &&
      typeof b.secondary === "string" &&
      LABEL_ONLY_FIELDS.has(b.secondary)
    ) {
      const primary = "primary" in b ? (b.primary as string | undefined) : undefined;
      const swap = READABLE_FIELDS.find((f) => f !== primary);
      console.warn(`[spec] secondary "${b.secondary}" is a label; using "${swap}"`);
      (b as { secondary?: string }).secondary = swap;
    }

    // A badge renders as a small pill. The model sometimes picks a prose field
    // (riskReason, summary) which overflows the card grid off-screen. Strip the
    // badge rather than dropping an otherwise-good block.
    if (b.type === "cards" && b.badge && !BADGE_SAFE_FIELDS.has(b.badge)) {
      console.warn(`[view] stripped prose badge "${b.badge}" from cards block`);
      kept.push({ ...b, badge: undefined });
      seenTypes.add(b.type);
      continue;
    }

    seenTypes.add(b.type);
    // `limit` is no longer offered to the model (see llm/schema.ts), but a spec
    // cached before that change may still carry one. Strip it so pagination —
    // a display concern — stays owned by the components.
    kept.push("limit" in b ? ({ ...b, limit: undefined } as Block) : b);
  }

  if (kept.length === 0) return { spec: null, droppedBlocks: dropped };
  return {
    spec: { ...envelope.data, blocks: kept },
    droppedBlocks: dropped,
  };
}

function isMoneyBlock(b: Block): boolean {
  if (b.type === "stat") return b.field === "amount";
  if (b.type === "bar") return (b.field ?? "amount") === "amount";
  return false;
}

function mentionsSecurity(intent: string): boolean {
  return /scam|phish|fraud|suspicious|security|threat|danger/i.test(intent);
}

const UPCOMING_RE =
  /\b(upcoming|due|deadline|coming up|this week|next week|soon|ahead|about to|screwed|charge)\b/i;
const PAST_RE = /\b(missed|overdue|late|already|past|expired|did i miss|forgot)\b/i;

/**
 * Forces a date window on date-driven blocks when the intent is clearly about
 * the future.
 *
 * The prompt asks the model to filter {deadlineDate, gte, "now"} for upcoming
 * intents, but it complies inconsistently — it often returns {ne, null}
 * ("has any deadline") instead. With 27 of 36 deadlines already past, that
 * renders a screen of items up to 176 days overdue for a question about what
 * is due. A prompt rule was not enough; this makes it deterministic.
 *
 * Skipped entirely when the intent is about what was MISSED, and never
 * overrides a date bound the model set itself.
 */
export function forceTimeWindow(spec: ViewSpec, intent: string): ViewSpec {
  if (!UPCOMING_RE.test(intent) || PAST_RE.test(intent)) return spec;

  let patched = 0;
  const blocks = spec.blocks.map((b) => {
    const dateField =
      "dateField" in b && typeof b.dateField === "string" ? b.dateField : null;
    if (!dateField) return b;

    const filters = b.filters ?? [];
    // Respect any bound the model already placed on this field.
    const bounded = filters.some(
      (f) =>
        f.field === dateField &&
        (f.op === "gte" || f.op === "gt" || f.op === "lt" || f.op === "lte"),
    );
    if (bounded) return b;

    patched += 1;
    return {
      ...b,
      filters: [
        ...filters.filter((f) => !(f.field === dateField && f.op === "ne")),
        { field: dateField, op: "gte" as const, value: "now" },
      ],
    };
  });

  if (patched > 0) {
    console.warn(`[spec] forced an upcoming window on ${patched} block(s)`);
  }
  return { ...spec, blocks };
}

export function excludeSuspiciousFromMoney(spec: ViewSpec, intent: string): ViewSpec {
  if (mentionsSecurity(intent)) return spec;

  let patched = 0;
  const blocks = spec.blocks.map((b) => {
    if (!isMoneyBlock(b)) return b;
    const filters = b.filters ?? [];
    if (filters.some((f) => f.field === "isSuspicious")) return b;
    patched += 1;
    return {
      ...b,
      filters: [
        ...filters,
        { field: "isSuspicious", op: "eq" as const, value: false },
      ],
    };
  });

  if (patched > 0) {
    console.warn(
      `[view] excluded suspicious rows from ${patched} money block(s)`,
    );
  }
  return { ...spec, blocks };
}
