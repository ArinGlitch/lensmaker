"use client";

/**
 * Makes a fallback impossible to mistake for a composed answer.
 *
 * /api/view never fails — any problem degrades to a deterministic fallback spec
 * and returns 200. That is right for the demo, but it means an expired token,
 * a bad key, an exhausted quota and a rejected spec all render as an ordinary
 * screen. This says otherwise, and distinguishes the two causes: telling you
 * "the model was not reached" when it answered fine sends you to debug the
 * wrong layer.
 */
export default function FallbackNotice({
  provider,
  failureKind,
}: {
  provider: string;
  failureKind?: "provider" | "invalid";
}) {
  const notReached = failureKind !== "invalid";

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
        {notReached
          ? "Generic layout — the model was not reached"
          : "Generic layout — the model's answer was rejected"}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-amber-100/90">
        {notReached ? (
          <>
            This screen was not composed for your question. The{" "}
            <span className="font-mono">{provider}</span> provider returned an
            error, so a fixed fallback layout is being shown instead.
          </>
        ) : (
          <>
            The <span className="font-mono">{provider}</span> provider answered,
            but the layout it returned failed validation, so a fixed fallback is
            being shown. Open <em>Inspect spec</em> to see what it sent.
          </>
        )}
      </p>
      <p className="mt-2 text-xs text-amber-200/70">
        {!notReached
          ? "This is a bug in the schema or the prompt, not in your question."
          : provider === "haiku"
            ? "Usually an expired SSO session: run `aws sso login --profile bedrock`, then ask again."
            : "Check GEMINI_API_KEY and quota: run `npm run gemini:check` to see the real error."}
      </p>
    </div>
  );
}
