"use client";

import { useEffect, useRef } from "react";

/**
 * The moving ground the app sits on.
 *
 * Three oversized radial gradients drift on their own timers and lean toward
 * the cursor. Deliberately cheap: gradients are soft already, so there is no
 * blur filter, and only `transform` is animated — the compositor does the work
 * and the main thread stays free for the chart.
 *
 * It is inert by construction: fixed, behind everything, and
 * pointer-events-none, so it cannot intercept a click. Every panel in the app
 * is opaque, so this never sits behind text and cannot affect contrast inside a
 * block — it only shows in the gaps.
 *
 * Honours prefers-reduced-motion: the drift and the cursor follow both stop,
 * and what is left is a still gradient.
 */
export default function AuroraBackground() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onMove = (e: PointerEvent) => {
      // -1..1 from the centre of the viewport
      targetX = (e.clientX / window.innerWidth) * 2 - 1;
      targetY = (e.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(tick);
    };

    // Ease toward the pointer instead of tracking it exactly, so the light
    // trails the cursor rather than snapping to it.
    function tick() {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      el!.style.setProperty("--mx", currentX.toFixed(4));
      el!.style.setProperty("--my", currentY.toFixed(4));

      const settled =
        Math.abs(targetX - currentX) < 0.001 &&
        Math.abs(targetY - currentY) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(tick);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={root} className="aurora" aria-hidden>
      <span className="aurora-blob aurora-blob-1" />
      <span className="aurora-blob aurora-blob-2" />
      <span className="aurora-blob aurora-blob-3" />
      <span className="aurora-blob aurora-blob-4" />
      <span className="aurora-spot" />
      <span className="aurora-grid" />
    </div>
  );
}
