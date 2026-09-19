/**
 * Incremental refinement: change an existing dashboard instead of rebuilding it.
 *
 * DESIGN
 * The model is given the CURRENT ViewSpec plus a short instruction ("drop the
 * chart", "add a countdown", "only show subscriptions") and returns a COMPLETE
 * replacement spec. It does not return a patch or a diff.
 *
 * Why a whole spec rather than a patch:
 *  - it reuses the exact same validation, pruning and money-guard path as a
 *    fresh generation, so a refinement can never bypass a safety rule;
 *  - block ids stay stable because the model is told to preserve them, which is
 *    what lets the UI animate rather than flash;
 *  - a patch language would be a second contract to keep in sync with the
 *    first, and the riskReason/notes bugs came from exactly that kind of drift.
 *
 * The cost is one extra call per refinement, which is acceptable: refinements
 * are cached by (baseSpec + instruction) like any other view.
 */
import type { CatalogEntry, FieldInfo } from "@/lib/catalog";
import type { ViewSpec } from "@/lib/viewspec";

export interface RefineInput {
  /** The spec currently on screen. */
  base: ViewSpec;
  /** What the user asked to change, in their words. */
  instruction: string;
  schemaDigest: FieldInfo[];
  catalog: CatalogEntry[];
}

export function buildRefinePrompt(input: RefineInput): string {
  const fields = input.schemaDigest
    .map((f) => `${f.name}:${f.type} (${f.note})`)
    .join("\n");
  const blocks = input.catalog
    .map((c) => `${c.type} — ${c.use} props: ${c.props}`)
    .join("\n");

  return `You are ADJUSTING a dashboard that is already on screen. Return the COMPLETE updated ViewSpec JSON — not a patch, not a diff, not an explanation.

CURRENT SPEC
${JSON.stringify(input.base, null, 1)}

THE USER'S ADJUSTMENT
${JSON.stringify(input.instruction)}

AVAILABLE FIELDS (you may ONLY reference these names):
${fields}

BLOCK CATALOG (you may ONLY use these types):
${blocks}

RULES
- Make the SMALLEST change that satisfies the adjustment. Everything the user did not mention must survive untouched.
- KEEP THE EXISTING "id" of every block you retain, byte for byte. Only a genuinely new block gets a new id.
- Removing: drop the block they named. Adding: append a block of a DIFFERENT type to the ones already present. Never end up with two blocks of the same type.
- Narrowing ("only subscriptions", "just this month"): add filters to the existing blocks rather than replacing them.
- Keep 1 to 5 blocks. If the adjustment would empty the spec, keep the single most relevant block instead.
- filters use only {field, op, value} with op in eq|ne|lt|lte|gt|gte|contains|in. The value "now" means this moment.
- Update "title" only if the adjustment changed what the screen is about.
- Set intent_echo to describe the ADJUSTED screen.
- If the adjustment is impossible with these fields, return the spec UNCHANGED with insufficient_evidence=true and explain why in notes.

Return the updated ViewSpec JSON now.`;
}
