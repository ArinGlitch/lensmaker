import type { ViewSpec } from "@/lib/viewspec";

/**
 * Deterministic spec used when the model fails, returns garbage, or every block
 * is pruned. Guarantees /api/view always returns something renderable.
 */
export function buildFallbackSpec(intent: string): ViewSpec {
  return {
    title: "Everything, most recent first",
    intent_echo: intent.slice(0, 200),
    blocks: [
      {
        id: "fb-stat",
        type: "stat",
        label: "Items",
        agg: "count",
        field: "id",
        emphasis: "normal",
      },
      {
        id: "fb-cards",
        type: "cards",
        primary: "vendor",
        secondary: "summary",
        badge: "urgency",
        sortBy: "receivedAt",
        dir: "desc",
        limit: 9,
      },
    ],
    confidence: "low",
    insufficient_evidence: false,
    notes: "Fallback layout — the model did not return a usable spec.",
  };
}
