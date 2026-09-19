"use client";

import type { Item, ViewSpec } from "@/lib/viewspec";
import StatBlockView from "./blocks/StatBlock";
import CardsBlockView from "./blocks/CardsBlock";
import BarBlockView from "./blocks/BarBlock";
import TimelineBlockView from "./blocks/TimelineBlock";
import ListBlockView from "./blocks/ListBlock";
import TableBlockView from "./blocks/TableBlock";
import CalloutBlockView from "./blocks/CalloutBlock";
import VerdictBlockView from "./blocks/VerdictBlock";
import CalendarBlockView from "./blocks/CalendarBlock";
import BucketsBlockView from "./blocks/BucketsBlock";
import ComparisonBlockView from "./blocks/ComparisonBlock";
import CountdownBlockView from "./blocks/CountdownBlock";
import DigestBlockView from "./blocks/DigestBlock";
import EntityBlockView from "./blocks/EntityBlock";
import SmallMultiplesBlockView from "./blocks/SmallMultiplesBlock";

/**
 * The security boundary. An unknown block type renders nothing — the model
 * cannot introduce a component that was not hand-built.
 */
export default function Renderer({
  spec,
  items,
}: {
  spec: ViewSpec;
  items: Item[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {spec.blocks.map((block) => {
        switch (block.type) {
          case "stat":
            return <StatBlockView key={block.id} block={block} items={items} />;
          case "cards":
            return <CardsBlockView key={block.id} block={block} items={items} />;
          case "bar":
            return <BarBlockView key={block.id} block={block} items={items} />;
          case "timeline":
            return (
              <TimelineBlockView key={block.id} block={block} items={items} />
            );
          case "list":
            return <ListBlockView key={block.id} block={block} items={items} />;
          case "table":
            return <TableBlockView key={block.id} block={block} items={items} />;
          case "callout":
            return (
              <CalloutBlockView key={block.id} block={block} items={items} />
            );
          case "verdict":
            return <VerdictBlockView key={block.id} block={block} items={items} />;
          case "calendar":
            return <CalendarBlockView key={block.id} block={block} items={items} />;
          case "buckets":
            return <BucketsBlockView key={block.id} block={block} items={items} />;
          case "comparison":
            return (
              <ComparisonBlockView key={block.id} block={block} items={items} />
            );
          case "countdown":
            return <CountdownBlockView key={block.id} block={block} items={items} />;
          case "digest":
            return <DigestBlockView key={block.id} block={block} items={items} />;
          case "entity":
            return <EntityBlockView key={block.id} block={block} items={items} />;
          case "smallMultiples":
            return (
              <SmallMultiplesBlockView key={block.id} block={block} items={items} />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
