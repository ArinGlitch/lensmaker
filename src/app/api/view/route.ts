import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getProvider } from "@/lib/llm";
import { buildFallbackSpec } from "@/lib/fallback";
import {
  ALLOWED_FIELDS,
  BADGE_SAFE_FIELDS,
  CATALOG,
  SCHEMA_DIGEST,
  SCHEMA_VERSION,
} from "@/lib/catalog";
import {
  BlockSchema,
  ViewSpecEnvelopeSchema,
  ViewSpecSchema,
  type Block,
  type ViewSpec,
  type ViewSource,
} from "@/lib/viewspec";

const BodySchema = z.object({
  intent: z.string().min(1).max(300),
});

/** Field names a block references, by block type. */
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
  }
}

/**
 * Validates the envelope and each block SEPARATELY.
 *
 * Parsing the whole ViewSpec at once meant a single malformed block (e.g. a
 * stat missing `agg`) failed the entire object, threw away the good blocks
 * alongside it, and served the fallback — so every intent produced the same
 * screen. plan.md §4 rule 2 always prescribed per-block pruning for unknown
 * field names; this applies it to shape errors too.
 *
 * Returns null only when nothing survives, which is the one case that should
 * reach the fallback.
 */
function validateAndPrune(raw: unknown): {
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
    kept.push(b);
  }

  if (kept.length === 0) return { spec: null, droppedBlocks: dropped };
  return {
    spec: { ...envelope.data, blocks: kept },
    droppedBlocks: dropped,
  };
}

/**
 * Money demanded by a phishing email is not money the user spent, so it must
 * never land in a spending total. The prompt asks the model to filter it out;
 * this makes it true.
 *
 * Applies to blocks that aggregate or display `amount`, unless the intent is
 * itself about scams/security (where showing the fake figure is the point) or
 * the model already constrained isSuspicious deliberately.
 */
function isMoneyBlock(b: Block): boolean {
  if (b.type === "stat") return b.field === "amount";
  if (b.type === "bar") return (b.field ?? "amount") === "amount";
  return false;
}

function mentionsSecurity(intent: string): boolean {
  return /scam|phish|fraud|suspicious|security|threat|danger/i.test(intent);
}

function excludeSuspiciousFromMoney(spec: ViewSpec, intent: string): ViewSpec {
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

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "intent is required" }, { status: 400 });
  }

  const intent = parsed.data.intent.trim();
  const provider = getProvider();
  const key = createHash("sha256")
    .update(`${intent}|${provider.name}|${SCHEMA_VERSION}`)
    .digest("hex");

  // 1. Cache — a warm cache means the demo costs zero tokens.
  const cached = await prisma.viewSpecCache.findUnique({ where: { key } });
  if (cached) {
    const reparsed = ViewSpecSchema.safeParse(cached.spec);
    if (reparsed.success) {
      return Response.json({
        // Re-applied on read: specs cached before this guard existed would
        // otherwise still show scam amounts in spending totals.
        spec: excludeSuspiciousFromMoney(reparsed.data, intent),
        source: "cache" satisfies ViewSource,
        provider: provider.name,
        latencyMs: 0,
      });
    }
  }

  // 2. Model call. Any failure degrades to the fallback rather than a 500.
  let spec: ViewSpec | null = null;
  let source: ViewSource = "model";
  let latencyMs = 0;
  let raw = "";

  try {
    const result = await provider.generateViewSpec({
      intent,
      schemaDigest: SCHEMA_DIGEST,
      catalog: CATALOG,
    });
    latencyMs = result.latencyMs;
    raw = result.raw;

    const { spec: validated, droppedBlocks } = validateAndPrune(result.spec);
    if (validated) {
      spec = excludeSuspiciousFromMoney(validated, intent);
      if (droppedBlocks > 0) {
        console.warn(
          `[view] dropped ${droppedBlocks} malformed block(s); kept ${validated.blocks.length}`,
        );
      }
    }
  } catch (err) {
    console.error("[view] provider error", err);
  }

  if (!spec) {
    spec = buildFallbackSpec(intent);
    source = "fallback";
  }

  // 3. Cache only real model output; fallbacks should be retried later.
  if (source === "model") {
    await prisma.viewSpecCache
      .create({
        data: { key, intent, provider: provider.name, spec },
      })
      .catch(() => undefined);
  }

  console.log(
    `[view] provider=${provider.name} source=${source} latency=${latencyMs}ms blocks=${spec.blocks.length}`,
  );

  return Response.json({
    spec,
    source,
    provider: provider.name,
    latencyMs,
    ...(process.env.NODE_ENV !== "production" && raw ? { raw } : {}),
  });
}
