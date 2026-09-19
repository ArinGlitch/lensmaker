# bugs.MD

Defects found while implementing the Dev B presentation layer (B1–B12).
Found by rendering the components against `prisma/fixtures/extracted.json` in a
throwaway harness and screenshotting them in headless Chrome, not by reading code.

| # | Bug | Severity | Status |
|---|---|---|---|
| 1 | Bar chart rendered with no bars | demo-breaking | **Fixed** |
| 2 | Page plane renders white on a light-mode machine | demo-breaking | **Fixed** |
| 3 | Client-side filter mirror inverted `null` semantics | demo-breaking | **Fixed** |
| 4 | ESLint config fails to load, repo-wide | annoyance | **Fixed** by Dev A (`c4e5692`) |
| 5 | Intent chip appends to existing text instead of replacing | demo-breaking | **Fixed** |
| 6 | `npm run db:seed` cannot see `DATABASE_URL` | blocks first run | **Fixed** by Dev A |
| 7 | Gemini provider dies on a missing peer dependency | blocks the demo provider | **Fixed** |
| 8 | One malformed block sinks the whole spec → every intent falls back | **demo-breaking** | **Fixed** by Dev A |
| 9 | Gemini runs with thinking enabled, against `plan.md` §8 | latency | **Fixed** by Dev A |

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

**Where:** `src/components/IntentBar.tsx` — **Fixed.**

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

**Fix applied:** the field clears on every successful submit, and a chip now
calls `submit()` directly instead of writing into the input first. An
always-empty field cannot concatenate. Nothing is lost by clearing — the
question you asked stays on screen as the view's `intent_echo`.

Thanks for driving a real browser to find this; it was invisible from the
component harness, where nothing types after a chip click.

---

## 6. `npm run db:seed` cannot see `DATABASE_URL`

**Where:** `package.json` (`db:seed` script) — **not fixed, Dev A's file**

**Symptom:** following the README exactly, the first run dies:

```
PrismaClientInitializationError:
error: Environment variable not found: DATABASE_URL.
```

**Cause:** `prisma migrate` works because the Prisma CLI loads `.env` itself.
`tsx prisma/seed.ts` does not — tsx has no implicit `.env` loading — so the
seed script starts with an empty environment.

**Workaround:** `npx tsx --env-file=.env prisma/seed.ts`

**Suggested fix (one flag):**

```json
"db:seed": "tsx --env-file=.env prisma/seed.ts"
```

---

## 7. Gemini provider dies on a missing peer dependency

**Where:** `package.json` — **Fixed.**

**Severity:** blocks the demo provider entirely.

**Symptom:** with `LLM_PROVIDER=gemini`, every intent returned the fallback
layout. The response was a valid 200 with `source:"fallback"`, so from the
outside it looked like Gemini was simply never producing a usable spec. The
server log had the real reason:

```
[view] provider error Error: Cannot find package '@modelcontextprotocol/sdk'
       imported from node_modules/@google/genai/dist/node/index.mjs
```

**Cause:** `@google/genai@1.5.0` declares `@modelcontextprotocol/sdk` as an
**optional** peer dependency, but its built entrypoint imports it
unconditionally. Optional in the manifest, required in practice.

**Fix applied:** added `@modelcontextprotocol/sdk` to dependencies.

**Worth noting:** this is the cost of the never-fail guarantee. `/api/view`
turning every provider error into a fallback is right for the demo and hides
exactly this class of bug during development. `scripts/check-gemini.ts` exists
to see through it:

```bash
npx tsx --env-file=.env scripts/check-gemini.ts
```


---

## 8. One malformed block sinks the whole spec, so every intent falls back

**Where:** `src/lib/llm/schema.ts` and `src/app/api/view/route.ts` — **Dev A's
files. Reported, not fixed.**

**Severity: demo-breaking, and currently active.** All four scripted intents
return the identical fallback layout. The core claim of the project — different
questions produce structurally different screens — does not happen at all right
now.

**This is not a provider problem.** Gemini is connected and answering in
1.7–2.8s with no provider error. The specs are being rejected after they arrive.

**Reproduction:**

```bash
curl -s -b cookies.txt -X POST localhost:3000/api/view \
  -H 'Content-Type: application/json' \
  -d '{"intent":"what are my hard deadlines right now?"}'
```

`source` comes back `"fallback"`. The `raw` field in the same response (dev only)
shows what Gemini actually sent:

```json
{
  "title": "Upcoming Deadlines",
  "blocks": [
    { "id": "deadline_timeline", "type": "timeline",
      "dateField": "deadlineDate", "primary": "subject",
      "secondary": "vendor", "sortBy": "deadlineDate", "tone": "info" },
    { "id": "deadline_count", "type": "stat",
      "label": "Total Deadlines", "title": "Active Deadlines", "tone": "info" }
  ],
  "confidence": "high", "insufficient_evidence": false
}
```

The timeline block is **correct and renderable**. The stat block is missing
`agg` and `field`, both required by `StatBlockSchema`. `ViewSpecSchema.safeParse()`
fails on the whole object, so the good timeline block is thrown away with the bad
stat block and the user gets the fallback.

**Cause:** `VIEWSPEC_JSON_SCHEMA` is a flattened union — every block property is
optional and only `id` and `type` are `required`. Gemini is emitting exactly what
that schema permits; the schema simply permits shapes that Zod then rejects. The
two schemas disagree, and the strict one runs last.

(Secondary, harmless: `sortBy` on a timeline and `tone` on a stat/timeline are
not in those block types. Zod strips unknown keys, so these do no damage — but
they are more evidence the model is being told the wrong shape.)

**Suggested fix 1 — prune per block, not per spec.** This is the one that
matters. Validate each block against `BlockSchema` individually, drop the
failures, keep the survivors, and fall back only when none survive. `plan.md` §4
rule 2 already prescribes exactly this for unknown field names; it just is not
applied to shape errors. With it, the spec above renders its timeline and
silently drops the broken stat — a real screen instead of a fallback.

**Suggested fix 2 — tighten the prompt.** State required props per block type,
e.g. `stat REQUIRES agg and field`. Raises the hit rate; does not make the
pipeline safe on its own, so do it *as well as* fix 1, not instead.

**Why this stayed invisible:** the never-fail guarantee. `/api/view` returning a
valid 200 with `source:"fallback"` is indistinguishable from success unless you
read `source` or the server log. Same root cause as #7. It may be worth logging
the Zod error and the offending block id when a spec is rejected.


---

## 9. Gemini runs with thinking enabled, against `plan.md` §8

**Where:** `src/lib/llm/gemini.ts` — **not fixed, Dev A's file.**

**Severity:** latency only. Nothing renders wrong; the screen just takes longer
to appear than it needs to, which matters on stage.

**Symptom:** every Gemini call returns thinking parts alongside the JSON. The
SDK says so out loud:

```
there are non-text parts thoughtSignature in the response, returning
concatenation of all text parts.
```

Observed latencies through `/api/view` were 1.7–2.8s for a layout decision.

**Cause:** `plan.md` §8 specifies `thinkingBudget: 0` on Flash — "layout choice
needs no deep reasoning". The provider config sets `temperature`,
`responseMimeType`, `responseSchema` and `maxOutputTokens`, but never
`thinkingBudget`, so the model reasons before answering on every request.

**Suggested fix:** add the thinking config alongside the other generation
settings in `GeminiProvider.generateViewSpec`. Worth measuring before and after
rather than assuming — if it does not move the numbers, the latency is
elsewhere and this entry can be closed as a non-issue.

**Note:** picking which block types answer a question is close to the case
`thinkingBudget: 0` exists for. It is a cheap thing to try before the demo.


---

## 10. `/api/view` strips `limit`, so blocks show rows the intent excluded

**Where:** `src/app/api/view/route.ts:117` — **Dev A's file. Reported, not fixed.**

**Severity:** the generative screen answers a narrower question than it shows.

**Symptom:** reported from the running app — a block shows emails that have
nothing to do with what was asked.

**Cause — two reasonable changes that cancel out.** The model expresses
selection in two different ways:

- **With filters**, the filters define the match. Everything matching should be
  reachable, and `limit` is only about density.
- **With no filters**, `limit` *is* the selection — "the 5 biggest", "the next
  6 to charge" — expressed as sort + cap. Drop the cap and the block silently
  widens to the whole corpus.

`/api/view` now deletes `limit` from every block:

```ts
kept.push("limit" in b ? ({ ...b, limit: undefined } as Block) : b);
```

The reasoning there is sound on its own — a limit of 10 hid most of an 85-row
corpus, and hidden data is worse than a long page. But it also discards the
only signal the model had for "these rows, not those", so a sort+cap spec now
renders all 85 rows.

**Already handled client-side, as far as it can be.** The blocks tell the two
cases apart: with filters they page through every match, without filters they
honour `limit` as a cap. That rule is live and correct — it just cannot fire,
because `limit` is `undefined` by the time it arrives.

**Why the original reason no longer applies.** `limit` was stripped to stop
rows being hidden. Nothing is hidden any more: every block paginates, so the
full set is always reachable while the page stays readable. The cap can be
restored without bringing back the problem it was removed to solve.

**Suggested fix:** stop stripping `limit` and let it through as the page size /
cap. If that feels risky, clamp it upward instead of deleting it (e.g.
`Math.max(block.limit, 10)`), which keeps the model's intent while guaranteeing
a useful page.
