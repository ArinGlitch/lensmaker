"use client";

import { useState } from "react";

/**
 * The only input in the app. There is no filter, no sort control and no column
 * picker anywhere — you restate what you care about and the screen is rebuilt.
 */
const EXAMPLES = [
  "what's about to charge me?",
  "what are my hard deadlines?",
  "what's trying to scam me?",
  "what am I spending most on?",
] as const;

export default function IntentBar({
  onSubmit,
  isLoading,
}: {
  onSubmit: (intent: string) => void;
  isLoading: boolean;
}) {
  const [value, setValue] = useState("");

  function submit(intent: string) {
    const trimmed = intent.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
    // Clear on submit. A chip used to write into the field without moving the
    // caret, so the next thing typed was appended to it and the two intents
    // concatenated (bugs.MD #5). An always-empty field can't do that, and the
    // question you asked stays visible as the view's intent_echo.
    setValue("");
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#1a1a19] p-2 focus-within:border-white/35"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What do you want to see?"
          aria-label="What do you want to see?"
          autoFocus
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base text-white outline-none placeholder:text-neutral-500 sm:text-lg"
        />
        <button
          type="submit"
          disabled={isLoading || value.trim().length === 0}
          className="shrink-0 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? "Composing…" : "Compose"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            disabled={isLoading}
            onClick={() => submit(example)}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
