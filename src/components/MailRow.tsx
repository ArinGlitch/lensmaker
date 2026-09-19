"use client";

import type { ReactNode } from "react";
import { STATUS_PILL, type Status } from "@/components/theme";

/**
 * One row of a mail list. Shared by TableBlock and FixedDashboard so the two
 * read as the same product — a list of messages — rather than as a spreadsheet.
 *
 * Presentational only: it is told what to show and what to do on click.
 */

/** Stable, quiet avatar tint derived from the sender's name. */
function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function initials(seed: string): string {
  return (
    seed
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export interface MailRowMeta {
  label: string;
  value: string;
}

export default function MailRow({
  seed,
  primary,
  secondary,
  meta = [],
  trailingTop,
  trailingBottom,
  status,
  statusLabel,
  onClick,
}: {
  /** Drives the avatar letters and tint — usually the vendor. */
  seed: string;
  primary: string;
  secondary?: string;
  /** Extra fields shown as `label value` pairs under the headline. */
  meta?: MailRowMeta[];
  /** Right-hand column: the number people scan for, and its date beneath. */
  trailingTop?: string;
  trailingBottom?: string;
  status?: Status;
  statusLabel?: string;
  onClick?: () => void;
}) {
  const hue = hueFor(seed);

  const body: ReactNode = (
    <>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
        style={{
          background: `hsl(${hue} 42% 22%)`,
          color: `hsl(${hue} 70% 82%)`,
        }}
        aria-hidden
      >
        {initials(seed)}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
            {primary}
          </span>
          {status && statusLabel && statusLabel !== "—" ? (
            <span
              className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_PILL[status]}`}
            >
              {statusLabel}
            </span>
          ) : null}
        </span>

        {secondary ? (
          <span className="truncate text-[13px] text-[var(--ink-3)]">
            {secondary}
          </span>
        ) : null}

        {meta.length ? (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {meta.map((m) => (
              <span key={m.label} className="flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-4)]">
                  {m.label}
                </span>
                <span className="text-[12px] text-[var(--ink-2)]">{m.value}</span>
              </span>
            ))}
          </span>
        ) : null}
      </span>

      {trailingTop || trailingBottom ? (
        <span className="flex shrink-0 flex-col items-end gap-0.5 pl-2">
          {trailingTop ? (
            <span className="tnum font-mono text-[13px] text-[var(--ink)]">
              {trailingTop}
            </span>
          ) : null}
          {trailingBottom ? (
            <span className="tnum font-mono text-[11px] text-[var(--ink-4)]">
              {trailingBottom}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );

  const shell =
    "flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors";

  if (!onClick) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <button type="button" onClick={onClick} className={`${shell} hover:bg-white/[0.04]`}>
      {body}
    </button>
  );
}
