# bugs.MD

Defects found while implementing the Dev B presentation layer (B1–B12).
Found by rendering the components against `prisma/fixtures/extracted.json` in a
throwaway harness and screenshotting them in headless Chrome, not by reading code.

| # | Bug | Severity | Status |
|---|---|---|---|
| 1 | Bar chart rendered with no bars | demo-breaking | **Fixed** |
| 2 | Page plane renders white on a light-mode machine | demo-breaking | **Fixed** |
| 3 | Client-side filter mirror inverted `null` semantics | demo-breaking | **Fixed** |
| 4 | ESLint config fails to load, repo-wide | annoyance | **Open** — Dev A's file |

---

## 1. Bar chart rendered with no bars

**Where:** `src/components/blocks/BarBlock.tsx`

**Symptom:** The chart drew its axes, gridlines and category labels correctly, but
no bars. The block looked like an empty frame.

**Cause:** Recharts' entry animation. The bars start at zero width and grow via
`requestAnimationFrame`; on first paint in a slow or headless frame the animation
had not advanced, so every bar had zero length.

**Fix:** `isAnimationActive={false}` on `<Bar>`. Also the better choice for a
live demo — the chart is correct on the first frame instead of flying in.

**Verify:** load any intent that produces a `bar` block; bars are present immediately.

---

## 2. Page plane renders white on a light-mode machine

**Where:** `src/app/globals.css`

**Symptom:** Nothing visible on this machine — which is exactly the problem. The
dev machine is in dark mode, which masked it completely.

**Cause:** `globals.css` still carried the stock Next scaffold's
`prefers-color-scheme` flip (`--background: #ffffff` in light mode). That `body`
rule is **unlayered**, and unlayered CSS beats Tailwind's layered utilities — so
it overrode `bg-neutral-950` from `layout.tsx`. On a light-mode machine the whole
page plane would render white while every block stayed dark, and the header text
in `page.tsx` (`neutral-400` / `neutral-500`) would be near-invisible against it.

**Evidence:** forcing `--background: #ff0000` turned the entire page red, proving
the plane follows `globals.css` and not the layout class.

**Fix:** fixed dark values plus `color-scheme: dark`, no `prefers-color-scheme`
flip. Also dropped the `font-family: Arial` override so Tailwind's system sans
applies.

**Note:** this is Dev A's file. See `flags.MD` §1.

---

## 3. Client-side filter mirror inverted `null` semantics

**Where:** `src/components/blockData.ts` (`looseEqual`)

**Symptom:** Introduced mid-build. Dev A widened `Filter.value` to accept `null`
(commit `311521c`), where `{op:"ne", value:null}` is how the model says *"this
field is set"* — the form it reaches for constantly on `deadlineDate`.

**Cause:** The client mirror treated a `null` target as never-equal. So
`ne null` **kept** the undated rows it was meant to drop, and `eq null` matched
nothing at all. The "what are my hard deadlines?" intent would have shown all 29
rows instead of the 6 dated ones.

**Fix:** `if (target === null) return value == null;` before the general path.

**Verify:** against the committed fixtures, `ne null` and `eq null` now partition
the set exactly — 6 dated + 23 undated = 29.

---

## 4. ESLint config fails to load, repo-wide

**Where:** `eslint.config.mjs:2-3` — **not fixed, Dev A's file**

**Symptom:** `next build` prints:

```
⨯ ESLint: Cannot find module '.../eslint-config-next/core-web-vitals'
  Did you mean to import "eslint-config-next/core-web-vitals.js"?
```

`npm run lint` fails outright with the same error. The build still succeeds —
Next treats it as non-fatal — so nothing is blocked, but **no file in this repo
has ever actually been linted.**

**Cause:** the two imports omit the `.js` extension, which ESM resolution requires
for these subpath imports.

**Suggested fix (one line each):**

```js
import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTs from "eslint-config-next/typescript.js";
```

Left alone because `eslint.config.mjs` is Dev A's file and the build is green
without it. Worth doing — it may surface real findings the first time it runs.

---

## 5. Intent chip appends to existing text instead of replacing it

**Where:** `src/components/IntentBar.tsx` (Dev B's file — reported, not fixed)

**Severity:** demo-breaking if triggered on stage.

**Symptom:** Found during the joint checkpoint by driving a real browser. Click
the chip "what am I spending most on?", then type a new question without first
clearing the field, and the two concatenate:

```
what am I spending most on?which of my coworkers are secretly lizards?
```

The composed intent is nonsense, and on stage it looks like the app is broken.

**Cause:** a chip click sets the input value but does not select or clear it, so
subsequent typing is appended at the caret.

**Suggested fix (Dev B's call):** on chip click, either clear the field before
setting the value, or select-all so the next keystroke replaces it. Clearing the
field after a successful submit would also prevent it.

**Workaround until fixed:** select-all (⌘A) before typing a fresh intent, or
click a chip and submit it directly without editing.
