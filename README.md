# Lensmaker

State what you care about. The model composes the screen.

There are no filter dropdowns, no sort buttons, and no column pickers in this app. The only input is an intent sentence. The model returns a validated JSON **ViewSpec** describing which blocks to render and how to configure them; hand-written React components render it. The model never writes code.

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

### Provider switch

Development runs on Bedrock Haiku (unlimited quota); the production target is Gemini.

```bash
# dev — requires an active `bedrock` SSO session
LLM_PROVIDER=haiku
AWS_PROFILE=bedrock

# demo
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.8-flash
```

If the Bedrock session expires: `aws sso login --profile bedrock`.

The seam is clean because the hot loop is text → structured JSON on both sides. Gemini uses native `responseSchema`; Haiku forces the same schema through a tool definition. One shared prompt, one Zod validator.

---

## How it works

```
intent ──┐
schema ──┼──► LLM ──► ViewSpec (JSON) ──► Zod ──► prune ──► <Renderer> ──► screen
catalog ─┘                                 │
                                      invalid → fallback spec
```

Two pipelines:

| | Pipeline A — ingest | Pipeline B — layout |
|---|---|---|
| Role | model as **input** | model as **output** |
| When | once, offline (`seed.ts`) | live, per intent |
| Flow | messy email prose → structured rows | intent → ViewSpec |
| Cost | zero tokens (committed fixture) | 1 call, then cached |

Pipeline A is why there are no forms: nobody typed the structured data, the model extracted it from prose. `Item.sourceExcerpt` keeps the original sentence so you can show the extraction side by side.

### Reliability

`/api/view` **always returns a valid spec** — cache → model → fallback. It never 500s, verified with no credentials present.

1. Zod validates every spec before it reaches React.
2. Field allowlist: any block naming a field outside `catalog.ts` is dropped; the rest still renders.
3. Filters are a restricted DSL (`{field, op, value}`) compiled to Prisma `where` by our code. There is no `$queryRaw` in this codebase and the model never emits SQL.
4. Duplicate block types are removed — visual variety is the product.
5. `insufficient_evidence: true` renders an honest empty state rather than a fabricated chart.
6. Specs are cached on `sha256(intent|provider|schemaVersion)`, so rehearsing costs nothing.

The `Renderer` switch is the security boundary: an unknown block type renders nothing, so the model cannot introduce a component that was not hand-built.

---

## Verified behaviour

Real calls against `us.anthropic.claude-haiku-4-5-20251001-v1:0`:

| Intent | Composed layout | Latency |
|---|---|---|
| what's about to charge me? | stat + timeline + bar | 3.6s |
| what are my hard deadlines? | timeline | 2.7s |
| what am I spending most on? | stat + bar | 2.7s |
| what's trying to scam me? | stat + callout + cards | 3.7s |
| how many kittens do I own? | callout, `insufficient_evidence` | 2.9s |

Repeat intents return from cache in 0ms.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:seed` | seed demo user + 29 items (offline, 0 tokens) |
| `npm run db:studio` | browse the database |

`SEED_RUN_EXTRACTION=1` re-runs Pipeline A through the live provider. Off by default on purpose — `prisma/fixtures/extracted.json` is committed so seeding never costs tokens or needs a network.

---

## Notes on this environment

- **Next is 15.5.7, not 16.x.** The npm proxy quarantines packages published within the last 7 days, so dependencies are pinned to versions it allows. `package.json` carries `overrides` for the same reason.
- **`react@19.0.0` is listed in the registry but its tarball 404s** — pinned to 19.2.8.
- **Provider SDKs are lazily imported** and listed in `serverExternalPackages`. `@google/genai` pulls an optional MCP dependency that breaks the Next build when imported eagerly, which took the Haiku path down with it.

---

## Docs

- [plan.md](plan.md) — architecture, ViewSpec contract, endpoints, user stories
- [CLAUDE.md](CLAUDE.md) — conventions and demo-critical invariants
- [AGENTS.md](AGENTS.md) — ownership map and per-dev task briefs
- [PITCH.md](PITCH.md) — judge-facing pitch and demo script
