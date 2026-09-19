# Lensmaker

**You say what you care about. Gemini composes the screen. Our components render it.**

Jump to: [30-second version](#the-30-second-version) · [**Demo script**](#the-90-second-demo-script) · [Why this isn't a chat wrapper](#why-this-isnt-a-chat-wrapper) · [Technical depth](#technical-depth) · [Ablation toggle](#the-ablation-toggle) · [Judge Q&A](#anticipated-judge-questions) · [Limitations](#honest-limitations)

---

## The 30-second version

Every app ships one frozen interface. Lensmaker ships none.

You type what you want to see. Gemini returns a JSON **ViewSpec** — a validated description of a screen, assembled from a fixed catalog of hand-written React components. The model picks blocks and fills typed props. It never writes a line of code, never emits SQL, never touches the DOM.

Ask a different question, get a structurally different screen: a single number, a card grid, a timeline, a danger callout. Not a re-filtered table.

**There is not one filter dropdown, sort button, or column picker anywhere in the app.** That's not minimalism. The layout decision has moved out of the UI and into the model.

Gemini is both ends of the I/O path. It's the only way data gets *in* (structured rows extracted from messy email prose — nobody typed a form). It's the only thing that decides what comes *out* (the screen). Remove Gemini and you have a database and a pile of orphaned components.

---

## The problem

Software ships one interface, designed for an "average user" who does not exist.

Picture a subscription-spend screen. Three people open it:

- **The junior dev** wants one fact: *is the trial expiring this week?* She gets a 12-column table, sorts it twice, and squints.
- **The manager** wants the hard deadlines in chronological order. He gets the same 12-column table and mentally reconstructs a timeline.
- **The exec** wants one number. He gets the same 12-column table.

All three fight the same screen. The product team's answer is always the same: add controls. A filter dropdown. A sort header. A saved-view menu. A column picker. Each control is a small confession that the designer could not know what you wanted — so the burden of assembling the view got pushed onto you. A mature enterprise screen is mostly apparatus for reshaping itself.

Y Combinator named this directly: **"Dynamic Software Interfaces"** is an RFS category (Summer 2026 cycle) — the thesis being that interfaces should adapt to the user rather than the user adapting to a static interface. That's the bet. Lensmaker is one concrete, narrow, running implementation of it.

Our framing: the filter dropdown is a *design smell*. It exists because the intent was never expressible. Let the user express the intent.

---

## The 90-second demo script

Four scripted intents. One clear moment. Total time ~90s.

| # | Action | What appears | Line to say |
|---|---|---|---|
| 0 | Land on app, **Generative UI: OFF** | Fixed hand-built dashboard — static table + two stat boxes | "This is what every app gives you. It looks like this no matter who you are." |
| 1 | Flip toggle **ON**, type `what's about to charge me?` | Big stat number + card grid of upcoming charges | "I didn't pick a layout. Gemini did." |
| 2 | Type `what are my hard deadlines?` | **Previous view vanishes.** Vertical timeline with days-remaining badges | ← **THE MOMENT** (see below) |
| 3 | Type `what's trying to scam me?` | Red danger callout + flagged list, with the phishing email | "Different question, different shape again." |
| 4 | Type something the data can't answer | `EmptyState` — plain, calm, honest | "It tells you when it doesn't know instead of drawing a fake chart." |
| 5 | Open **SpecInspector** | Pretty-printed JSON, provider, latency, cache status | "That's the JSON Gemini wrote. It never wrote a line of code — it picked from our catalog." |

### The "oh, this is possible now" moment — beat 2

**It is the transition from beat 1 to beat 2, and nothing else.**

The card grid does not re-sort. It does not re-filter. It **disappears**, and a timeline takes its place — different shape, different density, different visual rhythm. The screen didn't change its contents. It changed its *form*.

That's the whole pitch in one second of animation. Everything after it is evidence.

> Judges see 30–100 demos a day. JetBrains states it plainly in their judging guidance: *one clear "oh, this is possible now" moment is much stronger than a tour of every feature.* Our research notes flag scope creep — the feature tour — as the primary failure mode. So beat 2 is the demo. Beats 3–5 exist to prove beat 2 wasn't a hardcoded trick, and they get ~15 seconds each.

**Design requirement this imposes on the build:** the four P0 blocks (Stat, Cards, Bar, Timeline) must be *instantly distinguishable*. Three near-identical tables and the demo fails regardless of backend quality. One huge number / a grid of boxes / a chart / a vertical dated rail. Different shapes, not different data.

---

## Why this isn't a chat wrapper

The saturation research is blunt about the current field: generic chatbot-bolted-onto-a-thing is terminally saturated, and judges report having "seen a hundred GPT wrappers." Worse, the *sophisticated* escape hatch is also saturated — all three podium winners at the Gemini 3 hackathon were multi-agent swarms. "I built five specialized agents" is 2026's "I built a chatbot."

**So agent count is not our novelty, and we don't claim it. One model call per question. No agent loop. No multi-turn.**

Here is what is structurally different:

**1. There is no chat interface.** Not a hidden one, not a collapsed drawer. The model's output is not text for a human to read — it's a **typed data structure our renderer consumes**. A chat wrapper's output channel is prose. Ours is `{type: "timeline", dateField: "deadlineDate", limit: 8}`. A human never reads the model's answer; a `switch` statement does.

**2. The model is in the control plane, not the content plane.** Wrappers use the LLM to *generate content* that gets dropped into a fixed layout. We use the LLM to *choose the layout*, and the content comes from Postgres via our own query compiler. Invert those and you have a different product.

**3. The "does your app have a form?" test.** Our research notes distilled the theme down to exactly this: *if the app has a form, the theme was missed.* Lensmaker has one text input — the intent bar — and a login box. That's it. No filters, no sorts, no column selectors, no dropdown anywhere in the codebase. It's a hard rule in `CLAUDE.md`, enforced in review: if you're adding a `<select>`, stop.

The data has no form either. Every row in the database was **extracted by Gemini from unstructured email prose** — trial-expiry notices, a 500-word corporate email with the deadline buried in the last paragraph, receipts, one phishing attempt. Nobody typed structured data. We keep `sourceExcerpt` on every row so you can see the original messy sentence next to the field pulled out of it.

**4. The model cannot exceed the component catalog.** A wrapper's blast radius is whatever the model emits. Ours is bounded by a hand-written `switch` over `block.type` with `default: return null`. The model's expressive ceiling is seven block types and a typed prop set — by construction, not by prompt discipline.

**5. It closes the loop.** The cross-cutting judge signal in our research: most projects read context and *display* an answer; winners **write the result back** into the system of record. Generated views can be saved and reloaded from a gallery, keyed to the user. The model's output becomes durable state, not a transient render.

---

## Technical depth

These are reliability engineering decisions, not features. Each one exists because a specific failure mode would otherwise take down the demo.

### The ViewSpec contract

One file, `src/lib/viewspec.ts`, is the single source of truth. Zod schemas; TypeScript types are `z.infer`'d from them, never hand-written in parallel. Both devs code against it; it's the only cross-cutting dependency in the build.

```
ViewSpec = {
  title: string
  intent_echo: string              // model restates the question it answered
  blocks: Block[]                  // 1..5, discriminated union on `type`
  confidence: "low" | "medium" | "high"
  insufficient_evidence: boolean
  notes?: string
}
```

Seven block types: `stat`, `cards`, `bar`, `timeline`, `list`, `table`, `callout`. Every prop is typed and bounded — `limit: 1–24` on cards, `1–12` on bars, `columns: 1–6` on tables. `agg` and `format` are closed enums; free text is rejected by Zod, not by a prompt instruction.

### Validation pipeline (server-side, in `/api/view`)

```
intent ──┐
schema ──┼──► LLM ──► ViewSpec (JSON) ──► Zod validate ──► <Renderer> ──► screen
catalog ─┘                                     │
                                          invalid → last-good spec → fallback
```

Providers return `unknown` **on purpose**. A provider never validates its own output; the caller does. Concretely, in order:

1. `ViewSpecSchema.safeParse()`. Malformed → serve last-good spec → `buildFallbackSpec()`.
2. **Field allowlist.** Every `field`, `groupBy`, `dateField`, `sortBy`, and `columns` entry must exist in the schema digest. Unknown field → **drop that block, keep the rest.** All blocks dropped → fallback. Partial degradation beats total failure.
3. Filters compiled to a Prisma `where` clause by our own code.
4. Enums enforced by schema, not by instruction.
5. `insufficient_evidence: true` → render `EmptyState`.

### The filter DSL — the model never emits SQL

```
FilterOp = "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "contains" | "in"
Filter   = { field, op, value }
```

The model emits this DSL. `lib/filters.ts` compiles it to a Prisma `where`. **There is no raw SQL path in the codebase** — no `$queryRaw`, nothing to escape, nothing to inject into. Prompt injection into the intent bar can, at absolute worst, produce a filter over an allowlisted field. It cannot produce a query.

### Graceful degradation

`/api/view` **always returns a valid spec.** Model → cache → fallback. It never 500s and never returns a spec that fails its own validation. We test this by forcing garbage out of the provider and confirming the screen still renders. The demo cannot crash on a bad model response, because a bad model response is a handled case, not an exception.

### `insufficient_evidence` as a first-class output

Not an error path — a modeled return value. When the question can't be answered from the data, the model says so and we render a deliberately calm `EmptyState` with the model's `notes`. It never fabricates rows to fill a chart. Our research found this shape (returning `insufficient_evidence` instead of bluffing) in a winning project and essentially nowhere else — it reads as rigor because it is rigor.

### Caching

Cache key is `sha256(intent | provider | schemaVersion)` → a `ViewSpecCache` row. A hit costs **zero tokens**. This is what makes rehearsal free and the demo deterministic. The extraction pipeline never runs live: `prisma/fixtures/extracted.json` is committed and `seed.ts` reads it. Re-extraction is opt-in behind `SEED_RUN_EXTRACTION=1`.

### Provider abstraction — and an honest note about it

```ts
interface LLMProvider {
  name: "haiku" | "gemini"
  generateViewSpec(input): Promise<{ spec: unknown; raw: string; latencyMs: number }>
}
```

**We develop on Claude Haiku via AWS Bedrock; the production target is Gemini.** We're not hiding that — it's an architectural decision we'd defend.

Our budget research found the Gemini free tier covers text-in/text-out Flash models, but the exact requests-per-day figure is no longer published publicly and third-party sources disagree by roughly 75x (one source says ~20/day, another ~1,500/day — *unverified, and the only authority is the AI Studio rate-limit page*). Designing against the pessimistic end is the only safe choice for a live demo.

So: unlimited Bedrock Haiku during the build, Gemini for final rehearsal and the demo, selected by a single env var (`LLM_PROVIDER`). One shared prompt file — both providers send byte-identical instructions; only transport differs. The Gemini path is deliberately the *better* one: native `responseSchema` structured output mirroring the Zod contract, `temperature: 0.2` so the same question yields the same screen, `thinkingBudget: 0` for latency. Haiku forces JSON through a tool-definition, which is a workaround by comparison.

The reason this abstraction isn't leaky: **the hot loop is text → structured JSON on both providers.** No audio bytes, no generated pixels, no streaming sessions. The same call shape genuinely works on both. Had we picked a voice or image-generation idea, Haiku couldn't substitute at all and the abstraction would be fiction.

---

## The ablation toggle

A switch in the header: **Generative UI: ON / OFF.**

Flip it OFF and the app renders `FixedDashboard` — a deliberately plain, frozen layout: one static table, two fixed stat boxes, intent ignored entirely. It's intentionally unpretty. Flip it ON and the same data flows through `Renderer`.

### What it proves

It isolates the model's contribution. With the toggle, "the AI composes the interface" stops being a claim and becomes a **controlled comparison the judge runs themselves, on stage, in two seconds.** Same data, same components, same database — the only variable removed is the model. The delta is visible, not asserted.

It also answers the skeptic's real question before they ask it. Every judge watching an AI demo is silently wondering *how much of this is actually the model?* The toggle is the answer, and it's falsifiable: if generative mode produced the same screen as the fixed dashboard, you'd see that immediately too.

### Why it's unusual

Our research surveyed winning hackathon projects for structural (topic-independent) reasons they won. **A shipped ablation mode appeared exactly once — and that project won its Grand Prize** (Project Blackbox, DataHub: backward causal tracing, demoed side-by-side with its context layer disabled).

One instance across the entire survey. It's a near-free meta-shape that layers onto any idea, it's the single most direct way to demonstrate value rather than assert it, and almost nobody ships it. Most teams spend their last hour polishing a feature nobody asked for; ablation mode costs one boolean, one plain component, and a conditional render.

It's also a form of intellectual honesty. Building the tool that could disprove your own pitch, and then handing it to the judges, is a different posture than a scripted happy path.

---

## Anticipated judge questions

**"What if the model hallucinates a component?"**
It renders nothing. `Renderer.tsx` is a `switch` over `block.type` with `default: return null`, and Zod rejects any unrecognized `type` before that switch is reached. The model's expressive ceiling is seven hand-written block types — a hallucinated eighth type isn't a bug to be caught, it's outside the type system. The switch *is* the security boundary: the model cannot introduce anything we didn't build.

**"How is this different from a BI tool?"**
A BI tool asks you to build the view. Tableau, Looker, Metabase — the workflow is pick a dimension, pick a measure, pick a chart type, pick filters. The controls *are* the product. Lensmaker has no controls. You state an intent and the composition step is performed for you. Second difference: the input side. BI tools assume you already have structured data in a warehouse. Our rows were extracted by an LLM from unstructured email prose — the unstructured-to-structured step is inside the product, not a prerequisite for it.

**"Does it work with real data?"**
Honestly: it works with realistic data, not live data. The demo dataset is 30–40 synthetic emails we wrote to be genuinely messy — deadlines buried in the last paragraph of long corporate emails, trial-expiry notices, receipts, marketing noise, one phishing attempt — then extracted by the model into Postgres. **Gmail OAuth is an explicit non-goal:** Google's verification for restricted Gmail scopes takes weeks, which is incompatible with a hackathon, and it would add zero information to the demo. The extraction pipeline consumes text; where the text comes from is an adapter we didn't write. That's a real gap and we're calling it one.

**"What's the latency?"**
Cache hit: effectively instant, zero tokens. Cache miss on Gemini Flash with `thinkingBudget: 0` and a prompt held under ~1.5k tokens: our target is ~2 seconds to a rendered screen, and the response carries a measured `latencyMs` you can read in the SpecInspector. **We're not quoting a benchmarked number — read it off the inspector during the demo.** All four scripted intents will be cache-warm, which is a demo-reliability decision, not a latency claim; asking an unscripted question exercises the live path and we're happy to do that.

**"Why not just let the LLM write React?"**
Four reasons, in descending order of how much they'd hurt:
1. **You can't validate it.** A JSON spec passes or fails `safeParse` deterministically. Generated JSX has no such check short of executing it.
2. **You'd be executing model output in the user's browser.** That's an arbitrary-code-execution surface with an LLM as the author. No.
3. **It's slow and flaky.** Hundreds of tokens of JSX versus a few dozen of JSON, and a syntax error means a blank screen rather than a dropped block.
4. **The output would be inconsistent.** Hand-written components mean every screen honors our design system, accessibility, and empty-state handling automatically. Generated components mean re-rolling those guarantees on every request.

The constraint is the design. "The model picks from a fixed catalog and fills typed props" is strictly more reliable than "the model writes code," and it costs us nothing that matters for this problem.

**"What happens on a malformed response?"**
Three-stage fallback, in order: Zod rejects → serve the last-good spec for that session → if there is none, `buildFallbackSpec()` returns a deterministic sensible screen (a stat and a card grid). Separately, a *partially* bad spec degrades gracefully: blocks naming fields outside the allowlist are dropped individually and the remaining blocks still render. `/api/view` never returns a 500 and never returns a spec that fails its own validation. We verify this by forcing the provider to emit garbage.

**"How much does this cost to run?"**
At demo time, with a warm cache: **zero.** Cache hits make no model call, and the extraction pipeline was pre-computed offline into a committed fixture.

Per cache miss it's one Gemini Flash call with a sub-1.5k-token prompt and a small JSON response. Gemini's text-in/text-out Flash models have a free tier per Google's pricing docs. We're deliberately *not* quoting a dollar-per-query figure, because the exact free-tier request limits aren't published publicly anymore and the third-party numbers we found disagree by about 75x. What we can state architecturally: one call per user action, hard-capped by design, cached by intent hash, with a fallback that costs nothing. If the free tier turned out to be 20 requests a day, the demo still runs.

---

## Honest limitations

What this does not do, stated plainly.

**Not built, by decision:**
- **No Gmail (or any live email) connection.** Explicit non-goal. OAuth verification for restricted Gmail scopes takes weeks. Fixtures are strictly better for a demo and the ingest adapter is the missing piece, not the pipeline.
- **No chat interface of any kind**, including a collapsed drawer. Deliberate — it would undercut the central claim.
- **No multi-agent orchestration.** One call per question. The research says agent count is saturated and cannot be a novelty claim; we're not making one.
- No `.ics` export, no unsubscribe automation, no streaming, no audio, no image generation.

**Real gaps that would need work for production:**
- **Auth is deliberately basic.** bcrypt plus a `jose`-signed JWT in an httpOnly cookie. Correct as far as it goes — no tokens in localStorage, no manual cookie parsing — but there's no refresh rotation, no rate limiting on login, no CSRF token beyond `sameSite: lax`. Fine for a demo, not for production.
- **Seven block types is a small vocabulary.** It covers this dataset well. A richer domain would need more blocks, and each one is hand-written work — that's the deliberate trade for safety, and it's a real ceiling.
- **The catalog and schema digest are single-tenant and hardcoded.** Pointing this at a new dataset means writing a new schema digest and probably new blocks. There's no automatic schema introspection.
- **Layout quality depends on prompt quality.** `temperature: 0.2` makes it near-deterministic, but a badly phrased intent can produce a technically valid, unhelpful screen. The fallback catches *invalid*, not *mediocre*. We have no automated layout-quality evaluation.
- **Tests are a smoke check only.** Six hours, two devs. We prioritized the reliability paths (fallback, allowlist, cache) over coverage. A production version needs a real test suite — and notably, one of the projects our research found compelling shipped 43 tests and got "feels like a product, not a hackathon project" from a judge. We didn't earn that.
- **No accessibility audit.** Blocks render sensibly at 0, 1, and 40 rows, which is the bar we set. Screen-reader semantics for generatively composed layouts is a genuinely interesting unsolved problem and we did not solve it.
- **Unverified at scale.** Tested against ~30–40 rows. Aggregations run in application code over fetched rows, not pushed down to SQL. That will not hold at 100k rows.

**The thing we'd flag ourselves:** the demo is scripted with four intents and a warm cache. That's a deliberate reliability choice — and it does mean the on-stage experience is the best case. The mitigation is that we'll take an unscripted question from a judge on the spot. The ablation toggle and the SpecInspector are both there so you don't have to take our word for anything.

---
Generated by Rocket Flow · 2.1.5 · 2026-09-19
