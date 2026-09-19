"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BarBlock, Item } from "@/lib/viewspec";
import { groupAndAggregate } from "@/lib/aggregate";
import { applyFilters, fieldLabel, formatValue } from "@/components/blockData";
import { BLOCK_TITLE, VIZ } from "@/components/theme";

/**
 * Horizontal bars, ranked. Horizontal because category labels read straight
 * across at 6+ categories instead of being rotated or truncated.
 *
 * One series, so there is no legend — the title names what is being measured.
 */
export default function BarBlockView({
  block,
  items,
}: {
  block: BarBlock;
  items: Item[];
}) {
  const rows = applyFilters(items, block.filters);
  const points = groupAndAggregate(
    rows,
    block.groupBy,
    block.agg,
    block.field,
    block.limit ?? 8,
  );

  const heading =
    block.title ??
    `${fieldLabel(block.groupBy)} by ${block.agg}${
      block.field ? ` of ${fieldLabel(block.field)}` : ""
    }`;

  const chartHeight = Math.max(160, points.length * 40 + 36);
  const fmt = (value: unknown) =>
    formatValue(typeof value === "number" ? value : null, block.format);

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
      <h3 className={BLOCK_TITLE}>{heading}</h3>
      <p className="mt-0.5 text-[11px] text-[var(--ink-4)]">
        {block.agg}
        {block.field ? ` of ${block.field}` : ""} across {points.length}{" "}
        {points.length === 1 ? "group" : "groups"}
      </p>

      {points.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-[var(--line-strong)] px-5 py-10 text-center text-sm text-[var(--ink-3)]">
          Nothing to chart for this block.
        </p>
      ) : (
        <div className="mt-4" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={points}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
              barCategoryGap="28%"
            >
              <CartesianGrid
                horizontal={false}
                stroke={VIZ.grid}
                strokeWidth={1}
              />
              <XAxis
                type="number"
                tickFormatter={fmt}
                tick={{ fill: VIZ.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="key"
                width={118}
                tick={{ fill: VIZ.inkSecondary, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: unknown) => {
                  const s = String(value);
                  return s.length > 14 ? `${s.slice(0, 13)}…` : s;
                }}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                formatter={fmt}
                contentStyle={{
                  background: "#17171b",
                  border: `1px solid ${VIZ.axis}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: VIZ.ink, fontWeight: 600 }}
                itemStyle={{ color: VIZ.inkSecondary }}
              />
              <Bar
                dataKey="value"
                name={block.field ?? block.agg}
                fill={VIZ.series1}
                barSize={18}
                radius={[0, 4, 4, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
