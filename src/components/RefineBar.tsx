"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Adjust the screen that is already on display, instead of rebuilding it.
 *
 * DESIGN INTENT
 * The intent bar stays the single hero input — this is deliberately secondary:
 * a quiet "Adjust" link that expands into one line, and collapses again after
 * it runs. No dropdowns, no block pickers, no per-block controls; you still
 * only ever type, which is the whole premise of the app.
 *
 * It only exists once a view is on screen, because "add a chart" is meaningless
 * with nothing to add it to.
 */
const SUGGESTIONS = [
  "add a chart",
  "drop the chart",
  "only subscriptions",
  "add a countdown",
];

export default function RefineBar({
  onRefine,
  isLoading,
  disabled,
}: {
  onRefine: (instruction: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function submit(instruction: string) {
    const trimmed = instruction.trim();
    if (!trimmed || isLoading) return;
    onRefine(trimmed);
    setValue("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded border border-[var(--line-strong)] px-3 py-1.5 text-xs text-[var(--ink-2)] transition-colors hover:bg-white/5 disabled:opacity-40"
      >
        Adjust this view
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="group flex items-center gap-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--panel)] px-3"
      >
        <span className="font-mono text-sm text-[var(--accent)]" aria-hidden>
          ~
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setValue("");
            }
          }}
          placeholder="Change this screen — add, remove, or narrow…"
          aria-label="Adjust this view"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-4)]"
        />
        <button
          type="submit"
          disabled={isLoading || !value.trim()}
          className="shrink-0 rounded bg-white px-3 py-1 text-xs font-medium text-black disabled:opacity-40"
        >
          {isLoading ? "Adjusting…" : "Apply"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setValue("");
          }}
          className="shrink-0 rounded px-2 py-1 text-xs text-[var(--ink-3)] hover:bg-white/5"
        >
          Esc
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => submit(s)}
            disabled={isLoading}
            className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--ink-3)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--ink-2)] disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
