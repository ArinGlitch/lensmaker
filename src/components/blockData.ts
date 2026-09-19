/**
 * Pure presentation helpers shared by the block components. Owned by Dev B.
 *
 * No fetching, no Prisma, no LLM. Blocks receive the full `Item[]` and the
 * model's block config; everything here turns that pair into display values.
 *
 * `applyFilters` mirrors the filter DSL in `lib/filters.ts` on the client, so a
 * block that says "only suspicious rows" actually shows only suspicious rows.
 */
import { SCHEMA_DIGEST } from "@/lib/catalog";
import type { Dir, Filter, Format, Item } from "@/lib/viewspec";

const FIELD_TYPE = new Map(SCHEMA_DIGEST.map((f) => [f.name, f.type]));

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T|$)/;

function asRecord(item: Item): Record<string, unknown> {
  return item as unknown as Record<string, unknown>;
}

export function fieldValue(item: Item, field: string): unknown {
  return asRecord(item)[field];
}

export function isDateField(field: string): boolean {
  return FIELD_TYPE.get(field) === "date";
}

/* --------------------------------- sorting -------------------------------- */

/** Sortable projection: dates and booleans become numbers, strings lowercase. */
function comparable(value: unknown): number | string | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    if (ISO_DATE.test(value)) {
      const ms = Date.parse(value);
      return Number.isNaN(ms) ? value.toLowerCase() : ms;
    }
    return value.toLowerCase();
  }
  return String(value).toLowerCase();
}

/** Nulls always sink to the bottom, whichever direction is asked for. */
export function sortItems(items: Item[], sortBy?: string, dir: Dir = "asc"): Item[] {
  if (!sortBy) return items;
  const sign = dir === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    const av = comparable(fieldValue(a, sortBy));
    const bv = comparable(fieldValue(b, sortBy));
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
    return String(av).localeCompare(String(bv)) * sign;
  });
}

export function limitItems(items: Item[], limit?: number): Item[] {
  return typeof limit === "number" && limit > 0 ? items.slice(0, limit) : items;
}

/* -------------------------------- filtering ------------------------------- */

function numeric(value: unknown): number | null {
  const c = comparable(value);
  return typeof c === "number" ? c : null;
}

function looseEqual(value: unknown, target: unknown): boolean {
  // `null` is a meaningful filter value: {op:"ne", value:null} is how the model
  // says "this field is set", which it reaches for on deadlineDate constantly.
  if (target === null) return value == null;
  if (value == null) return false;
  if (typeof value === "boolean") {
    if (typeof target === "boolean") return value === target;
    return value === (target === "true" || target === 1);
  }
  if (typeof value === "number" || ISO_DATE.test(String(value))) {
    const a = numeric(value);
    const b = numeric(target);
    if (a !== null && b !== null) return a === b;
  }
  return String(value).toLowerCase() === String(target).toLowerCase();
}

function matches(value: unknown, filter: Filter): boolean {
  switch (filter.op) {
    case "eq":
      return looseEqual(value, filter.value);
    case "ne":
      return !looseEqual(value, filter.value);
    case "contains":
      return (
        value != null &&
        String(value).toLowerCase().includes(String(filter.value).toLowerCase())
      );
    case "in": {
      const list = Array.isArray(filter.value) ? filter.value : [filter.value];
      return list.some((candidate) => looseEqual(value, candidate));
    }
    case "lt":
    case "lte":
    case "gt":
    case "gte": {
      const a = numeric(value);
      const b = numeric(filter.value);
      if (a === null || b === null) return false;
      if (filter.op === "lt") return a < b;
      if (filter.op === "lte") return a <= b;
      if (filter.op === "gt") return a > b;
      return a >= b;
    }
    default:
      return true;
  }
}

/**
 * Client-side mirror of the server filter DSL. A block only ever narrows the
 * rows it was handed — it can never reach for data it wasn't given.
 */
export function applyFilters(items: Item[], filters?: Filter[]): Item[] {
  if (!filters?.length) return items;
  return items.filter((item) =>
    filters.every((f) => matches(fieldValue(item, f.field), f)),
  );
}

/** filters → sort → limit, the order every block wants. */
export function prepareRows(
  items: Item[],
  opts: { filters?: Filter[]; sortBy?: string; dir?: Dir; limit?: number },
): Item[] {
  return limitItems(
    sortItems(applyFilters(items, opts.filters), opts.sortBy, opts.dir ?? "asc"),
    opts.limit,
  );
}

/* -------------------------------- formatting ------------------------------ */

const DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatMoney(value: number, currency = "CAD"): string {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatPlainNumber(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

export function formatDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

/** Formats an aggregate result. `null` (no data) renders as an em dash. */
export function formatValue(value: number | null, format?: Format): string {
  if (value === null || Number.isNaN(value)) return "—";
  switch (format) {
    case "currency":
      return formatMoney(value);
    case "percent": {
      const pct = Math.abs(value) <= 1 ? value * 100 : value;
      return `${formatPlainNumber(pct)}%`;
    }
    case "date":
      return DATE_FMT.format(new Date(value));
    case "relativeDays":
      return formatDays(Math.round(value));
    case "text":
      return String(value);
    default:
      return formatPlainNumber(value);
  }
}

/**
 * Formats a single field of a single row for display. The model does not send a
 * format for `secondary`/`badge`/`columns`, so we infer one from the field type.
 */
export function formatCell(item: Item, field: string): string {
  const value = fieldValue(item, field);
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return field === "amount" ? formatMoney(value, item.currency) : formatPlainNumber(value);
  }
  if (typeof value === "string" && (isDateField(field) || ISO_DATE.test(value))) {
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) return DATE_FMT.format(new Date(ms));
  }
  return String(value);
}

/** Whole days from today to `iso`. Negative = overdue. */
export function daysUntil(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const target = new Date(ms);
  const today = new Date();
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / 86_400_000);
}

/** Human label for a field name, used as a table/card column heading. */
export function fieldLabel(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
