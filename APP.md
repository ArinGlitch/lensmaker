# Lensmaker — Feature Inventory

## What this is

Lensmaker is an inbox you query in sentences. An email corpus of 85 messy messages was read by a model and turned into structured rows; you then ask the app a question in plain language and a model composes the screen that answers it — choosing from 15 hand-built block types, configuring each one, and returning that choice as validated JSON. Hand-written React components render the JSON. The model never writes code, never writes SQL, and never touches the database.

---

## The theme: the model is both the input module and the output module

This is the whole bet. Remove the model and there is no interface — just a Postgres table and 15 orphaned React components.

**Pipeline A — the model as INPUT.** Every row in the database was extracted from unstructured email prose by the model (`src/lib/llm/extract.ts`). One call per email produces `category`, `summary`, `urgency`, `amount`, `currency`, `chargeInDays`, `deadlineInDays`, `isSuspicious`, `riskReason`, and a verbatim `sourceExcerpt`. Nobody typed a single structured field. There is no import form, no CSV, no admin panel.

The phishing judgement is part of this, and it is a real judgement, not a keyword list. The extraction prompt tells the model to decide `isSuspicious` on signals — a sender name imitating a real brand with altered characters, a link domain that does not belong to the claimed brand, requests for card numbers or CVV or government IDs, manufactured urgency — and explicitly that legitimate marketing is *not* suspicious. When it flags something it must name the specific signals it saw in `riskReason`.

**Pipeline B — the model as OUTPUT.** The live path. Three things go to the model: your sentence, a schema digest of the 12 field names it is allowed to reference, and the block catalog. It returns a ViewSpec — a JSON object naming 1–8 blocks and their configuration. That JSON is validated, pruned, and handed to `Renderer.tsx`, a `switch` over `block.type`.

**There are no filter dropdowns, no sort buttons, and no column pickers anywhere in this app.** Not hidden, not collapsed — they do not exist. `TableBlock` renders exactly the columns the spec names and has no sortable headers. To change what you see, you restate what you want. The only two inputs in the entire product are the intent bar and the refinement line.

---

## All 15 block types

Every silhouette below is deliberate: the blocks must be distinguishable at a glance, because that distinctness is what proves the model made a structural choice rather than re-filtering one table.

| Block | What it shows | Visual silhouette | Example question |
|---|---|---|---|
| `stat` | One aggregate (sum/count/avg/min/max) over a field | The emptiest block in the set: a single huge numeral (up to 5.5rem at `emphasis:"high"`) in a field of whitespace, under a short accent rule, with a row-count footnote | "how much am I paying in total?" |
| `cards` | A grid of panels, one per row, when each item matters individually | Many small boxes in a responsive grid; each card is a click target that opens the original email | "show me what's charging me next" |
| `bar` | A metric compared across categories | Horizontal ranked bars with axes and gridlines — horizontal so 6+ category labels read straight across instead of rotated. One series, so no legend | "what am I spending most on?" |
| `timeline` | Date-driven chronological rows | A vertical rail with dated stops and a date gutter, days-remaining pill per stop. One column, no boxes | "what are my hard deadlines?" |
| `list` | Compact ranked rows where order is the message | The densest block: numbered rows divided by hairlines, no panels, nothing competing with the ordering | "what's the most urgent thing?" |
| `table` | Dense multi-field comparison, 1–6 named columns | A bordered grid with a header row; numbers and dates right-aligned. No column picker, no sort headers | "list vendor, amount and deadline for everything" |
| `callout` | One urgent message, `info`/`warn`/`danger` | A single tinted bar with a 3px left edge, an icon, and a word ("Note"/"Heads up"/"Risk") so colour is never the only channel | "am I at risk of anything?" |
| `verdict` | The answer as a *word*, not a number | A tone-tinted panel with a thick left edge, one very large left-aligned sentence, an eyebrow word, and an optional subordinate stack of hairline rows beneath. Zero rows is a success state, not an empty frame | "am I screwed this week?" |
| `calendar` | A month or week grid bucketed by a date field | A literal rectangle: seven columns, two-letter weekday headers, uniform day cells with up to 2 chips per cell then "+N". Anchors on today by default | "what does my month look like?" |
| `buckets` | Age-of-inaction histogram — how long things have been sitting | ONE full-width horizontal track split into coloured bands plus a legend. Deliberately a single continuous bar so it cannot be mistaken for `bar`'s separate bars. Default edges 2/7/14/30 days | "what have I been ignoring?" |
| `comparison` | Two aggregates over the same rows, filtered two ways, plus the delta | A symmetric two-column readout split by a centre rail, then a full-width tinted delta band. Coloured by magnitude of change, never by direction | "how does this month compare to last?" |
| `countdown` | Live-ticking time remaining until the soonest matching date | Three or four oversized digit groups side by side with small unit labels, above an exact date and time to the minute in the viewer's timezone | "how long until my enrolment window closes?" |
| `digest` | Grouped counts split into still-actionable versus already-expired | A stack of wide count rows — group name left, big number right — with a dimmed, folded-away expired section beneath whose count is always stated even while its rows stay hidden | "what did I miss while I was out?" |
| `entity` | One roll-up per entity (usually vendor) across every row mentioning it | A vertical stack of WIDE rows, each with a value, row count, last activity, and an inline monthly sparkline on the right | "who am I paying?" |
| `smallMultiples` | A grid of identical mini-tiles, one per group, all on one shared scale | Many small uniform tiles (2 per row on mobile up to 4 on desktop), each carrying a bar rather than prose. Denser than `cards`; the shared scale is the point — outliers pop | "compare my categories at a glance" |

`entity` and `smallMultiples` are deliberate opposites: same grouping, opposite shape (wide stack versus dense grid). `stat` and `verdict` are the same pairing for answers (huge numeral versus prose in a coloured frame). `timeline` and `calendar` split date views into a rail and a grid. `bar` and `buckets` split distributions into separate bars and one banded track.

---

## Incremental refinement

`POST /api/view/refine`. Once a view is on screen, a quiet **"Adjust this view"** link expands into a single line where you type a change. It collapses again after it runs. No dropdowns, no block pickers, no per-block controls — you still only ever type.

The model receives the current ViewSpec plus your instruction and returns a **complete replacement spec**, not a patch or a diff. Three modes, all in the refinement prompt:

- **Add** — append a block of a *different* type to those already present. Never two blocks of the same type. ("add a chart", "add a countdown")
- **Remove** — drop the block named. ("drop the chart")
- **Narrow** — add filters to the *existing* blocks rather than replacing them. ("only subscriptions", "just this month")

The prompt instructs: make the smallest change that satisfies the adjustment, and everything the user did not mention must survive untouched.

**Block ids are preserved byte for byte.** The model is told to keep the existing `id` of every block it retains; only a genuinely new block gets a new id. That stability is what lets the UI animate between states rather than flash the whole screen.

**Why a whole spec instead of a patch** (documented in `src/lib/llm/refine.ts`): a replacement spec runs through the exact same validate → prune → money-guard path as a fresh generation (`lib/specPipeline.ts`), so a refinement cannot smuggle past a safety rule that a generation would have caught. A patch language would be a second contract to keep in sync with the first.

**On failure you get your own spec back, not the fallback.** If the model errors or returns something unusable, `/api/view/refine` returns the caller's original spec unchanged. Losing the screen you built up because one tweak failed would be far worse than the tweak silently not applying.

**Undo.** The page keeps the pre-refinement response and shows an **Undo** button beside the adjust link, which restores it instantly with no model call.

Refinements are cached on `sha256("refine" + baseSpec + instruction + provider + schemaVersion)`, so repeating one during a rehearsal is free.

---

## Saved views

Write-back to Postgres. **Save view** posts `{intent, spec}` to `/api/views`, which re-validates the spec with `ViewSpecSchema` before storing it — a spec that fails validation is rejected with a 400 rather than persisted. Rows live in the `SavedView` table, scoped to the user.

The gallery renders below the current view with the original question and a relative timestamp ("3 days ago"). Loading one replays the stored JSON directly: **zero tokens, zero model calls** — the spec is already JSON, so replaying it is free. Views can be deleted; `DELETE /api/views/[id]` 404s if you are not the owner.

---

## The email reading pane

Click any row in `cards`, `list`, `timeline`, `table`, `verdict`, `calendar`, `buckets`, `digest`, `entity` or `countdown` — the 10 row-bearing blocks — and a mail-client reading pane opens. The page shell slides left rather than being covered, so the header and the composed view stay readable beside the message. Escape closes it.

Two tabs:

- **Message** — the full original email, laid out the way Gmail or Outlook lays one out: sender avatar with initials, subject headline, from/to/date header block, then the body in readable paragraphs.
- **Extracted fields** — the structured fields the model pulled out of that same prose, **with the exact source sentence quoted next to them** (`Item.sourceExcerpt`, copied verbatim from the body at extraction time).

**This is the only visible proof of Pipeline A.** Every other surface in the app shows you the structured side only — a card, a chart, a countdown. All of it is downstream of an extraction you cannot otherwise see. This pane is where a judge can put the messy original sentence and the field it became side by side and check that the model actually read it. Without this tab, "the model extracted all of this from prose" is an assertion; with it, it is something you can verify on stage in five seconds.

---

## The ablation toggle

A switch labelled **Generative UI** in the header, with an explicit ON/OFF state.

- **OFF** → `FixedDashboard`, a deliberately plain hand-built dashboard. The same one every app ships.
- **ON** → `Renderer`, showing the screen the model composed for the question just asked.

**What it proves:** that the model is contributing the *structure*, not decoration. With the toggle off you see the fixed dashboard regardless of what you want to know. With it on, four different questions produce four structurally different screens from the same 85 rows.

**Why it is unusual:** almost nobody ships the control that lets you turn their headline feature off. An ablation is a research instrument — you remove the component under test and show the result degrades. Shipping one in the product UI is an invitation to check whether the AI is load-bearing or a veneer, and most demos are built to avoid exactly that question. It is also the fastest possible answer to "couldn't you have just hardcoded this?": the hardcoded version is one click away, and it is visibly worse.

---

## Month-by-month spending breakdown

Lives on the **ablation-OFF dashboard**, opened from a spending tile. Renders as a
full-screen overlay rather than its own route — deliberately, because every protected
path is listed explicitly in `middleware.ts`, so a new route would ship
unauthenticated until that matcher was updated. An overlay inherits the gate of the
page it opens from.

What it shows:

- **Every month from the first record to the last**, including the empty ones. A gap is
  information; skipping it would misrepresent the trend.
- A total and a count per month, with the year figure leading.
- **Expand any month to see the individual emails behind the figure**, largest first.
  Click one and the reading pane opens beside the breakdown rather than replacing it.

**Why it matters for the demo:** it is the audit trail for every number on screen.
A judge asking "where does $182,984.91 come from?" can expand a month and read the
actual emails that sum to it. Money attributed to the day it moves (`chargeDate`),
falling back to when it arrived (`receivedAt`).

It is also a pointed contrast: the *frozen* dashboard is where the exhaustive drill-down
lives, while the generative side answers the question directly. The ablation is not a
strawman — the fixed side genuinely does something the generative side does not.

---

## Mail rows and pagination

- **`MailRow`** renders inbox-style rows (sender, subject, amount, date) so a table of
  emails reads like mail rather than a spreadsheet. Used by `TableBlock` and the
  ablation dashboard.
- **`Pagination`** pages every list at 15 per page (12 for `entity`, 16 for
  `smallMultiples`), with `1–15 of 36` counts and Prev/Next.

One design decision worth stating: **the model is never told about `limit`.** Pagination
is display state owned by the components. When `limit` was offered in the block catalog
the model emitted values, and a single invalid one failed validation and took the whole
spec down — leaving the entire dashboard ungenerated. The counts are always visible, so
a page is never silently hiding rows.

---

## Motion and ground

`AuroraBackground` animates the page ground with `requestAnimationFrame` and a settle
condition, so it comes to rest instead of burning CPU for the length of a demo. The dark
palette is defined as CSS variables in `globals.css` and consumed through
`components/theme.ts`; no block hardcodes a colour.

---

## Reliability and trust

Each of these exists because it failed at least once during the build. The one-liner is why a judge should care.

| Feature | Why it matters |
|---|---|
| **Per-block validation** — envelope parsed first with blocks as `unknown`, then each block individually against `BlockSchema`; failures dropped, survivors kept | One malformed block used to sink the entire spec, so every question served the identical fallback and the core claim of the project did not happen at all. Now a bad stat block is dropped and the good timeline still renders. |
| **Field allowlist** — every field name must be one of the 12 in `SCHEMA_DIGEST`; a block naming anything else is dropped | The model cannot reach for data it was not offered. Hallucinated field names cost you one block, not a broken screen or an error. |
| **Filter DSL compiled server-side — no SQL from the model** — `{field, op, value}` with `op` in `eq\|ne\|lt\|lte\|gt\|gte\|contains\|in` | The model never emits SQL and there is no `$queryRaw` anywhere in the codebase. The blast radius of a bad generation is a wrong chart, not a dropped table. |
| **The `Renderer` switch as security boundary** — `default: return null` | The model picks from a catalog of 15 hand-built components and cannot introduce a sixteenth. Unknown type renders nothing. |
| **Badge-safe fields** — a badge naming a prose field is stripped, not dropped | A badge is a small pill. `summary` or `riskReason` in one overflows the card grid off-screen. Stripping the badge keeps an otherwise-good block instead of losing it. |
| **Label-only field swapping** — `urgency`, `category`, `isSuspicious`, `currency` are replaced when used as `primary`/`secondary` | A row whose primary is a one-word label renders as "high / deadline" and tells the reader nothing. The server promotes it to the first unused readable field (`subject`, `summary`, `vendor`). |
| **Money guard** — `{isSuspicious, eq, false}` appended to any block aggregating `amount`, unless the intent is about scams | An amount demanded by a phishing email is not money you spent. Including it corrupts the total. Re-applied on cache reads, so specs cached before the guard existed cannot leak a scam figure into a spending number. |
| **`insufficient_evidence`** — renders an honest empty state showing `notes` | The app tells you when it does not know instead of fabricating a chart. Ask it something the 12 fields cannot answer and it says so. |
| **Prose fields truncate instead of rejecting** — `title`, `intent_echo`, `notes` are `.transform()`ed to length | A length cap on cosmetic prose used to fail whole specs, discarding four good blocks because the model explained itself at length. The same bug in extraction's `riskReason` cap was rejecting 3 of 4 correctly-detected phishing emails for being *too well explained*. |
| **The never-500 guarantee** — `/api/view` always returns a valid spec: cache → model → fallback | The demo cannot crash on a bad model response, because a bad model response is a handled case rather than an exception. Verified with no credentials present at all. |
| **The fallback notice** — an on-screen banner distinguishing `failureKind: "provider"` from `"invalid"` | The never-500 guarantee turns every failure into a valid 200, which makes a fallback indistinguishable from a real answer — it hid two separate bugs during the build. The notice says "the model was not reached" versus "the model's answer was rejected", because conflating them sends you debugging the wrong layer. |
| **Spec caching** — `sha256(intent\|provider\|schemaVersion)`; fallbacks deliberately not cached | A warm cache means a rehearsal costs zero tokens and a cache hit returns in 0ms. Fallbacks stay uncached so they get retried rather than remembered. |
| **`Pagination` footers** — "Showing N of M · Show all" on every truncating block | Hidden rows that are both invisible and unmentioned read as data loss, and there is no pagination to fall back on. Server-side the pipeline also drops the model's `limit` entirely, because the model routinely capped a block at 10 rows and silently hid most of an 85-row corpus. |

---

## Demo-ready facts

Every number below was counted from `prisma/fixtures/extracted.json`.

- **85 emails**, spanning **2026-02-04 to 2026-09-17** — a real 7.5-month spread, not a synthetic same-day batch.
- **73 distinct vendors.**
- **5 phishing emails detected by the model**, each with a specific `riskReason` naming the signals it saw:
  - a fake university IT helpdesk ("FINAL WARNING... DEACTIVATED within 24 hours") on a lookalike domain `laurentide-universlty-helpdesk.account-verify-secure.net`
  - a bank alert with the sender name misspelled "Merdian" instead of "Meridian"
  - a second fake bank security alert on `meridian-trustbank.account-verify-ca.com`
  - a parcel-delivery scam, "Northlline" mimicking "Northline", demanding a $3.20 customs fee via `secure-track-ca.net`
  - **a recruiter that was never planted as phishing** — Ravencourt Search Group, demanding compensation history, work authorization status, and references with contact details for an "immediate start" role. It was written as an ordinary annoying recruiter email. The model flagged it on its own, for requesting sensitive personal information. This is the single best evidence that `isSuspicious` is a judgement rather than a keyword match.
- **36 deadlines**, of which **27 are already past** and 9 are still ahead. This is why the prompt carries an explicit time rule: without `{deadlineDate, gte, "now"}`, an "upcoming deadlines" question showed items 176 days overdue.
- **Category mix:** 31 deadline, 18 general, 17 receipt, 15 subscription, 4 security. **Urgency mix:** 36 high, 19 medium, 30 low.
- **49 rows carry an amount**; 19 have a charge date.
- **Zero tokens to seed.** `npm run db:seed` reads the committed fixture. No model call, no network.
- **A warm cache means zero live calls are needed.** `npm run demo:warm` pre-generates the four scripted intents in `src/lib/intents.ts` and warns if any lands on the fallback. Cold latency on Gemini is 2.2–5.0s; a cache hit is 0ms.

---

## Honest limitations

- **The emails are synthetic.** The corpus is persona-authored — 39 emails from a student persona and 46 from a professional persona, merged by `scripts/merge-personas.ts`. They were written to be realistically messy (deadlines buried in the last paragraph, trial-conversion notices, long marketing bodies), but this is not a real inbox and there is no Gmail OAuth. That was a deliberate non-goal: OAuth verification takes weeks, and fixtures are reproducible.
- **There is no retry on a transient provider error.** A single 503 becomes a fallback screen. The warm cache is the real protection.
- **Filters run client-side.** `lib/filters.ts` exports `compileFilters()` to compile the DSL into a Prisma `where`, but **it has no callers** — `/api/data` returns every row and `Renderer` hands the full array to every block, which filters it in the browser via `applyFilters()` in `blockData.ts`. This is demo-correct and verified, but it means the filter logic exists in two places that must stay in step (a `null`-semantics divergence between them has already cost one demo-breaking bug), the server-side Prisma path is dead code as it stands, and every row reaches the browser regardless of what a block asks for. Fine for 85 rows; not what you would ship.
- **ESLint has never actually run on this repo.** `eslint.config.mjs` omits the `.js` extension on two subpath imports, so the config fails to load. `next build` treats it as non-fatal, so nothing is blocked — but no file here has been linted, and the first real run may surface findings.
- **Version drift from the plan.** `plan.md` §2 specifies a stack the repo does not have, across nine packages. The majors matter: zod 3 not 4, recharts 2 not 3. `package.json` is the truth.
- **`next@15.5.7` carries a published security advisory.** Not a demo risk — nothing is internet-facing and auth is a seeded demo user — but real.
- **`package-lock.json` mixes two registries** (610 entries from an internal Artifactory mirror, 66 from public npm), so `npm ci` may only succeed on one machine.
- **The Gemini API key in `.env` was exposed** in a chat and a screenshot. It is gitignored and uncommitted, but it should be rotated after the demo and not reused for anything with billing attached.
- **Auth is deliberately basic.** Seeded demo user, bcrypt, a 7-day `jose` JWT in an httpOnly cookie. Correct, but no hardening beyond that, by design.
