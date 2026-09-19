# flags.MD

Things that need a human decision, not a patch. Raised by Dev B while building
the presentation layer. Nothing here is broken right now; each one is a risk, a
divergence from the plan, or a boundary I crossed that Dev A should know about.

| # | Flag | Who decides |
|---|---|---|
| 1 | Dev B edited `globals.css` and `ItemDrawer.tsx`, both Dev A's work | Dev A |
| 2 | `compileFilters` has no callers — block filters run client-side only | Dev A |
| 3 | Pinned versions diverge from `plan.md` §2 on 9 packages | both |
| 4 | `next@15.5.7` carries a published security advisory | both |
| 5 | `package-lock.json` now mixes two registries | Dev A |
| 6 | ~~Never run end-to-end~~ — now run; what is still unverified | both |
| 7 | **Both devs now edit `src/components/**` — the lane split is gone** | both |
| 8 | Gemini model availability is not guaranteed, and the fallback hides it | both |
| 9 | The Gemini API key was pasted into a chat and a screenshot | you |

---

## 1. Dev B edited `globals.css` and `ItemDrawer.tsx`, both Dev A's work

`AGENTS.md` puts `src/app/**` outside Dev B's lane. I edited
`src/app/globals.css` anyway, because the bug in it (`bugs.MD` §2) would have
turned the page white on a light-mode machine at demo time.

Kept deliberately contained: **one file, one purpose, one isolated commit**
(`fix(styles): commit the page plane to the dark palette`). Easy to take as-is,
redo differently, or revert.

Since then, two more crossings, both in the frontend pass:

- `globals.css` again, which now carries the whole design token set.
- `ItemDrawer.tsx` — Dev A's reading pane — got a **colours-only** pass so it
  matches the new surfaces. No structural or behavioural change; the old
  `#1a1a19` panel simply no longer matched anything else on screen.

Still untouched: `Renderer.tsx`, `page.tsx`, `viewspec.ts`, `catalog.ts`,
`src/lib/**`, `src/app/api/**`, `prisma/**`.

---

## 2. `compileFilters` has no callers — block filters run client-side only

`src/lib/filters.ts` exports `compileFilters()`, which compiles the model's
filter DSL into a Prisma `where`. **It is currently called from nowhere**
(`grep -rn compileFilters src/` returns only its own definition).

Meanwhile `/api/data` returns every row, and `Renderer.tsx` hands that same full
`items` array to every block. So nothing was narrowing rows for a block that
said *"only suspicious ones"*.

Dev B filled the gap client-side: `applyFilters()` in
`src/components/blockData.ts` mirrors the same DSL over the already-fetched
rows. This works and is demo-correct, but Dev A should know:

- the filter logic now exists in **two places** and they must stay in step
  (the `null` change in `bugs.MD` §3 is exactly this cost, already paid once);
- the server-side Prisma path is dead code as it stands;
- every row reaches the browser regardless of what a block asks for. Fine for a
  29-row fixture demo; not what you'd ship.

**Decision needed:** leave it client-side for the hackathon (recommended — it
works, and it is already verified), or wire `compileFilters` into a per-block
server fetch and delete the mirror. Do **not** do both halfway.

---

## 3. Pinned versions diverge from `plan.md` §2 on 9 packages

`CLAUDE.md` hard rule #10 says to pin the versions in `plan.md` §2. The repo
does not match, on nine packages:

| Package | `plan.md` §2 | Installed |
|---|---|---|
| next | 16.3.5 | **15.5.7** |
| zod | 4.6.5 | **3.25.76** |
| recharts | 3.10.1 | **2.15.3** |
| @google/genai | 2.23.0 | **1.5.0** |
| @tanstack/react-query | 5.103.1 | 5.90.20 |
| jose | 6.2.12 | 6.0.11 |
| tailwindcss | 4.3.3 | 4.1.11 |
| tsx | 4.23.13 | 4.21.0 |
| @aws-sdk/client-bedrock-runtime | 3.1136.0 | 3.994.0 |

This looks deliberate — commit `88fdb20` is titled *"resolve Artifactory 7-day
cool-off blocks"*, i.e. the newer versions were unavailable through the mirror.
That is a good reason. But the docs now describe a stack the repo does not have,
and `plan.md` is the architecture contract both devs code against.

The major-version gaps are the ones that actually matter: **zod 3 vs 4** and
**recharts 2 vs 3** have different APIs. Dev B's blocks are written against
recharts **2.15.3**, the version that is installed.

**Decision needed:** update `plan.md` §2 to the versions actually in use. Faster
and more honest than upgrading mid-hackathon.

---

## 4. `next@15.5.7` carries a published security advisory

`npm install` prints:

```
npm warn deprecated next@15.5.7: This version has a security vulnerability.
Please upgrade to a patched version.
See https://nextjs.org/blog/security-update-2025-12-11
```

Not a demo risk — nothing here is internet-facing and auth is a seeded demo
user. Flagged because it is a real advisory, it is tied to flag #3, and nobody
should be surprised by it. Check whether a patched 15.x is reachable through the
mirror before touching it; a version bump the day of the demo is its own risk.

---

## 5. `package-lock.json` now mixes two registries

Every one of the 610 `resolved` URLs points at
`artifactory.foc.zone/.../npm-public-virtual`. That host is unreachable from
outside that network, so `npm install` on any other machine dies with
`ETIMEDOUT` followed by npm's `Exit handler never called!`.

To build and verify Dev B's work I temporarily repointed those URLs to
`registry.npmjs.org`, installed, then **restored the lockfile** via
`git checkout -- package-lock.json`. The committed lockfile is byte-identical to
what Dev A pushed — this repo carries no trace of the workaround. The integrity
hashes are the same either way, since both hosts serve the same tarballs.

**This has since changed, and Dev A needs to know.** Installing
`@modelcontextprotocol/sdk` (bugs.MD #7) added **66 new entries resolved from
`registry.npmjs.org`**, alongside the 610 existing Artifactory ones. The lockfile
now points at two registries at once.

The 610 original entries were left byte-identical — only new packages were added
— so nothing Dev A already has is disturbed. But if Artifactory blocks public
npm, `npm ci` on their machine will fail on those 66. Running a plain
`npm install` there should re-resolve them through the mirror.

**Decision needed:** regenerate the lockfile on whichever machine has to build
it, or accept that only one machine can install cleanly.

---

## 6. ~~The demo path has never been run end-to-end~~ — partly closed

**Update: the stack now runs on the Dev B machine.** Docker Desktop was
installed all along, just not started. Postgres is up on 5434, migrations are
applied and 29 rows are seeded.

Verified working:

| Check | Result |
|---|---|
| `GET /` unauthenticated | 307 → `/login` |
| `GET /api/data` unauthenticated | 401 `{"error":"Unauthorized"}` |
| Login with the demo credentials | 200, `lm_token` cookie set |
| `GET /api/data` authenticated | 29 items |
| `POST /api/view` | 200 with a valid spec — **never 500s**, confirmed both with no credentials at all and with a live key |

Still **not** verified, and this is the part that matters:

- **A model-composed screen has never rendered.** Every intent currently hits
  the fallback because of bugs.MD #8, so the four scripted intents produce four
  identical screens. The central claim of the project is still unproven in a
  browser.
- Saving and reloading a view.
- The `insufficient_evidence` → `EmptyState` path with a real model response.
- The ablation toggle in the real page (verified in a component harness only).

Once #8 is fixed, walk `plan.md` §10 end to end. That is the remaining half of
the joint checkpoint.

---

## 7. Both devs now edit `src/components/**` — the lane split is gone

`AGENTS.md` assigns `src/components/**` to Dev B and says *"Dev A never edits a
B component's body."* That is no longer what is happening, in both directions:

- Dev A added `useSelectItem` click-to-open handlers inside `CardsBlock`,
  `ListBlock`, `TimelineBlock`, `TableBlock` and `FixedDashboard`, and created
  `ItemDrawer.tsx` and `ItemSelection.tsx` in the Dev B directory.
- Dev B restyled all of those, plus `ItemDrawer.tsx`.

**This already caused one near-miss.** The frontend pass rewrote
`CardsBlock.tsx` from scratch, which silently deleted Dev A's
`useSelectItem` handler — the card stopped opening the email. It was caught by
noticing a later edit did not match the file, and restored with the new styling
intact. Nothing was lost, but only because it was spotted.

The risk is specific: a **whole-file rewrite** cannot see a feature somebody
added to that file since the last pull. Restyles are exactly the operation that
rewrites whole files.

**Decision needed.** Either reassert the split (behaviour is Dev A's, appearance
is Dev B's, and a restyle always re-reads the file first), or drop the pretence
and agree to short-lived branches with a read before every rewrite. What does
not work is half-following a protocol that both devs have already stopped
following.

---

## 8. Gemini model availability is not guaranteed, and the fallback hides it

`gemini-3.8-flash` — the `plan.md` default — returned
`503 This model is currently experiencing high demand` repeatedly during
testing, interleaved with successes, plus one `403 The caller does not have
permission`. It is not consistently available.

`GEMINI_MODEL` in `.env` is currently set to **`gemini-3.1-flash-lite`**, which
answered reliably at ~1.6s. `gemini-3.8-flash` does work — it is the
availability, not the model id, that is unreliable.

Two things compound this:

1. **There is no retry.** A single transient 503 turns into a fallback screen,
   and the user sees a layout that does not answer their question.
2. **The fallback hides it.** A 503 and a great answer both return HTTP 200. On
   stage you would not know which one you got without reading `source`.

**Decision needed before the demo:** warm `ViewSpecCache` for the four scripted
intents so the demo makes **zero live calls** and cannot be taken down by a
spike. `scripts/warm-cache.ts` already exists for this. A single retry on 503 in
the provider is worth considering too, but the warm cache is the real
protection — and `plan.md` §9 already calls for it.

To see through the fallback at any time:

```bash
npx tsx --env-file=.env scripts/check-gemini.ts
```

---

## 9. The Gemini API key was pasted into a chat and a screenshot

The key now in `.env` was shared in conversation and in a screenshot of the
AI Studio key dialog, so it exists outside the machine it is used on. `.env` is
gitignored and the key has **not** been committed — this is about where it has
already been, not where it is going.

Not urgent for a hackathon key with a free-tier quota. Worth rotating at
https://aistudio.google.com once the demo is over, and worth not reusing that
key for anything with billing attached.
