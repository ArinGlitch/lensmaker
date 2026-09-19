# Lensmaker — Architecture & Work Plan

**One line:** You say what you care about. Gemini composes the screen. Your components render it.

**Theme fit:** Gemini is the I/O module — the *only* way data gets in (extraction from prose) and the *only* thing that decides what comes out (the layout). Remove Gemini and there is no interface, just a database and orphaned components. **There are no filter dropdowns, no sort buttons, no column pickers anywhere in this app.** If you are about to build one, stop — you are solving the wrong problem.

---

## 1. Core mechanism

Three inputs go to the model:

1. **Intent** — the user's sentence (`"what's about to charge me?"`)
2. **Schema digest** — a compact description of available fields
3. **Component catalog** — the block types the model may use

The model returns **only a ViewSpec** — JSON describing a screen. It never emits JSX, HTML, SQL, or Prisma syntax.

```
intent ──┐
schema ──┼──► LLM ──► ViewSpec (JSON) ──► Zod validate ──► <Renderer> ──► screen
catalog ─┘                                     │
                                          invalid → last-good spec
```

The renderer is a `switch` over `block.type`. Unknown type → renders nothing. That switch is the security boundary: the model cannot introduce anything that was not hand-built.

### Two pipelines

| | Pipeline A — INGEST | Pipeline B — LAYOUT |
|---|---|---|
| Role | Gemini as **input** | Gemini as **output** |
| When | Once, offline, via `seed.ts` | Live, per question |
| Flow | messy prose → structured rows | intent → ViewSpec |
| Cost | Zero at demo time (pre-computed) | ≤5 calls per demo |
| Cached in | Committed JSON fixture | `ViewSpecCache` table |

Pipeline A is why we can claim "no forms": nobody ever typed structured data. The model extracted it from unstructured email text.

---

## 2. Stack (versions verified against npm 2026-09-19 — pin these exactly)

| Package | Version | Notes |
|---|---|---|
| next | `16.3.5` | App Router |
| react / react-dom | `19.x` | as shipped with Next 16 |
| typescript | `5.x` | strict mode on |
| prisma / @prisma/client | `6.19.3` | **newest 6.x.** NOT 6.9.0 — `npm view prisma@6` misreports |
| postgres | `16-alpine` | Docker, host port **5434** |
| @tanstack/react-query | `5.103.1` | client-side cache |
| zod | `4.6.5` | ViewSpec validation |
| jose | `6.2.12` | JWT sign/verify (works in Edge middleware; `jsonwebtoken` does not) |
| recharts | `3.10.1` | bar chart |
| tailwindcss | `4.3.3` | styling |
| tsx | `4.23.13` | runs `seed.ts` |
| @google/genai | `2.23.0` | Gemini provider. NOT `@google/generative-ai` — that package is deprecated |

**Host port 5434, not 5432.** Ports 5432 and 5433 are already bound by SSH tunnels on the dev machine. Compose maps `5434:5432`.

---

## 3. Repo layout

```
lensmaker/
├─ docker-compose.yml
├─ Dockerfile
├─ plan.md  CLAUDE.md  AGENTS.md
├─ prisma/
│  ├─ schema.prisma
│  ├─ seed.ts                    # Pipeline A entrypoint
│  └─ fixtures/emails.json       # raw messy emails (committed)
│  └─ fixtures/extracted.json    # post-LLM rows (committed, so seed is offline)
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx  page.tsx  providers.tsx
│  │  ├─ login/page.tsx
│  │  └─ api/
│  │     ├─ auth/login/route.ts
│  │     ├─ auth/logout/route.ts
│  │     ├─ auth/me/route.ts
│  │     ├─ view/route.ts         # POST intent → ViewSpec
│  │     ├─ data/route.ts         # GET rows
│  │     ├─ views/route.ts        # GET list / POST save
│  │     └─ views/[id]/route.ts   # DELETE
│  ├─ middleware.ts               # JWT gate
│  ├─ lib/
│  │  ├─ auth.ts                  # jose sign/verify, cookie helpers
│  │  ├─ db.ts                    # Prisma singleton
│  │  ├─ viewspec.ts              # Zod schemas — THE CONTRACT
│  │  ├─ catalog.ts               # block catalog + schema digest
│  │  ├─ filters.ts               # filter DSL → Prisma where
│  │  ├─ aggregate.ts             # sum/count/avg/min/max
│  │  ├─ fallback.ts              # deterministic spec when model fails
│  │  └─ llm/
│  │     ├─ types.ts              # LLMProvider interface
│  │     ├─ prompt.ts             # shared prompt builder
│  │     ├─ gemini.ts             # Gemini provider
│  │     └─ index.ts              # env-based selection
│  └─ components/
│     ├─ Renderer.tsx             # the switch
│     ├─ IntentBar.tsx
│     ├─ AblationToggle.tsx
│     ├─ SpecInspector.tsx
│     ├─ SavedViews.tsx
│     ├─ FixedDashboard.tsx       # ablation OFF state
│     ├─ EmptyState.tsx
│     └─ blocks/
│        ├─ StatBlock.tsx  CardsBlock.tsx  BarBlock.tsx
│        ├─ TimelineBlock.tsx  ListBlock.tsx  CalloutBlock.tsx
│        └─ TableBlock.tsx
└─ .env.example
```

---

## 4. The ViewSpec contract (single source of truth: `src/lib/viewspec.ts`)

**Both devs code against this. Do not change it without telling the other dev.**

```ts
// Filter DSL — model emits this, never SQL
FilterOp   = "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "contains" | "in"
Filter     = { field: string; op: FilterOp; value: string|number|boolean|Array<string|number> }
Agg        = "sum" | "count" | "avg" | "min" | "max"
Format     = "currency" | "number" | "percent" | "date" | "relativeDays" | "text"

BlockBase  = { id: string; title?: string; filters?: Filter[] }

StatBlock     = BlockBase & { type:"stat";     label:string; agg:Agg; field:string; format?:Format; emphasis?:"low"|"normal"|"high" }
CardsBlock    = BlockBase & { type:"cards";    primary:string; secondary?:string; badge?:string; sortBy?:string; dir?:"asc"|"desc"; limit?:number(1-24) }
BarBlock      = BlockBase & { type:"bar";      groupBy:string; agg:Agg; field?:string; format?:Format; limit?:number(1-12) }
TimelineBlock = BlockBase & { type:"timeline"; dateField:string; primary:string; secondary?:string; dir?:"asc"|"desc"; limit?:number(1-20) }
ListBlock     = BlockBase & { type:"list";     primary:string; secondary?:string; sortBy?:string; dir?:"asc"|"desc"; limit?:number(1-20) }
TableBlock    = BlockBase & { type:"table";    columns:string[](1-6); sortBy?:string; dir?:"asc"|"desc"; limit?:number(1-25) }
CalloutBlock  = BlockBase & { type:"callout";  tone:"info"|"warn"|"danger"; message:string }

ViewSpec = {
  title: string
  intent_echo: string              // model restates the question it answered
  blocks: Block[]                  // 1..5
  confidence: "low" | "medium" | "high"
  insufficient_evidence: boolean   // true → render EmptyState, not a fake chart
  notes?: string
}
```

### Validation rules (enforced server-side in `/api/view`, never trusted from the model)

1. `ViewSpecSchema.safeParse()` — malformed → serve last-good spec, then `buildFallbackSpec()`.
2. **Field allowlist** — every `field`/`groupBy`/`dateField`/`sortBy`/`columns` entry must exist in the schema digest. Unknown field → **drop that block, keep the rest**. If all blocks drop → fallback spec.
3. Filters compiled to Prisma `where` by `filters.ts`. **No raw SQL path exists in this codebase.**
4. `agg` and `format` are enums; free text rejected by Zod.
5. `insufficient_evidence: true` → render `<EmptyState>`. Never invent data.
6. Cache key = `sha256(intent + provider + schemaVersion)` → `ViewSpecCache`. Hit = zero tokens.

---

## 5. Data model (`prisma/schema.prisma`)

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String              // bcrypt hash
  createdAt DateTime @default(now())
  savedViews SavedView[]
}

model Item {                    // one extracted email/charge
  id            String   @id @default(cuid())
  vendor        String
  subject       String
  category      String          // subscription | deadline | receipt | security | general
  amount        Float?
  currency      String   @default("CAD")
  chargeDate    DateTime?
  deadlineDate  DateTime?
  receivedAt    DateTime
  summary       String          // LLM-written, 1 sentence
  urgency       String          // low | medium | high
  isSuspicious  Boolean  @default(false)
  riskReason    String?
  sourceExcerpt String          // proof for "extracted, not typed"
  createdAt     DateTime @default(now())
  @@index([category]) @@index([chargeDate]) @@index([deadlineDate])
}

model SavedView {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields:[userId], references:[id], onDelete: Cascade)
  intent    String
  spec      Json
  pinned    Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
}

model ViewSpecCache {
  id        String   @id @default(cuid())
  key       String   @unique   // sha256(intent|provider|schemaVersion)
  intent    String
  provider  String
  spec      Json
  createdAt DateTime @default(now())
}
```

`sourceExcerpt` matters for the pitch: it lets you show the original messy sentence next to the structured field the model pulled from it.

---

## 6. API endpoints

| Method | Path | Auth | Body / Query | Returns |
|---|---|---|---|---|
| POST | `/api/auth/login` | no | `{email, password}` | `{user:{id,email}}` + sets `lm_token` httpOnly cookie |
| POST | `/api/auth/logout` | no | — | `{ok:true}`, clears cookie |
| GET | `/api/auth/me` | yes | — | `{user:{id,email}}` or 401 |
| GET | `/api/data` | yes | `?category=&limit=` | `{items: Item[], schemaDigest}` |
| POST | `/api/view` | yes | `{intent: string, ablation?: boolean}` | `{spec, source:"model"\|"cache"\|"fallback", provider, latencyMs, raw?}` |
| GET | `/api/views` | yes | — | `{views: SavedView[]}` |
| POST | `/api/views` | yes | `{intent, spec}` | `{view: SavedView}` |
| DELETE | `/api/views/[id]` | yes | — | `{ok:true}` (404 if not owner) |

**Contract rules**
- Errors: `{error: string}` with a real HTTP status. Never 200-with-error.
- `/api/view` **always returns a valid spec** — model → cache → fallback. It must never 500 on a bad model response. The demo cannot crash.
- `raw` (unvalidated model output) is included only when `NODE_ENV !== "production"` — powers SpecInspector.
- All auth via `lm_token` httpOnly cookie. No tokens in localStorage.

---

## 7. Auth (must work first — both devs are blocked without it)

Deliberately basic, but correct:

- `POST /api/auth/login` → look up user, `bcrypt.compare`, sign JWT with `jose` (HS256, 7d), set cookie `lm_token` — `httpOnly`, `sameSite:"lax"`, `path:"/"`, `secure` in prod.
- `middleware.ts` matches `/`, `/views`, `/api/data`, `/api/view`, `/api/views/:path*`. Verifies JWT. No/invalid token → redirect to `/login` (pages) or 401 JSON (api routes).
- `getSession()` in `lib/auth.ts` is the only way route handlers read the user. **Never parse the cookie manually in a route.**
- Seeded demo user: `demo@lensmaker.app` / `demo1234`. Login page pre-fills it — nobody should be typing a password on stage.

**Middleware must not import Prisma.** Edge runtime; `jose` verify only.

---

## 8. LLM provider abstraction

```ts
// src/lib/llm/types.ts
export interface LLMProvider {
  name: "gemini" | "gemini"
  generateViewSpec(input: {
    intent: string
    schemaDigest: SchemaDigest
    catalog: CatalogEntry[]
  }): Promise<{ spec: unknown; raw: string; latencyMs: number }>
}
```

Selected by `LLM_PROVIDER=gemini`. Returns **`unknown`** on purpose — the caller validates. A provider never validates its own output.

**Build on Gemini, optimize for Gemini.** The prompt lives in one shared file (`prompt.ts`) so both providers send identical instructions. Differences are confined to the transport:

- **Gemini** (`@google/genai`): `responseMimeType: "application/json"` + `responseSchema` (native structured output — strictly better than Gemini's tool hack, which is why we optimize for it). Default `gemini-3.8-flash`; `GEMINI_MODEL` env allows swapping to a Pro model if tokens are purchased.

**Gemini-specific optimizations to build in from the start:**
- `responseSchema` mirrors the Zod ViewSpec exactly (generate from Zod where practical).
- `temperature: 0.2` — layout choice should be near-deterministic; same question → same screen.
- `thinkingBudget: 0` on Flash for latency (layout choice needs no deep reasoning).
- Keep the prompt under ~1.5k tokens; the catalog is the bulk, so describe blocks tersely.
- One call per question. No multi-turn, no agent loop — **multi-agent orchestration is saturated and is not our novelty.**

---

## 9. Token budget (non-negotiable — assume the pessimistic free tier)

Third-party sources disagree wildly on Gemini free-tier limits (~20/day vs ~1500/day). **Verify at https://aistudio.google.com/rate-limit and design for the worst case.**

Therefore:
1. **Pipeline A never runs live.** `extracted.json` is committed; `seed.ts` reads it. Re-extraction is opt-in via `SEED_RUN_EXTRACTION=1`.
2. **Every ViewSpec is cached** by intent hash. Rehearsing the demo costs zero tokens after the first run.
3. Dev happens **entirely on Gemini**. Gemini is touched only for final rehearsal.
4. Demo has **4 scripted intents** → ≤5 live calls worst case, 0 if cache is warm.

---

## 10. The demo (90 seconds — build toward exactly this)

1. Ablation **OFF** → fixed hand-built dashboard. *"This is what every app gives you."*
2. Flip **ON**, ask *"what's about to charge me?"* → stat + cards assemble.
3. Ask *"what are my hard deadlines?"* → previous view **vanishes**, timeline appears.
4. Ask *"what's trying to scam me?"* → danger callout + flagged list.
5. Ask something unanswerable → EmptyState. *"It tells you when it doesn't know."*
6. Open SpecInspector. *"That's the JSON Gemini wrote. It never wrote a line of code."*

**Design requirement:** blocks must look *obviously* different from each other. Three near-identical tables = judges shrug. A number, a card grid, a bar chart, and a timeline = three visibly different screens.

---

## 11. Work split

Dev A runs sub-agents and takes the architectural core and anything with cross-cutting risk. Dev B takes well-isolated leaf components with fixed inputs — every Dev B task can be built against the ViewSpec type alone, with no knowledge of how the spec was produced.

### Dev A (you) — foundation, contracts, AI, auth, integration

**A0 — Scaffold & contracts (do first; unblocks everyone)**
- Next 16 app, TS strict, Tailwind 4, Docker Compose (pg on 5434), Dockerfile, `.env.example`
- `prisma/schema.prisma`, first migration
- **`src/lib/viewspec.ts`** — Zod schemas + exported TS types (the contract)
- **`src/lib/catalog.ts`** — block catalog + `SchemaDigest`
- Commit and push immediately. Dev B is blocked until `viewspec.ts` exists.

**A1 — Auth (must work before anything else is testable)**
- `lib/auth.ts` (jose sign/verify, cookie helpers, `getSession()`)
- `middleware.ts` JWT gate
- `/api/auth/login`, `/logout`, `/me`
- Seeded demo user + pre-filled login page

**A2 — Data layer**
- `lib/db.ts` Prisma singleton
- `lib/filters.ts` filter DSL → Prisma `where` (allowlist enforced)
- `lib/aggregate.ts` sum/count/avg/min/max
- `/api/data`

**A3 — LLM layer**
- `llm/types.ts`, `llm/prompt.ts`, `llm/gemini.ts`, `llm/gemini.ts`, `llm/index.ts`
- Gemini `responseSchema` generated to match Zod exactly

**A4 — The `/api/view` brain**
- Cache lookup → provider call → Zod validate → allowlist prune → fallback
- `lib/fallback.ts` deterministic spec
- Guarantee: **always returns a valid spec, never 500s**

**A5 — Renderer + page integration**
- `components/Renderer.tsx` (the switch)
- `app/page.tsx` wiring IntentBar → `/api/view` → Renderer, TanStack Query
- `app/providers.tsx` QueryClientProvider

**A6 — Pipeline A ingest**
- `prisma/fixtures/emails.json` — 30–40 realistically messy synthetic emails (deadline buried at the bottom, trial-expiry notices, one phishing attempt, receipts)
- `prisma/seed.ts` — reads `extracted.json` by default; `SEED_RUN_EXTRACTION=1` re-runs the LLM
- Commit `extracted.json`

**A7 — Saved views (write-back)**
- `/api/views` GET/POST, `/api/views/[id]` DELETE

**A8 — Integration, demo hardening, README**
- Warm the cache for the 4 scripted intents
- Verify ablation toggle, verify demo script end-to-end

### Dev B — presentation layer (isolated, contract-driven)

Every task below takes `Block` props + `Item[]` and renders. **No API calls, no Prisma, no LLM code.** Import types from `src/lib/viewspec.ts` and assume they are correct.

**B1 — `blocks/StatBlock.tsx`** — big number + label; honors `format`, `emphasis`
**B2 — `blocks/CardsBlock.tsx`** — responsive grid; `primary`/`secondary`/`badge`, sort, limit
**B3 — `blocks/BarBlock.tsx`** — Recharts bar; `groupBy` + `agg`; readable at 6+ categories
**B4 — `blocks/TimelineBlock.tsx`** — vertical chronological; days-remaining badge
**B5 — `blocks/ListBlock.tsx`** + **`blocks/CalloutBlock.tsx`** — compact ranked list; tone-coloured callout
**B6 — `blocks/TableBlock.tsx`** — renders only `columns` it's given
**B7 — `components/IntentBar.tsx`** — text input, submit on Enter, loading state, 4 example-intent chips (the demo script). Calls an `onSubmit(intent)` prop only.
**B8 — `components/EmptyState.tsx`** — honest "not enough data" state, shows `notes`
**B9 — `components/AblationToggle.tsx`** + **`components/FixedDashboard.tsx`** — the deliberately plain dashboard for OFF
**B10 — `components/SpecInspector.tsx`** — slide-over drawer, pretty-printed spec JSON, copy button
**B11 — `components/SavedViews.tsx`** — gallery of saved views; `onLoad`/`onDelete` props only
**B12 — `app/login/page.tsx`** — login form, pre-filled demo creds, posts to `/api/auth/login`

**Visual mandate for Dev B:** the four P0 blocks must be *visually distinct at a glance*. That distinctness is the demo.

---

## 12. Build order (parallel-safe)

```
A0 scaffold + viewspec.ts + catalog.ts   ← PUSH IMMEDIATELY, unblocks Dev B
      │
      ├── Dev A: A1 auth → A2 data → A3 llm → A4 /api/view → A5 renderer → A6 seed → A7 views → A8 harden
      │
      └── Dev B: B1..B6 blocks → B7 IntentBar → B8 EmptyState → B9 ablation → B12 login → B10 inspector → B11 saved
```

Dev B never waits on Dev A past A0. Dev A stubs any missing Dev B component with a one-line placeholder so integration is never blocked either.

---

## 13. User stories

**Auth**
- As a demo user, I log in with pre-filled credentials and land on the main page with one click. *(A1, B12)*
- As an unauthenticated visitor, any protected page redirects me to `/login`, and protected APIs return 401 JSON. *(A1)*
- As a logged-in user, my session survives a refresh via httpOnly cookie. *(A1)*

**Core generative loop**
- As a user, I type an intent and within ~2s see a screen composed for that intent. *(A4, A5, B7)*
- As a user, asking a different intent replaces the layout with a structurally different one — not a re-filtered version of the same one. *(A4, B1–B4)*
- As a user, if the model returns something invalid, I still see a usable screen and never an error page. *(A4, `fallback.ts`)*
- As a user, when my question can't be answered from the data, I'm told so plainly instead of shown a fabricated chart. *(A4, B8)*

**Credibility / judging**
- As a judge, I toggle generative mode off and see the fixed dashboard, proving what the model contributes. *(B9)*
- As a judge, I open the inspector and read the exact JSON the model produced. *(B10, A4 `raw`)*
- As a judge, I can see the original messy email text beside the structured fields extracted from it. *(A6 `sourceExcerpt`)*

**Persistence**
- As a user, I save a generated view and reload it later from a gallery. *(A7, B11)*
- As a user, re-asking a previous question returns instantly and costs no tokens. *(A4 cache)*

**Ops**
- As a dev, `docker compose up` gives me a working app with seeded data and no manual steps. *(A0, A6)*
- As a dev, I switch Gemini→Gemini by changing one env var. *(A3)*

---

## 14. Definition of done

- [ ] `docker compose up` → working app, seeded, demo user logs in
- [ ] Four scripted intents each produce a *visibly different* layout
- [ ] Malformed model output never breaks the screen (test by forcing garbage)
- [ ] `insufficient_evidence` path renders EmptyState
- [ ] Ablation toggle works both ways
- [ ] SpecInspector shows real model JSON
- [ ] Saved views persist and reload
- [ ] `LLM_PROVIDER=gemini` works with a real key
- [ ] Zero live LLM calls needed to run the demo with a warm cache
- [ ] No form controls anywhere that filter, sort, or select columns

---

## 15. Explicit non-goals

Do not build: Gmail OAuth (verification takes weeks; fixtures are strictly better for a demo), multi-agent orchestration (saturated — not our novelty), a chat drawer (scores against "break the text box"), `.ics` export, unsubscribe automation, Redis, streaming/audio/image generation (no free tier, and Gemini can't substitute), real auth hardening beyond the basics, or any dropdown/filter UI.
