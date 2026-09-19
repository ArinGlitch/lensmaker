"use client";

/**
 * Makes a dead provider impossible to mistake for a working one.
 *
 * /api/view never fails — a provider error degrades to a deterministic
 * fallback spec and returns 200. That is right for the demo, but it means an
 * expired token, a bad model id, or an exhausted quota all look exactly like a
 * normal answer. This is the one thing that says otherwise.
 */
export default function FallbackNotice({ provider }: { provider: string }) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
        Generic layout — the model was not reached
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-amber-100/90">
        This screen was not composed for your question. The{" "}
        <span className="font-mono">{provider}</span> provider returned an
        error, so a fixed fallback layout is being shown instead.
      </p>
      <p className="mt-2 text-xs text-amber-200/70">
        {provider === "haiku"
          ? "Usually an expired SSO session: run `aws sso login --profile bedrock`, then ask again."
          : "Check GEMINI_API_KEY and quota: run `npm run gemini:check` to see the real error."}
      </p>
    </div>
  );
}
