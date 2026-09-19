import type { Filter } from "@/lib/viewspec";
import { ALLOWED_FIELDS, SCHEMA_DIGEST } from "@/lib/catalog";

const TYPE_OF = new Map(SCHEMA_DIGEST.map((f) => [f.name, f.type]));

export class DisallowedFieldError extends Error {
  constructor(field: string) {
    super(`Field not in allowlist: ${field}`);
  }
}

function coerce(field: string, value: unknown): unknown {
  const t = TYPE_OF.get(field);
  if (t === "date" && typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d;
  }
  if (t === "number" && typeof value === "string") {
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  }
  return value;
}

/**
 * Compiles the model's restricted filter DSL into a Prisma `where` object.
 * The model NEVER emits SQL or Prisma syntax — only {field, op, value}.
 * Throws DisallowedFieldError so the caller can drop the offending block.
 */
export function compileFilters(filters?: Filter[]): Record<string, unknown> {
  if (!filters?.length) return {};
  const where: Record<string, unknown> = {};

  for (const f of filters) {
    if (!ALLOWED_FIELDS.has(f.field)) throw new DisallowedFieldError(f.field);
    const v = coerce(f.field, f.value);

    switch (f.op) {
      case "eq":
        where[f.field] = v;
        break;
      case "ne":
        where[f.field] = { not: v };
        break;
      case "lt":
        where[f.field] = { lt: v };
        break;
      case "lte":
        where[f.field] = { lte: v };
        break;
      case "gt":
        where[f.field] = { gt: v };
        break;
      case "gte":
        where[f.field] = { gte: v };
        break;
      case "contains":
        where[f.field] = { contains: String(v), mode: "insensitive" };
        break;
      case "in":
        where[f.field] = { in: Array.isArray(v) ? v : [v] };
        break;
    }
  }
  return where;
}
