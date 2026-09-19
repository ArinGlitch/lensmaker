import type { Agg, Item } from "@/lib/viewspec";

function nums(items: Item[], field: string): number[] {
  return items
    .map((i) => (i as unknown as Record<string, unknown>)[field])
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
}

export function aggregate(items: Item[], agg: Agg, field: string): number | null {
  if (agg === "count") return items.length;
  const vals = nums(items, field);
  if (!vals.length) return null;
  switch (agg) {
    case "sum":
      return vals.reduce((a, b) => a + b, 0);
    case "avg":
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    case "min":
      return Math.min(...vals);
    case "max":
      return Math.max(...vals);
  }
}

export interface GroupPoint {
  key: string;
  value: number;
}

export function groupAndAggregate(
  items: Item[],
  groupBy: string,
  agg: Agg,
  field?: string,
  limit = 12,
): GroupPoint[] {
  const buckets = new Map<string, Item[]>();
  for (const i of items) {
    const raw = (i as unknown as Record<string, unknown>)[groupBy];
    const key = raw == null ? "—" : String(raw);
    const arr = buckets.get(key);
    if (arr) arr.push(i);
    else buckets.set(key, [i]);
  }
  return [...buckets.entries()]
    .map(([key, rows]) => ({
      key,
      value: aggregate(rows, agg, field ?? "amount") ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}
