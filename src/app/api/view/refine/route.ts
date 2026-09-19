import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getProvider } from "@/lib/llm";
import { CATALOG, SCHEMA_DIGEST, SCHEMA_VERSION } from "@/lib/catalog";
import {
  excludeSuspiciousFromMoney,
  validateAndPrune,
} from "@/lib/specPipeline";
import {
  ViewSpecSchema,
  type ViewSource,
  type ViewSpec,
} from "@/lib/viewspec";

/**
 * Incremental refinement of the spec already on screen.
 *
 * Runs the SAME validate -> prune -> money-guard pipeline as a fresh
 * generation (see lib/specPipeline.ts), so an adjustment cannot smuggle past a
 * rule a generation would have caught.
 *
 * Failure semantics differ from /api/view in one important way: if the model
 * cannot produce a usable adjustment we return the CALLER'S ORIGINAL SPEC
 * rather than the generic fallback. Losing the screen you had built up because
 * one tweak failed would be far worse than the tweak silently not applying.
 */
const BodySchema = z.object({
  instruction: z.string().min(1).max(300),
  intent: z.string().min(1).max(300),
  spec: z.unknown(),
});

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
    return Response.json(
      { error: "instruction, intent and spec are required" },
      { status: 400 },
    );
  }

  const base = ViewSpecSchema.safeParse(parsed.data.spec);
  if (!base.success) {
    return Response.json(
      { error: "spec is not a valid ViewSpec" },
      { status: 400 },
    );
  }

  const instruction = parsed.data.instruction.trim();
  const intent = parsed.data.intent.trim();
  const provider = getProvider();

  // Cache on the base spec + the instruction, so repeating a refinement during
  // a rehearsal costs nothing.
  const key = createHash("sha256")
    .update(
      `refine|${JSON.stringify(base.data)}|${instruction}|${provider.name}|${SCHEMA_VERSION}`,
    )
    .digest("hex");

  const cached = await prisma.viewSpecCache.findUnique({ where: { key } });
  if (cached) {
    const reparsed = ViewSpecSchema.safeParse(cached.spec);
    if (reparsed.success) {
      return Response.json({
        spec: excludeSuspiciousFromMoney(reparsed.data, intent),
        source: "cache" satisfies ViewSource,
        provider: provider.name,
        latencyMs: 0,
      });
    }
  }

  let spec: ViewSpec | null = null;
  let source: ViewSource = "model";
  let latencyMs = 0;
  let raw = "";
  let failureKind: "provider" | "invalid" | null = null;

  try {
    const result = await provider.refineViewSpec({
      base: base.data,
      instruction,
      schemaDigest: SCHEMA_DIGEST,
      catalog: CATALOG,
    });
    latencyMs = result.latencyMs;
    raw = result.raw;

    const { spec: validated, droppedBlocks } = validateAndPrune(result.spec);
    if (!validated) failureKind = "invalid";
    if (validated) {
      spec = excludeSuspiciousFromMoney(validated, intent);
      if (droppedBlocks > 0) {
        console.warn(
          `[refine] dropped ${droppedBlocks} malformed block(s); kept ${validated.blocks.length}`,
        );
      }
    }
  } catch (err) {
    failureKind = "provider";
    console.error("[refine] provider error", err);
  }

  // Keep what the user had rather than collapsing to the generic fallback.
  if (!spec) {
    spec = base.data;
    source = "fallback";
  } else if (source === "model") {
    await prisma.viewSpecCache
      .create({
        data: { key, intent: `${intent} :: ${instruction}`, provider: provider.name, spec },
      })
      .catch(() => undefined);
  }

  console.log(
    `[refine] provider=${provider.name} source=${source} latency=${latencyMs}ms blocks=${spec.blocks.length}`,
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
