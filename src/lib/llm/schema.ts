/**
 * JSON Schema mirroring the Zod ViewSpec contract. Used by Gemini's native
 * responseSchema (structured output) and by Haiku's tool-input schema.
 * Keep in sync with src/lib/viewspec.ts.
 */
const AGG = ["sum", "count", "avg", "min", "max"];
const FORMAT = ["currency", "number", "percent", "date", "relativeDays", "text"];
const DIR = ["asc", "desc"];
const OPS = ["eq", "ne", "lt", "lte", "gt", "gte", "contains", "in"];

const filters = {
  type: "array",
  items: {
    type: "object",
    properties: {
      field: { type: "string" },
      op: { type: "string", enum: OPS },
      value: {},
    },
    required: ["field", "op", "value"],
  },
};

export const VIEWSPEC_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    intent_echo: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    insufficient_evidence: { type: "boolean" },
    notes: { type: "string" },
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: [
              "stat",
              "cards",
              "bar",
              "timeline",
              "list",
              "table",
              "callout",
              "verdict",
              "calendar",
              "buckets",
              "comparison",
              "countdown",
              "digest",
              "smallMultiples",
              "entity",
            ],
          },
          title: { type: "string" },
          filters,
          // stat
          label: { type: "string" },
          agg: { type: "string", enum: AGG },
          field: { type: "string" },
          format: { type: "string", enum: FORMAT },
          emphasis: { type: "string", enum: ["low", "normal", "high"] },
          // NOTE: `limit` is deliberately absent. Pagination is a display
          // concern owned by the components; when the model was told about
          // limit it emitted values that failed validation and took the whole
          // spec down with them, so the entire dashboard failed to generate.
          // cards / list / timeline
          primary: { type: "string" },
          secondary: { type: "string" },
          badge: { type: "string" },
          sortBy: { type: "string" },
          dir: { type: "string", enum: DIR },
          // bar
          groupBy: { type: "string" },
          // timeline
          dateField: { type: "string" },
          // table
          columns: { type: "array", items: { type: "string" } },
          // callout
          tone: {
            type: "string",
            enum: ["info", "warn", "danger", "good", "warn", "neutral"],
          },
          message: { type: "string" },
          // verdict
          headline: { type: "string" },
          detail: { type: "string" },
          // buckets
          edges: { type: "array", items: { type: "integer" } },
          // calendar
          scale: { type: "string", enum: ["month", "week"] },
          // comparison
          leftLabel: { type: "string" },
          rightLabel: { type: "string" },
          leftFilters: filters,
          rightFilters: filters,
        },
        required: ["id", "type"],
      },
    },
  },
  required: ["title", "intent_echo", "blocks", "confidence", "insufficient_evidence"],
} as const;
