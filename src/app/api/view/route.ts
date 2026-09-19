import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getProvider } from "@/lib/llm";
import { buildFallbackSpec } from "@/lib/fallback";
import { ALLOWED_FIELDS, CATALOG, SCHEMA_DIGEST, SCHEMA_VERSION } from "@/lib/catalog";
import { ViewSpecSchema, type Block, type ViewSpec, type ViewSource } from "@/lib/viewspec";

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
 * Drops blocks naming fields outside the allowlist. `id` is permitted because
 * count-style stats legitimately aggregate over it.
 */
function pruneBlocks(spec: ViewSpec): ViewSpec {
  const seenTypes = new Set<string>();
  const kept = spec.blocks.filter((b) => {
    const fields = [
      ...referencedFields(b),
      ...(b.filters?.map((f) => f.field) ?? []),
    ];
    if (!fields.every((f) => ALLOWED_FIELDS.has(f) || f === "id")) return false;

    // Visual variety is the demo. Two blocks of one type reads as lazy output,
    // so keep only the first of each type even if the model repeats itself.
    if (seenTypes.has(b.type)) return false;
    seenTypes.add(b.type);
    return true;
  });
  return { ...spec, blocks: kept };
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
        spec: reparsed.data,
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

    const validated = ViewSpecSchema.safeParse(result.spec);
    if (validated.success) {
      const pruned = pruneBlocks(validated.data);
      if (pruned.blocks.length > 0) {
        spec = pruned;
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
