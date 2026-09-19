# Frontend redesign prompt

Paste everything between the `---` markers into the design tool. It is written
to be tool-agnostic — it works for any assistant that can read a repo and write
Tailwind, and it carries the constraints that make this app's UI unusual.

---

You are redesigning the frontend of **Lensmaker**, a Next.js 15 + React 19 +
Tailwind v4 app. I want it to look formal, professional and genuinely striking.
Dark theme only. Read every constraint below before proposing anything — this
app's UI has a rule that will break your usual instincts.

## What the app is

The user types one sentence describing what they care about ("what's about to
charge me?"). An LLM returns a **ViewSpec** — a JSON object naming which UI
blocks to render and how to configure them. Hand-written React components render
that JSON. The model never writes code, never writes CSS, never names a
component that does not already exist.

So the screen is **composed at runtime from JSON**. A different question produces
a structurally different screen, not a re-filtered version of the same one.

## THE RULE THAT BREAKS YOUR INSTINCTS

**There are no filter dropdowns, no sort buttons, no column pickers, no
segmented controls, no date-range selectors and no settings panel. Anywhere.**

Do not add a sidebar of facets. Do not add sortable table headers. Do not add a
"View: grid/list" toggle. Do not add a filter bar above the results. Do not add
a search input beside the intent bar. If you catch yourself designing a control
that narrows, sorts or reshapes data, stop — the user changes the screen by
restating their question, and that is the entire point of the product.

The **only** inputs in the whole app are:
1. the intent text field,
2. four example-intent chips,
3. a "Generative UI ON/OFF" toggle (a demo device, explained below),
4. Save / Load / Delete on saved views,
5. the login form.

That is the complete list. Adding a sixth is a failure, no matter how good it
looks.

## What to redesign

Rework the visual language of these files. Keep every filename, every default
export and every prop signature exactly as they are — other people's code
imports them.

```
src/app/globals.css              design tokens live here
src/app/layout.tsx               page shell
src/app/page.tsx                 header, intent bar, view area, saved views
src/app/login/page.tsx           login card
src/components/IntentBar.tsx     text field + 4 chips
src/components/EmptyState.tsx    "not enough evidence" panel
src/components/AblationToggle.tsx
src/components/FixedDashboard.tsx   deliberately plain — see below
src/components/SpecInspector.tsx    right-side slide-over showing raw JSON
src/components/SavedViews.tsx       gallery of saved screens
src/components/blocks/StatBlock.tsx
src/components/blocks/CardsBlock.tsx
src/components/blocks/BarBlock.tsx
src/components/blocks/TimelineBlock.tsx
src/components/blocks/ListBlock.tsx
src/components/blocks/TableBlock.tsx
src/components/blocks/CalloutBlock.tsx
```

## The seven blocks, and why they must not converge

A ViewSpec contains 1–5 blocks. The renderer is a `switch` over `block.type`.
These seven are the entire visual vocabulary:

| Block | Job | Required shape |
|---|---|---|
| `stat` | one headline number | huge figure, mostly empty space |
| `cards` | each row matters individually | responsive grid of panels |
| `bar` | compare a measure across categories | a chart (Recharts) |
| `timeline` | dates and deadlines | vertical rail with dated stops |
| `list` | order matters more than detail | dense numbered rows |
| `table` | multi-field comparison | dense grid, only the named columns |
| `callout` | one urgent message | single tinted message box |

**Stat, cards, bar and timeline must be unmistakable from across a room.**
Different silhouette, different density, different rhythm. If three questions
produce three screens that look alike, the product's core claim is invisible and
the redesign has failed. This is the single most important visual requirement.

Lean into it: a stat block should feel almost arrogantly empty. A list should
feel tight and mechanical. They should not share a padding scale.

## What "formal and professional, but striking" means here

Aim for the register of a financial terminal or a well-made developer tool.
Precision, not decoration.

- Deep near-black ground; panels one step above it, separated by hairline
  borders rather than heavy shadows.
- One restrained accent hue, used for emphasis and the chart. Not a gradient
  rainbow.
- Type: system sans throughout. Tight tracking on large numbers, generous
  letter-spacing on small uppercase labels. Real hierarchy — at least a 4x jump
  between the hero figure and body text.
- Numbers in tables and columns use `tabular-nums`; large standalone figures use
  proportional figures.
- Motion is brief and purposeful: content settling in, a drawer sliding. Nothing
  bounces, nothing loops, nothing pulses.
- Generous whitespace. Crowding reads as amateur faster than bad colour does.

Things that would cheapen it: neon glows on everything, glassmorphism, animated
gradient borders, emoji as iconography, drop shadows doing the work borders
should do, a different accent colour per block.

## Colour rules that are not negotiable

Status colours are **reserved** and mean state, never decoration:

```
good #0ca30c   warning #fab219   serious #ec835a   critical #d03b3b
```

They never get reused as "just another accent", and they never carry meaning
alone — every status pill ships with its label so it survives colourblindness
and greyscale. The current single-series chart hue is `#3987e5`.

You may re-step these for a new palette, but keep the structure: one accent, a
reserved status set, hairline borders, two surface levels. Anything you propose
must clear 4.5:1 for body text and 3:1 for large text and UI edges against the
surface it sits on. State the contrast ratios you are relying on.

## The ablation toggle — do not beautify FixedDashboard

`AblationToggle` flips between two modes:

- **ON** → the generated screen.
- **OFF** → `FixedDashboard`, a frozen hand-built layout: two stat boxes and one
  table, identical no matter what was asked.

`FixedDashboard` is **supposed to look ordinary** — it is the "before" in a
before/after. Keep it plain and a little dated. Every improvement you make to it
weakens the comparison. Put your effort into the generated side.

## Technical constraints

- **Tailwind v4 utility classes inline.** No CSS modules, no styled-components,
  no CSS-in-JS. Design tokens as CSS custom properties in `globals.css`.
- `globals.css` must not reintroduce a `prefers-color-scheme` flip — an
  unlayered `body` rule there overrides Tailwind utilities and previously
  painted the whole page white on light-mode machines. Dark is a commitment.
- Charts are **Recharts 2.15.3**. Bars: ≤24px thick, 4px rounded data-end,
  square at the baseline, hairline solid gridlines, no legend for a single
  series, `isAnimationActive={false}`.
- Components are presentational: props in, JSX out. No data fetching, no state
  beyond local UI state, no new dependencies.
- Every block must render sensibly at **0 rows, 1 row and 40 rows**. Show me the
  empty state for each one.
- Must not break `npx tsc --noEmit` or `npm run build`. TypeScript is strict:
  no `any`.
- Responsive down to ~400px. Grids stack; tables scroll horizontally in their
  own container so the page never scrolls sideways.
- Accessibility: focus-visible rings on every interactive element, the toggle
  keeps `role="switch"` + `aria-checked`, the drawer keeps its `role="dialog"`
  and Escape-to-close.

## What to give me

1. **A token block** for `globals.css` — surfaces, ink levels, border, accent,
   status colours, radii, spacing rhythm — with the contrast ratios noted.
2. **A per-component spec**: for each file above, the concrete Tailwind classes
   for its container, heading, body and empty state.
3. **The four P0 blocks in detail** (stat, cards, bar, timeline), each with a
   one-line statement of how it reads differently from the other three.
4. **The header and intent bar**, which set the tone before any data loads.
5. **A short rationale** — three or four sentences on the visual thesis. If you
   deviate from anything above, say so and why.

Work file by file. Do not rename files, change exports, alter prop signatures,
or add dependencies.

---
