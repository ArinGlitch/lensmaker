# CLAUDE.md — Lensmaker

Read `plan.md` before writing any code. It is the architecture contract. This file is the coding convention layer on top of it.

**What this app is:** the user states an intent; an LLM composes a screen as JSON (a "ViewSpec"); our React components render it. The LLM never writes code.

**Hackathon context:** ~6 hours, two devs working in parallel. Optimize for *working and demoable*, not for production hardening. But do not cut the reliability paths listed under "Never break these" — they are what the demo rests on.

---

## Hard rules (violating these breaks the other dev's work)

1. **`src/lib/viewspec.ts` is the single source of truth.** All ViewSpec types and Zod schemas live there and are imported from there. Never redefine a Block type locally, never duplicate the shape, never widen a type to make an error go away.
2. **The LLM never emits code.** No JSX, HTML, SQL, Prisma syntax, or component names outside the catalog. It returns a ViewSpec and nothing else.
3. **Never trust model output.** Every ViewSpec passes `ViewSpecSchema.safeParse()` before it reaches a component. Providers return `unknown` by design.
4. **No raw SQL, no `$queryRaw`.** Filters are the DSL in `lib/filters.ts`, compiled to Prisma `where` by our code.
5. **No filter/sort/column UI anywhere.** No dropdowns, no sort headers, no column pickers. The intent bar is the only input. This is the whole point of the project — if you're adding a `<select>`, stop.
6. **Field allowlist is enforced server-side.** Any field the model names must exist in the schema digest. Unknown field → drop that block, keep the rest.
7. **`/api/view` always returns a valid spec.** model → cache → fallback. It must never 500 and never return a spec that fails validation. The demo cannot crash.
8. **Auth via httpOnly cookie only.** Never localStorage, never a token in a response body, never `document.cookie`.
9. **`middleware.ts` must not import Prisma or any Node-only module.** Edge runtime. `jose` verify only.
10. **Pin the versions in `plan.md` §2.** Notably Prisma `6.19.3` (not 6.9.0) and `@google/genai` (not the deprecated `@google/generative-ai`).

---

## Never break these (demo-critical paths)

- Malformed model output → last-good spec → `buildFallbackSpec()`. Never an error screen.
- `insufficient_evidence: true` → `<EmptyState>`. Never fabricate data to fill a chart.
- Cache hit → zero LLM calls. Rehearsing must be free.
- Ablation toggle OFF → `<FixedDashboard>`; ON → `<Renderer>`. Both must work.
- Login with the seeded demo user must succeed in one click.

---

## Conventions

**TypeScript**
- `strict: true`. No `any` — use `unknown` and narrow. No non-null `!` on model-derived data.
- Types from Zod: `export type ViewSpec = z.infer<typeof ViewSpecSchema>`. Don't hand-write a parallel interface.
- Discriminated union on `block.type`. Handle every case; `default: return null`.

**Files & naming**
- Components: `PascalCase.tsx`. Libs: `camelCase.ts`.
- Block components: `src/components/blocks/<Type>Block.tsx`, default-exported.
- One block type per file.

**React / Next**
- App Router. Server Components by default; `"use client"` only where state/effects/handlers are needed.
- Blocks are **pure presentational client components**: props in, JSX out. No fetching, no Prisma, no LLM imports inside a block.
- Data fetching on the client goes through TanStack Query. No bare `useEffect` + `fetch`.
- Route handlers: `export async function POST(req: Request)`, return `Response.json(...)`.

**API**
- Errors: `Response.json({ error: "message" }, { status })`. Real status codes. Never 200-with-error.
- Read the session only via `getSession()` from `lib/auth.ts`. Never parse the cookie inline.
- Validate request bodies with Zod at the top of the handler.

**Styling**
- Tailwind utility classes inline. No CSS modules, no styled-components.
- Dark-ish neutral palette; blocks must be visually distinct from each other (see `plan.md` §10).
- Every block renders sensibly with 0 rows, 1 row, and 40 rows.

**Prisma**
- Import the singleton from `lib/db.ts`. Never `new PrismaClient()` in a route.
- Schema changes: edit `schema.prisma`, run a migration, tell the other dev.

---

## LLM provider rules

- One shared prompt in `src/lib/llm/prompt.ts`. Both providers send identical instructions; only transport differs.
- `generateViewSpec()` returns `{ spec: unknown, raw: string, latencyMs: number }`. A provider never validates its own output.
- Selection by `LLM_PROVIDER=haiku|gemini` in `llm/index.ts`. No provider-specific branching anywhere else in the codebase.
- **Build on Haiku, optimize for Gemini.** Gemini gets native `responseSchema`; Haiku uses a tool-definition to force JSON. Keep the Gemini path the better one.
- `temperature: 0.2` — same question should produce the same screen.
- One call per question. No agent loops, no multi-turn (multi-agent is saturated; it is not our novelty).
- Log every call's provider, latency, cache-hit status, and validation result. You will need this to debug at hour four.

---

## Token discipline (real constraint — Gemini budget is tight)

- **Never call the LLM in a loop or during seeding at demo time.** `prisma/fixtures/extracted.json` is committed; `seed.ts` reads it.
- Re-extraction is opt-in only: `SEED_RUN_EXTRACTION=1`.
- Develop against `LLM_PROVIDER=haiku` (unlimited). Switch to Gemini only for final rehearsal.
- Every ViewSpec is cached by `sha256(intent|provider|schemaVersion)`.
- If you're about to add a feature that calls the LLM more than once per user action, don't.

---

## Parallel work protocol

- **Assume the other dev's work is correct and complete.** If you need their component, import it and move on. If it doesn't exist yet, create a one-line placeholder — never rebuild their assigned file.
- Stay in your lane (`plan.md` §11). Dev B owns `src/components/**`; Dev A owns `src/lib/**`, `src/app/api/**`, `prisma/**`.
- Shared files (`viewspec.ts`, `catalog.ts`) are **Dev A only**. Dev B requests a change rather than editing.
- Small, frequent commits. Conventional commit messages (`feat:`, `fix:`, `chore:`).
- If a type mismatch appears, the contract in `viewspec.ts` wins — fix your side to match it.

---

## Definition of done for any task

- Typechecks (`npx tsc --noEmit`) with no new errors.
- Renders with 0, 1, and 40 rows without crashing.
- No `any`, no unused imports, no console noise left behind.
- Doesn't touch another dev's assigned files.
- For blocks: visually distinct from the other block types at a glance.

---

## Non-goals — do not build these

Gmail OAuth · multi-agent orchestration · chat drawer or chat UI of any kind · `.ics` export · unsubscribe automation · Redis · streaming, audio, or image generation · Tailwind config theming beyond defaults · tests beyond a smoke check (no time) · any dropdown/filter/sort control.
