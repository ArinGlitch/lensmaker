# Lensmaker

State what you care about. The model composes the screen.

There are no filter dropdowns, no sort buttons, and no column pickers in this app. The only input is a sentence. The model returns a validated JSON **ViewSpec** naming which blocks to render and how to configure them; hand-written React components render it. The model never writes code.

---

## Run it

```bash
docker compose up -d
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open http://localhost:3000 — login is pre-filled.

| | |
|---|---|
| Demo user | `demo@lensmaker.app` |
| Password | `demo1234` |
| Postgres | host port **5434** (5432/5433 are commonly taken by SSH tunnels) |

`npm run db:seed` inserts the demo user plus **85 pre-extracted items** from the committed fixture. It makes no model calls and needs no network.

### Provider switch

Development and the demo both run on Bedrock Haiku. The Gemini path is fully implemented and selected by one env var.

```bash
# haiku — requires an active `bedrock` SSO session
LLM_PROVIDER=haiku
AWS_PROFILE=bedrock
AWS_REGION=us-east-2
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0

# gemini
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.8-flash
```

If the Bedrock session expires: `aws sso login --profile bedrock`.

Selection happens in exactly one place (`src/lib/llm/index.ts`) and nowhere else. Providers are imported **lazily** so the unselected SDK is never bundled — this is load-bearing, see the environment notes below. Both providers send byte-identical instructions from the shared `llm/prompt.ts`; only transport differs. Gemini uses native `responseSchema` structured output with `thinkingBudget: 0`; Haiku forces the same schema through a Converse tool definition. Both run at `temperature: 0.2` for generation (`0` for extraction), so the same question yields the same screen.

---

## How it works

```
intent ──┐
schema ──┼──► LLM ──► ViewSpec (JSON) ──► Zod envelope ──► per-block validate
catalog ─┘                                       │              ──► prune ──► money guard ──► <Renderer>
                                            all blocks dropped → fallback spec
```

Three things go to the model: the user's sentence, a schema digest of the 12 allowed field names, and the block catalog. It returns only a ViewSpec. It never emits JSX, HTML, SQL, or Prisma syntax.

`Renderer.tsx` is a `switch` over `block.type` with `default: return null`. That switch is the security boundary — an unknown block type renders nothing, so the model cannot introduce a component that was not hand-built.

### Two pipelines

| | Pipeline A — ingest | Pipeline B — layout |
|---|---|---|
| Role | model as **input** | model as **output** |
| When | offline, via `seed.ts` | live, per intent |
| Flow | messy email prose → structured rows | intent → ViewSpec |
| Cost | zero tokens (committed fixture) | one call, then cached |

Pipeline A is why there are no forms: nobody typed the structured data. `llm/extract.ts` turns each email's prose into a row, and it is where `isSuspicious` / `riskReason` are genuinely decided by the model rather than hardcoded. `Item.sourceExcerpt` keeps the verbatim source sentence so the extraction can be shown side by side in the reading pane.

### Incremental extraction

`SEED_RUN_EXTRACTION=1` re-runs Pipeline A, but **only on emails it has not already extracted**. Each email is keyed by `sha256(vendor + subject + receivedAt + body)`, truncated to 16 chars and stored as `sourceHash` in the fixture. Adding five emails costs five calls, not 85. Calls are sequential on purpose — a burst of parallel calls is how you discover a rate limit mid-demo.

```bash
# normal: free, offline
npm run db:seed

# extract only what is new, then commit extracted.json
AWS_PROFILE=bedrock SEED_RUN_EXTRACTION=1 npm run db:seed

# force a full re-extraction (one call per email; rarely needed)
SEED_FORCE_REEXTRACT=1 AWS_PROFILE=bedrock SEED_RUN_EXTRACTION=1 npm run db:seed
```

The fixture is rebuilt in corpus order, reusing cached rows, so one failed call never drops previously-good extractions. If zero rows survive, it throws rather than clobbering `extracted.json`.

### Incremental refinement

`POST /api/view/refine` adjusts the spec already on screen instead of rebuilding it. The model receives the current ViewSpec plus a short instruction ("drop the chart", "add a countdown", "only subscriptions") and returns a **complete replacement spec** — not a patch.

Whole spec rather than a patch, deliberately:

- it reuses the exact same validate → prune → money-guard code path as a fresh generation (`lib/specPipeline.ts`), so a refinement can never bypass a safety rule;
- block ids stay stable because the model is told to preserve them byte for byte, which is what lets the UI animate rather than flash;
- a patch language would be a second contract to keep in sync with the first.

Failure semantics differ from `/api/view` in one important way: if the model cannot produce a usable adjustment, the endpoint returns **the caller's own original spec**, not the generic fallback. Losing a screen you built up because one tweak failed would be worse than the tweak silently not applying. The UI pairs this with an **Undo** button that restores the pre-refinement response.

Refinements are cached on `sha256("refine" + baseSpec + instruction + provider + schemaVersion)`.

---

## UI components worth knowing

| Component | Role |
|---|---|
| `IntentBar` | the only input. Text plus four demo chips from `lib/intents.ts`, shared with `warm-cache.ts` so a chip can never drift out of the warm cache |
| `RefineBar` | "+ Adjust this view" — expands to one line for an incremental instruction, with Undo |
| `Renderer` | the `switch` over `block.type`. Security boundary: unknown type renders nothing |
| `ItemDrawer` | the reading pane. Message tab (full email, mail-client layout) and Extracted-fields tab (the source sentence beside the fields the model pulled from it) |
| `SpendingBreakdown` | month-by-month spending on the ablation dashboard, every month including empty ones, expandable to the emails behind each figure |
| `MailRow` | inbox-style row (sender, subject, amount, date) used by `TableBlock` and the ablation dashboard |
| `Pagination` | pages every list at 15 (12 entity, 16 smallMultiples) with `1–15 of 36` counts. Display state only — the model is never told about `limit` |
| `FixedDashboard` | the ablation-OFF view. Deliberately plain; do not improve it |
| `SpecInspector` | shows the raw ViewSpec the model returned |
| `FallbackNotice` | distinguishes a provider failure from a rejected spec, with the matching fix command |
| `AuroraBackground` | animated ground, `requestAnimationFrame` with a settle condition so it stops |
| `ItemSelection` | React context letting any block open the reading pane without threading a callback through every block signature |

Blocks are pure presentational: `{ block, items }` in, JSX out. No fetching, no Prisma,
no LLM imports. Formatting, filtering and grouping live in `components/blockData.ts`;
colours come from `components/theme.ts` and CSS variables, never hardcoded.

---

## Reliability

`/api/view` **always returns a valid spec** — cache → model → fallback. It never 500s, verified with no credentials present.

1. **Per-block validation.** The envelope is parsed with `ViewSpecEnvelopeSchema` (blocks come through as `unknown`), then each block is parsed individually against `BlockSchema`. A malformed block is dropped and the rest still render. Parsing the whole object at once meant one bad block discarded every good block alongside it, so every intent served the fallback.
2. **Field allowlist.** Every `field` / `groupBy` / `dateField` / `sortBy` / `columns` / filter field must be one of the 12 names in `SCHEMA_DIGEST`. A block naming anything else is dropped; the rest survive.
3. **Filters are a restricted DSL** (`{field, op, value}`, op in `eq|ne|lt|lte|gt|gte|contains|in`) compiled by our own code. There is no `$queryRaw` anywhere in this codebase and the model never emits SQL. `null` is a permitted value: `{op:"ne", value:null}` is how the model says "this field is set".
4. **Badge-safe fields.** A badge renders as a small pill. If the model picks a prose field (`summary`, `riskReason`) the badge is stripped server-side rather than dropping the block, because prose in a pill overflows the card grid off-screen.
5. **Label-only field swapping.** `urgency`, `category`, `isSuspicious` and `currency` are one-word labels; a row whose `primary` is one of them reads as "high / deadline" and tells the reader nothing. They are swapped server-side for the first unused readable field (`subject`, `summary`, `vendor`).
6. **Money guard.** Any block aggregating or displaying `amount` gets `{isSuspicious, eq, false}` appended unless the intent is itself about scams or security. Money demanded by a phishing email is not money the user spent. This is re-applied on cache reads too, so specs cached before the guard existed cannot leak scam amounts into a total.
7. **Duplicate block types are dropped.** Visual variety is the product.
8. **Prose fields truncate instead of rejecting.** `title`, `intent_echo` and `notes` are cosmetic, so the envelope schema `.transform()`s them to length rather than failing. A length cap on them used to fail whole specs — discarding four good blocks because the model explained itself at length. Same class of bug as the `riskReason` cap in extraction, which was rejecting 3 of 4 correctly-detected phishing emails for being too well explained.
9. **`insufficient_evidence: true`** renders an honest empty state instead of a fabricated chart.
10. **Spec caching** on `sha256(intent|provider|schemaVersion)`. A hit costs zero tokens and returns in 0ms. Only real model output is cached — fallbacks are left uncached so they get retried.
11. **The fallback notice.** Because the never-500 guarantee turns every failure into a valid 200, a fallback is otherwise indistinguishable from a composed answer. `FallbackNotice` says so on screen and distinguishes the two causes via `failureKind`: `"provider"` (the call failed — expired token, bad key, quota) versus `"invalid"` (the model answered but the spec failed validation). Conflating them sends you debugging the wrong layer.

`npm run demo:warm` pre-generates the four scripted intents in `src/lib/intents.ts` so a rehearsal or demo makes zero live calls. It warns loudly if an intent lands on the fallback.

---

## Measured behaviour

Real calls against `us.anthropic.claude-haiku-4-5-20251001-v1:0`. Cold (cache-miss) latency to a rendered screen is **2.2–5.0s**; the response carries a measured `latencyMs` you can read in the SpecInspector. Repeat intents return from cache in 0ms with zero tokens.

The four scripted intents each compose a structurally different screen. Warm the cache and read the inspector rather than trusting a quoted number.

---

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/login` | `{email, password}` | `{user}` + `lm_token` httpOnly cookie |
| POST | `/api/auth/logout` | — | `{ok:true}`, clears cookie |
| GET | `/api/auth/me` | — | `{user}` or 401 |
| GET | `/api/data` | — | `{items: Item[]}` |
| POST | `/api/view` | `{intent}` | `{spec, source, provider, latencyMs, failureKind?, raw?}` |
| POST | `/api/view/refine` | `{instruction, intent, spec}` | same shape |
| GET | `/api/views` | — | `{views: SavedView[]}` |
| POST | `/api/views` | `{intent, spec}` | `{view}` |
| DELETE | `/api/views/[id]` | — | `{ok:true}` |

`source` is `"model" | "cache" | "fallback"`. `raw` (unvalidated model output) is included only when `NODE_ENV !== "production"` — it powers the SpecInspector. Auth is via the `lm_token` httpOnly cookie only; `middleware.ts` verifies it with `jose` and must never import Prisma (Edge runtime).

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:seed` | seed demo user + 85 items (offline, 0 tokens) |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:studio` | browse the database |
| `npm run demo:warm` | pre-generate the four scripted intents into `ViewSpecCache` |
| `npm run gemini:check` | call Gemini directly, bypassing the fallback, to see the real error |
| `npm run personas:merge` | rebuild `emails.json` from the persona corpora |

---

## Environment gotchas

- **`db:seed` needs `--env-file=.env`.** `prisma migrate` loads `.env` itself; `tsx` does not, so the seed script would start with an empty environment and die on a missing `DATABASE_URL`. The script already carries the flag — do not remove it.
- **Next is 15.5.7, not 16.x.** The npm proxy quarantines packages published within the last 7 days, so dependencies are pinned to versions it allows. `package.json` carries `overrides` for the same reason. **`plan.md` §2 describes a stack this repo does not have** — it diverges on nine packages, and the major gaps matter: zod is **3.25.76** (not 4.x) and recharts is **2.15.3** (not 3.x), with different APIs. The installed versions in `package.json` are the truth.
- **`next@15.5.7` carries a published security advisory.** Not a demo risk (nothing is internet-facing, auth is a seeded demo user), but real. Check whether a patched 15.x is reachable through the mirror before bumping.
- **`react@19.0.0` is listed in the registry but its tarball 404s** — pinned to 19.2.8.
- **Provider SDKs are lazily imported** and listed in `serverExternalPackages`. `@google/genai@1.5.0` declares `@modelcontextprotocol/sdk` as an *optional* peer dependency but imports it unconditionally, so it is an explicit dependency here. Eagerly importing `@google/genai` breaks the Next build and takes the Haiku path down with it.
- **`package-lock.json` mixes two registries.** 610 entries resolve from an internal Artifactory mirror and 66 from `registry.npmjs.org`. `npm ci` may fail on one machine or the other; a plain `npm install` re-resolves.
- **Recharts entry animation is disabled** (`isAnimationActive={false}`). Bars grow from zero width via `requestAnimationFrame`, so on a slow or headless first paint the chart rendered axes and labels with no bars at all.

---

## Docs

- [APP.md](APP.md) — feature inventory: all 15 block types, refinement, reliability, demo facts
- [plan.md](plan.md) — original architecture plan and work split (stale on versions and block count)
- [CLAUDE.md](CLAUDE.md) — conventions and demo-critical invariants
- [AGENTS.md](AGENTS.md) — ownership map and per-dev task briefs
- [PITCH.md](PITCH.md) — judge-facing pitch and demo script
- [bugs.MD](bugs.MD) / [flags.MD](flags.MD) — defect log and open risks
