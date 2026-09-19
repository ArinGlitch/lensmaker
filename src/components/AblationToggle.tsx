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
      className="flex items-center gap-2.5 rounded-full border border-white/15 bg-[#1a1a19] py-1.5 pl-3 pr-3.5 text-xs text-neutral-300 transition-colors hover:border-white/30"
    >
      <span className="font-medium uppercase tracking-wide text-neutral-500">
        Generative UI
      </span>

      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          enabled ? "bg-[#3987e5]" : "bg-neutral-700"
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
        className={`w-7 font-semibold ${enabled ? "text-white" : "text-neutral-500"}`}
      >
        {enabled ? "ON" : "OFF"}
      </span>
    </button>
  );
}
