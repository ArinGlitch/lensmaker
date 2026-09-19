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
          <span key={key++} className="text-[var(--ink-2)]">
            {m[1]}
          </span>,
          ":",
        );
      } else if (m[2] !== undefined) {
        out.push(
          <span key={key++} className="text-[#6ba7ee]">
            {m[2]}
          </span>,
        );
      } else if (m[3] !== undefined) {
        out.push(
          <span key={key++} className="text-[#ec835a]">
            {m[3]}
          </span>,
        );
      } else {
        out.push(
          <span key={key++} className="text-[#a79cf0]">
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
    <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-[var(--ink-3)]">
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
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      <aside
        role="dialog"
        aria-label="Generated ViewSpec"
        className="relative flex h-full w-full max-w-lg flex-col border-l border-[var(--line-strong)] bg-[var(--panel)] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
              ViewSpec returned by the model
            </h2>
            <p className="mt-1 text-[12px] text-[var(--ink-4)]">
              No JSX, no SQL, no component code — only this object.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="shrink-0 rounded-md border border-[var(--line-strong)] px-2 py-1 font-mono text-[11px] text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]"
          >
            Esc
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-5 py-3 text-[11px]">
          <span className="rounded-md border border-[var(--line)] bg-white/[0.03] px-2 py-0.5 font-mono text-[var(--ink-2)]">
            source: {meta.source}
          </span>
          <span className="rounded-md border border-[var(--line)] bg-white/[0.03] px-2 py-0.5 font-mono text-[var(--ink-2)]">
            {meta.provider}
          </span>
          <span className="tnum rounded-md border border-[var(--line)] bg-white/[0.03] px-2 py-0.5 font-mono text-[var(--ink-2)]">
            {meta.latencyMs}ms
          </span>
          <button
            type="button"
            onClick={copy}
            className="ml-auto rounded-md border border-[var(--line-strong)] px-2.5 py-1 text-[var(--ink-2)] transition-colors hover:border-[var(--ink-4)] hover:text-[var(--ink)]"
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
