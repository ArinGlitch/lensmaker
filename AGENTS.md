# AGENTS.md — Who builds what

Read `plan.md` (architecture) and `CLAUDE.md` (conventions) first. This file assigns the work.

**Golden rule for parallel work:** assume the other dev's files already exist and are correct. Import them. If something is missing, stub it in one line — never rebuild a file assigned to someone else.

---

## Ownership map

| Path | Owner | Notes |
|---|---|---|
| `prisma/**` | **A** | schema, migrations, seed, fixtures |
| `src/lib/viewspec.ts` | **A** | THE CONTRACT — B must not edit |
| `src/lib/catalog.ts` | **A** | block catalog + schema digest — B must not edit |
| `src/lib/**` (rest) | **A** | auth, db, filters, aggregate, fallback, llm |
| `src/app/api/**` | **A** | all route handlers |
| `src/middleware.ts` | **A** | edge JWT gate |
| `src/app/page.tsx` | **A** | main page wiring |
| `src/app/providers.tsx` | **A** | TanStack provider |
| `src/components/Renderer.tsx` | **A** | the switch |
| `src/components/blocks/**` | **B** | all block components |
| `src/components/*.tsx` (rest) | **B** | IntentBar, EmptyState, AblationToggle, FixedDashboard, SpecInspector, SavedViews |
| `src/app/login/page.tsx` | **B** | login form |
| Docker, config | **A** | compose, Dockerfile, env |

Conflict rule: if a type mismatch appears, `viewspec.ts` wins. Fix your side.

### The one file both devs touch — collision protocol

`src/app/page.tsx` is owned by **A** but imports almost everything **B** builds. To keep this conflict-free:

1. **Dev A writes every import up front, before Dev B delivers**, pointing at the real final paths.
2. **Dev A creates a one-line placeholder for each undelivered B component** on first scaffold, e.g.
   ```tsx
   // src/components/IntentBar.tsx — PLACEHOLDER, owned by Dev B, do not flesh out
   export default function IntentBar(_: any) { return null }
   ```
3. **Dev B replaces the placeholder body.** The file path, the default export, and the props contract in `AGENTS.md` are fixed — B must not rename the file or change the exported symbol.
4. **Dev A never edits a B component's body.** If a placeholder is wrong, A fixes `page.tsx` or asks B — A does not implement B's component.

Because every placeholder already exists with the correct name and path, both devs can work without ever editing the same lines. `page.tsx` changes only on A's side; component bodies change only on B's side.

### Props contracts are frozen at A0

The prop signatures in the Dev B briefs below are a **contract, not a suggestion**. Dev A codes `page.tsx` against them immediately; Dev B implements to them. Neither dev changes a prop name without telling the other, because that silently breaks the other's file.

---

## Dev A — architecture, AI, auth, integration

Dev A runs sub-agents and takes everything with cross-cutting risk. Tasks are ordered; A0 must ship first.

### A0 — Scaffold & contracts ⚠️ BLOCKS DEV B — push immediately
- Next 16.3.5 App Router, TS strict, Tailwind 4
- `docker-compose.yml` (postgres 16-alpine, host port **5434** — 5432/5433 are taken by SSH tunnels), `Dockerfile`, `.env.example`
- `prisma/schema.prisma` per `plan.md` §5 + first migration
- **`src/lib/viewspec.ts`** — Zod schemas + inferred types for all 7 block types and `ViewSpec`
- **`src/lib/catalog.ts`** — `CatalogEntry[]` describing each block for the prompt, plus `SchemaDigest` (field names, types, example values)
- **Placeholder files for all 12 Dev B components** — correct path, correct default-export name, `return null` body, and a comment marking them as B-owned. This is what lets both devs work without touching the same lines.
- Commit and push. Tell Dev B it's ready.

### A1 — Auth (do before anything else is testable)
- `src/lib/auth.ts` — `signToken`, `verifyToken` (jose HS256, 7d), `setAuthCookie`, `clearAuthCookie`, `getSession()`
- `src/middleware.ts` — gate `/`, `/views`, `/api/data`, `/api/view`, `/api/views/:path*`. Pages → redirect `/login`; APIs → 401 JSON. **No Prisma import.**
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- Cookie `lm_token`: httpOnly, sameSite lax, path `/`, secure in prod
- Seed demo user `demo@lensmaker.app` / `demo1234` (bcrypt)

### A2 — Data layer
- `src/lib/db.ts` — Prisma singleton (globalThis pattern)
- `src/lib/filters.ts` — `compileFilters(filters, allowedFields)` → Prisma `where`. Unknown field throws; caller drops the block.
- `src/lib/aggregate.ts` — `sum|count|avg|min|max` over `Item[]`, plus `groupAndAggregate` for BarBlock
- `GET /api/data` → `{ items, schemaDigest }`

### A3 — LLM layer
- `src/lib/llm/types.ts` — `LLMProvider` interface (returns `unknown` spec)
- `src/lib/llm/prompt.ts` — one shared prompt builder; terse catalog description, ~1.5k tokens max
- `src/lib/llm/gemini.ts` — `@google/genai`, `responseMimeType: "application/json"` + `responseSchema` mirroring the Zod contract; `temperature: 0.2`; `thinkingBudget: 0`; model from `GEMINI_MODEL` (default `gemini-3.8-flash`)
- `src/lib/llm/index.ts` — select on `LLM_PROVIDER`

### A4 — `/api/view` (the brain)
Order of operations, exactly:
1. Validate body `{ intent, ablation? }` with Zod
2. Cache lookup on `sha256(intent|provider|schemaVersion)` → hit returns `source:"cache"`
3. Provider call → `raw` string
4. `ViewSpecSchema.safeParse()` → fail → last-good → `buildFallbackSpec()`
5. Prune blocks naming unknown fields; all pruned → fallback
6. Write to `ViewSpecCache`
7. Return `{ spec, source, provider, latencyMs, raw? }` (`raw` only when `NODE_ENV !== "production"`)
- `src/lib/fallback.ts` — deterministic sensible spec (stat + cards)
- **Must never 500.** Force garbage from the provider and confirm the screen still renders.

### A5 — Renderer + page integration
- `src/components/Renderer.tsx` — switch over `block.type`, `default: return null`
- `src/app/providers.tsx` — QueryClientProvider
- `src/app/page.tsx` — IntentBar → `useMutation` → Renderer; holds ablation state; mounts SpecInspector + SavedViews
- Stub any missing Dev B component in one line so integration never blocks

### A6 — Pipeline A (ingest)
- `prisma/fixtures/emails.json` — 30–40 synthetic messy emails: trial-expiry notices, a 500-word corporate email with the deadline in the last paragraph, receipts with amounts, one phishing attempt, marketing noise. Vary vendors, dates, amounts, categories.
- `prisma/seed.ts` — creates demo user; reads `fixtures/extracted.json` and inserts `Item` rows. Only re-runs the LLM when `SEED_RUN_EXTRACTION=1`.
- Commit `extracted.json` so seeding is offline and free.

### A7 — Saved views (write-back)
- `GET /api/views`, `POST /api/views`, `DELETE /api/views/[id]` (404 if not owner)

### A8 — Integration & demo hardening
- Warm the cache for the 4 scripted intents
- Walk the full `plan.md` §10 script; fix whatever breaks
- README with run instructions and the provider switch
- Verify `plan.md` §14 checklist

---

## Dev B — presentation layer

**Every task is self-contained.** Import types from `src/lib/viewspec.ts` and assume they're correct. **No API calls, no Prisma, no LLM code, no data fetching** — props in, JSX out. Parent components pass `items` and handlers.

Shared props shape:
```ts
import type { StatBlock, Item } from "@/lib/viewspec"
export default function StatBlockView({ block, items }: { block: StatBlock; items: Item[] }) { ... }
```

Every component must render sensibly with **0, 1, and 40 items**.

### B1 — `blocks/StatBlock.tsx`
Big number + label. Applies `block.agg` over `block.field`. Honors `format` (currency/number/percent/date/relativeDays/text) and `emphasis` (low/normal/high → size + colour). 0 items → show `—`, not `NaN`.

### B2 — `blocks/CardsBlock.tsx`
Responsive grid (1/2/3 cols). Each card: `primary` bold, `secondary` muted, `badge` as a pill top-right. Honors `sortBy`, `dir`, `limit`. Truncate long text, never overflow.

### B3 — `blocks/BarBlock.tsx`
Recharts horizontal or vertical bar. Groups by `block.groupBy`, aggregates `block.field` with `block.agg`. Readable with 6+ categories (rotate or truncate labels). Respects `limit`. 0 items → empty message, not a broken chart.

### B4 — `blocks/TimelineBlock.tsx`
Vertical chronological list along a line/rail. Uses `dateField`; shows a days-remaining badge (overdue = red, ≤7d = amber, else neutral). Honors `dir`, `limit`. **Must look nothing like CardsBlock** — this visual contrast is the demo.

### B5 — `blocks/ListBlock.tsx` + `blocks/CalloutBlock.tsx`
List: compact ranked rows, `primary` + `secondary`, numbered. Callout: single message box coloured by `tone` (info/warn/danger) with an icon.

### B6 — `blocks/TableBlock.tsx`
Renders **only** the columns in `block.columns` (1–6). Honors `sortBy`, `dir`, `limit`. Horizontal scroll on narrow screens; never breaks page layout.

### B7 — `components/IntentBar.tsx`
Large text input, placeholder "What do you want to see?". Submit on Enter and via button. Loading state while pending. Four clickable example chips:
- "what's about to charge me?"
- "what are my hard deadlines?"
- "what's trying to scam me?"
- "what am I spending most on?"

Props: `{ onSubmit: (intent: string) => void; isLoading: boolean }`. **No fetching inside.**

### B8 — `components/EmptyState.tsx`
Honest "I can't answer that from this data" panel. Shows `notes` when provided. Calm and deliberate, not an error — this is a feature. Props: `{ notes?: string; intent?: string }`.

### B9 — `components/AblationToggle.tsx` + `components/FixedDashboard.tsx`
Toggle labelled "Generative UI: ON / OFF". Props `{ enabled: boolean; onChange: (v: boolean) => void }`.
FixedDashboard: deliberately plain, frozen layout — a static table plus two fixed stat boxes, ignoring intent entirely. It should look like every other app. That contrast is the point; don't make it pretty.

### B10 — `components/SpecInspector.tsx`
Slide-over drawer, right side. Pretty-printed JSON with syntax highlighting (or a styled `<pre>`), a copy button, and metadata (provider, latency, source: model/cache/fallback). Props: `{ spec: unknown; meta: {...}; open: boolean; onClose: () => void }`.

### B11 — `components/SavedViews.tsx`
Gallery of saved views: title, intent, relative time, block-type chips. Props: `{ views: SavedViewSummary[]; onLoad: (id) => void; onDelete: (id) => void }`. **No fetching.**

### B12 — `app/login/page.tsx`
Centred card. Email + password **pre-filled** with `demo@lensmaker.app` / `demo1234`. Posts to `/api/auth/login`, redirects to `/` on success, shows inline error on failure. One click to log in — nobody types a password on stage.

---

## Dev B visual mandate

The four P0 blocks — **Stat, Cards, Bar, Timeline** — must be *instantly distinguishable*. If three intents produce three similar-looking screens, the demo fails no matter how good the backend is.

- Stat: one huge number, lots of whitespace
- Cards: grid of boxes
- Bar: a chart
- Timeline: a vertical rail with dates

Different shapes, different densities, different visual rhythm.

---

## Handoff & sequencing

```
PHASE 0 — SERIAL (~30-45 min). Dev B cannot start.
  Dev A: A0 scaffold + viewspec.ts + catalog.ts + B placeholders ──► PUSH
  Dev B: read plan.md / CLAUDE.md / AGENTS.md; set up env; decide visual
         language for the 4 P0 blocks (shape, density, colour) on paper

PHASE 1 — FULLY PARALLEL (rest of the build). No further blocking.
  Dev A: A1 auth → A2 data → A3 llm → A4 /api/view → A5 renderer+page
         → A6 seed → A7 views → A8 harden
  Dev B: B1 Stat → B2 Cards → B3 Bar → B4 Timeline → B7 IntentBar
         → B8 EmptyState → B9 ablation → B12 login → B5/B6 → B10 → B11
```

**Why Phase 0 is serial:** every Dev B file begins with `import type { ... } from "@/lib/viewspec"`. Without the contract nothing compiles. This is the only blocking dependency in the build — get A0 pushed fast and it costs ~30 minutes of one dev's time, not two.

**Integration cadence:** Dev B pushes each component as it's finished. Dev A pulls before touching `page.tsx`. Because placeholders already exist with final names and props, a `git pull` upgrades a `null` placeholder into a real component with no code change on A's side.

**First joint checkpoint:** as soon as A4 (`/api/view`) and B1–B4 (four blocks) are both in, run the demo script end-to-end. That is the moment you find out whether the layouts actually look different. Do not defer this to the last hour.

Dev B's priority order matters: **B1–B4 first** (the four P0 blocks), then IntentBar, EmptyState, ablation, login. B5/B6/B10/B11 are valuable but cuttable if time runs short.

Dev A integrates continuously and stubs anything not yet delivered.
