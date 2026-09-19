import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getProvider } from "@/lib/llm";
import { buildFallbackSpec } from "@/lib/fallback";
import { CATALOG, SCHEMA_DIGEST, SCHEMA_VERSION } from "@/lib/catalog";
import {
  excludeSuspiciousFromMoney,
  forceTimeWindow,
  validateAndPrune,
} from "@/lib/specPipeline";
import {
  ViewSpecSchema,
  type ViewSpec,
  type ViewSource,
} from "@/lib/viewspec";

const BodySchema = z.object({
  intent: z.string().min(1).max(300),
});

/** Field names a block references, by block type. */

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

/**
 * Money demanded by a phishing email is not money the user spent, so it must
 * never land in a spending total. The prompt asks the model to filter it out;
 * this makes it true.
 *
 * Applies to blocks that aggregate or display `amount`, unless the intent is
 * itself about scams/security (where showing the fake figure is the point) or
 * the model already constrained isSuspicious deliberately.
 */

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
        spec: forceTimeWindow(excludeSuspiciousFromMoney(reparsed.data, intent), intent),
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
  let failureKind: "provider" | "invalid" | null = null;

  try {
    const result = await provider.generateViewSpec({
      intent,
      schemaDigest: SCHEMA_DIGEST,
      catalog: CATALOG,
    });
    latencyMs = result.latencyMs;
    raw = result.raw;

    const { spec: validated, droppedBlocks } = validateAndPrune(result.spec);
    if (!validated) failureKind = "invalid";
    if (validated) {
      spec = forceTimeWindow(excludeSuspiciousFromMoney(validated, intent), intent);
      if (droppedBlocks > 0) {
        console.warn(
          `[view] dropped ${droppedBlocks} malformed block(s); kept ${validated.blocks.length}`,
        );
      }
    }
  } catch (err) {
    failureKind = "provider";
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
    ...(failureKind ? { failureKind } : {}),
    ...(process.env.NODE_ENV !== "production" && raw ? { raw } : {}),
  });
}
