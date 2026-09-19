"use client";

/**
 * The judge's switch. OFF is the hand-built dashboard every app ships; ON is
 * the screen the model composed for the question just asked.
 */
export default function AblationToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="flex items-center gap-2.5 rounded-lg border border-[var(--line-strong)] bg-[var(--panel)] py-1.5 pl-3 pr-3 text-xs transition-colors hover:border-[var(--ink-4)]"
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ink-4)]">
        Generative UI
      </span>

      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          enabled ? "bg-[var(--accent)]" : "bg-[#2a2a31]"
        }`}
        aria-hidden
      >
        <span
          className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            enabled ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </span>

      <span
        className={`w-7 text-[11px] font-semibold tracking-wide ${
          enabled ? "text-[var(--ink)]" : "text-[var(--ink-4)]"
        }`}
      >
        {enabled ? "ON" : "OFF"}
      </span>
    </button>
  );
}
