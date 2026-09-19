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

  function submit(intent: string) {
    const trimmed = intent.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);

    // The question stays in the bar, so you can always see what the screen is
    // answering — including when it came from a chip rather than the keyboard.
    setValue(trimmed);

    // ...but it is left selected, which is what stops bugs.MD #5 coming back.
    // A chip used to write into the field without moving the caret, so the next
    // keystroke appended and the two intents ran together. Selected text is
    // replaced by the next keystroke instead. Clicking into the field still
    // places a caret normally, because editing the question is then deliberate.
    requestAnimationFrame(() => inputRef.current?.select());
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
            onClick={() => submit(example)}
            className="rounded-lg border border-[var(--line)] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-[var(--ink-3)] transition-colors hover:border-[var(--line-strong)] hover:bg-white/[0.05] hover:text-[var(--ink)] disabled:opacity-35"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
