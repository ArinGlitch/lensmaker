"use client";

import type { SavedViewSummary } from "@/lib/viewspec";
import { formatDays } from "@/components/blockData";

/** Relative age of a saved view, e.g. "3 days ago". */
function relativeTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const minutes = Math.round((ms - Date.now()) / 60_000);
  if (Math.abs(minutes) < 1) return "just now";
  if (Math.abs(minutes) < 60)
    return minutes < 0 ? `${-minutes}m ago` : `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return hours < 0 ? `${-hours}h ago` : `in ${hours}h`;
  return formatDays(Math.round(hours / 24));
}

/**
 * A gallery of screens the model built earlier. Loading one costs no tokens —
 * the spec is already JSON, so replaying it is free.
 */
export default function SavedViews({
  views,
  onLoad,
  onDelete,
}: {
  views: SavedViewSummary[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (views.length === 0) return null;

  return (
    <section className="border-t border-white/10 pt-6">
      <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Saved views
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {views.map((view) => (
          <article
            key={view.id}
            className="flex flex-col rounded-xl border border-white/10 bg-[#1a1a19] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-semibold text-white">
                {view.spec?.title ?? view.intent}
              </p>
              <button
                type="button"
                onClick={() => onDelete(view.id)}
                aria-label={`Delete saved view ${view.spec?.title ?? view.intent}`}
                className="shrink-0 rounded px-1.5 text-xs text-neutral-600 hover:text-[#d03b3b]"
              >
                ✕
              </button>
            </div>

            <p className="mt-1 truncate text-xs text-neutral-500" title={view.intent}>
              “{view.intent}”
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {(view.spec?.blocks ?? []).map((block) => (
                <span
                  key={block.id}
                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400"
                >
                  {block.type}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="text-[11px] text-neutral-600">
                {relativeTime(view.createdAt)}
              </span>
              <button
                type="button"
                onClick={() => onLoad(view.id)}
                className="rounded border border-white/15 px-2.5 py-1 text-xs text-neutral-300 hover:border-white/30 hover:text-white"
              >
                Load
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
