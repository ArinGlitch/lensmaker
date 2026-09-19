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
            enum: ["stat", "cards", "bar", "timeline", "list", "table", "callout"],
          },
          title: { type: "string" },
          filters,
          // stat
          label: { type: "string" },
          agg: { type: "string", enum: AGG },
          field: { type: "string" },
          format: { type: "string", enum: FORMAT },
          emphasis: { type: "string", enum: ["low", "normal", "high"] },
          // cards / list / timeline
          primary: { type: "string" },
          secondary: { type: "string" },
          badge: { type: "string" },
          sortBy: { type: "string" },
          dir: { type: "string", enum: DIR },
          limit: { type: "integer" },
          // bar
          groupBy: { type: "string" },
          // timeline
          dateField: { type: "string" },
          // table
          columns: { type: "array", items: { type: "string" } },
          // callout
          tone: { type: "string", enum: ["info", "warn", "danger"] },
          message: { type: "string" },
        },
        required: ["id", "type"],
      },
    },
  },
  required: ["title", "intent_echo", "blocks", "confidence", "insufficient_evidence"],
} as const;
