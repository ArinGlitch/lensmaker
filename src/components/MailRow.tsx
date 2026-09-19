"use client";

import type { ReactNode } from "react";
import { STATUS_HEX, type Status } from "@/components/theme";

/**
 * One row of a mail list. Shared by TableBlock and FixedDashboard so the two
 * read as the same product — a list of messages — rather than as a spreadsheet.
 *
 * Monochrome by design. The only colour a row may carry is a single 6px status
 * dot, and only when the status is not neutral. Tinting each sender or putting
 * a filled pill on every line turns a list into confetti: colour stops meaning
 * anything the moment every row has some.
 *
 * Presentational only: it is told what to show and what to do on click.
 */

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
  /** Drives the monogram — usually the sender. */
  seed: string;
  primary: string;
  secondary?: string;
  /** Extra fields, shown as a quiet dot-separated trail under the headline. */
  meta?: MailRowMeta[];
  /** Right-hand column: the number people scan for, and its date beneath. */
  trailingTop?: string;
  trailingBottom?: string;
  /** Neutral renders nothing — a dot on every row is a dot that says nothing. */
  status?: Status;
  statusLabel?: string;
  onClick?: () => void;
}) {
  const showStatus =
    status && status !== "neutral" && statusLabel && statusLabel !== "—";

  const body: ReactNode = (
    <>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white/[0.04] text-[10px] font-semibold tracking-wide text-[var(--ink-3)]"
        aria-hidden
      >
        {initials(seed)}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)]">
          {primary}
        </span>

        {secondary ? (
          <span className="truncate text-[13px] text-[var(--ink-3)]">
            {secondary}
          </span>
        ) : null}

        {meta.length || showStatus ? (
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[11px] text-[var(--ink-4)]">
            {showStatus ? (
              <span className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: STATUS_HEX[status] }}
                  aria-hidden
                />
                {statusLabel}
              </span>
            ) : null}
            {meta.map((m, i) => (
              <span key={m.label} className="flex items-center gap-2">
                {i > 0 || showStatus ? <span aria-hidden>·</span> : null}
                <span className="truncate">{m.value}</span>
              </span>
            ))}
          </span>
        ) : null}
      </span>

      {trailingTop || trailingBottom ? (
        <span className="flex shrink-0 flex-col items-end gap-0.5 pl-3">
          {trailingTop ? (
            <span className="tnum text-[13px] text-[var(--ink-2)]">
              {trailingTop}
            </span>
          ) : null}
          {trailingBottom ? (
            <span className="tnum text-[11px] text-[var(--ink-4)]">
              {trailingBottom}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );

  const shell =
    "flex w-full items-center gap-3.5 px-5 py-3 text-left transition-colors";

  if (!onClick) return <div className={shell}>{body}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${shell} hover:bg-white/[0.03]`}
    >
      {body}
    </button>
  );
}
