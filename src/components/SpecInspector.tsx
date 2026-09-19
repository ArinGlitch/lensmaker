"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * The receipt. This drawer shows the exact JSON the model returned — which is
 * the whole claim: it composed a screen without writing a line of code.
 */
const TOKEN =
  /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

function Highlighted({ json }: { json: string }) {
  const parts = useMemo(() => {
    const out: React.ReactNode[] = [];
    let last = 0;
    let key = 0;
    for (const m of json.matchAll(TOKEN)) {
      const start = m.index ?? 0;
      if (start > last) out.push(json.slice(last, start));
      if (m[1] !== undefined) {
        out.push(
          <span key={key++} className="text-[#c3c2b7]">
            {m[1]}
          </span>,
          ":",
        );
      } else if (m[2] !== undefined) {
        out.push(
          <span key={key++} className="text-[#3987e5]">
            {m[2]}
          </span>,
        );
      } else if (m[3] !== undefined) {
        out.push(
          <span key={key++} className="text-[#d95926]">
            {m[3]}
          </span>,
        );
      } else {
        out.push(
          <span key={key++} className="text-[#9085e9]">
            {m[4]}
          </span>,
        );
      }
      last = start + m[0].length;
    }
    out.push(json.slice(last));
    return out;
  }, [json]);

  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-neutral-400">
      {parts}
    </pre>
  );
}

export default function SpecInspector({
  spec,
  meta,
  open,
  onClose,
}: {
  spec: unknown;
  meta: { provider: string; latencyMs: number; source: string };
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const json = useMemo(() => {
    try {
      return JSON.stringify(spec, null, 2) ?? "null";
    } catch {
      return "// spec could not be serialised";
    }
  }, [spec]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  if (!open) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />

      <aside
        role="dialog"
        aria-label="Generated ViewSpec"
        className="relative flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-[#0d0d0d] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              ViewSpec returned by the model
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              No JSX, no SQL, no component code — only this object.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="shrink-0 rounded border border-white/10 px-2 py-1 text-xs text-neutral-400 hover:text-white"
          >
            Esc
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-5 py-3 text-[11px]">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-neutral-300">
            source: {meta.source}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-neutral-300">
            provider: {meta.provider}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-neutral-300 tabular-nums">
            {meta.latencyMs}ms
          </span>
          <button
            type="button"
            onClick={copy}
            className="ml-auto rounded border border-white/15 px-2.5 py-1 text-neutral-300 hover:border-white/30 hover:text-white"
          >
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Highlighted json={json} />
        </div>
      </aside>
    </div>
  );
}
