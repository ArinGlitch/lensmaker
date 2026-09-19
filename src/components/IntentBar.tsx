"use client";

import { useRef, useState } from "react";
import { DEMO_INTENTS } from "@/lib/intents";

/**
 * The only input in the app. There is no filter, no sort control and no column
 * picker anywhere — you restate what you care about and the screen is rebuilt.
 */
// Shared with scripts/warm-cache.ts so a chip can never drift out of the warm
// cache and trigger a live model call mid-demo.
const EXAMPLES = DEMO_INTENTS;

export default function IntentBar({
  onSubmit,
  isLoading,
}: {
  onSubmit: (intent: string) => void;
  isLoading: boolean;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  /** Compose the screen. Only ever called deliberately — button or Enter. */
  function submit(intent: string) {
    const trimmed = intent.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
    // The question stays in the bar, so you can always see what the screen is
    // answering. Left unselected: a chip fills the field and nothing more, so
    // there is no pending selection for a later keystroke to clobber.
    setValue(trimmed);
  }

  /**
   * A chip loads the question into the bar and stops there. It used to compose
   * on click, which took the decision away from you — now the chip is a
   * shortcut for typing, not for asking.
   */
  function loadExample(example: string) {
    setValue(example);
    inputRef.current?.focus();
    // caret to the end, so typing continues the question rather than replacing
    // it and nothing is left highlighted
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="group flex items-center gap-2 rounded-xl border border-[var(--line-strong)] bg-[var(--panel)] p-2 transition-colors focus-within:border-[var(--accent)]"
      >
        <span
          className="pl-2.5 font-mono text-base text-[var(--ink-4)] transition-colors group-focus-within:text-[var(--accent)]"
          aria-hidden
        >
          &gt;
        </span>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What do you want to see?"
          aria-label="What do you want to see?"
          autoFocus
          className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-base tracking-[-0.01em] text-[var(--ink)] outline-none placeholder:text-[var(--ink-4)] focus-visible:outline-none sm:text-lg"
        />

        <button
          type="submit"
          disabled={isLoading || value.trim().length === 0}
          className="shrink-0 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-[13px] font-semibold text-[#08080a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-25"
        >
          {isLoading ? "Composing…" : "Compose"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            disabled={isLoading}
            onClick={() => loadExample(example)}
            className="rounded-lg border border-[var(--line)] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-[var(--ink-3)] transition-colors hover:border-[var(--line-strong)] hover:bg-white/[0.05] hover:text-[var(--ink)] disabled:opacity-35"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
