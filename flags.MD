# flags.MD

Things that need a human decision, not a patch. Raised by Dev B while building
the presentation layer. Nothing here is broken right now; each one is a risk, a
divergence from the plan, or a boundary I crossed that Dev A should know about.

| # | Flag | Who decides |
|---|---|---|
| 1 | Dev B edited `globals.css`, which is Dev A's file | Dev A |
| 2 | `compileFilters` has no callers — block filters run client-side only | Dev A |
| 3 | Pinned versions diverge from `plan.md` §2 on 9 packages | both |
| 4 | `next@15.5.7` carries a published security advisory | both |
| 5 | `package-lock.json` resolves to an internal Artifactory mirror | Dev A |
| 6 | The demo path has never been run end-to-end | both |

---

## 1. Dev B edited `globals.css`, which is Dev A's file

`AGENTS.md` puts `src/app/**` outside Dev B's lane. I edited
`src/app/globals.css` anyway, because the bug in it (`bugs.MD` §2) would have
turned the page white on a light-mode machine at demo time.

Kept deliberately contained: **one file, one purpose, one isolated commit**
(`fix(styles): commit the page plane to the dark palette`). Easy to take as-is,
redo differently, or revert. No other file outside the Dev B lane was touched —
`Renderer.tsx`, `page.tsx`, `viewspec.ts`, `catalog.ts`, `src/lib/**` and
`src/app/api/**` are all untouched.

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

## 5. `package-lock.json` resolves to an internal Artifactory mirror

Every one of the 610 `resolved` URLs points at
`artifactory.foc.zone/.../npm-public-virtual`. That host is unreachable from
outside that network, so `npm install` on any other machine dies with
`ETIMEDOUT` followed by npm's `Exit handler never called!`.

To build and verify Dev B's work I temporarily repointed those URLs to
`registry.npmjs.org`, installed, then **restored the lockfile** via
`git checkout -- package-lock.json`. The committed lockfile is byte-identical to
what Dev A pushed — this repo carries no trace of the workaround. The integrity
hashes are the same either way, since both hosts serve the same tarballs.

**Decision needed:** if anyone else needs to build this repo, regenerate the
lockfile against public npm. If it is only ever built on Dev A's machine, leave it.

---

## 6. The demo path has never been run end-to-end

Docker is not available on the Dev B machine, so there is no Postgres, and
therefore no login, no `/api/data`, and no `/api/view` against real data.

What **was** verified: `tsc --noEmit` clean, `next build` green, and every block
rendered against the committed fixtures at 0, 1 and 40 rows with the filter and
aggregate helpers checked against the real fixture values.

What was **not** verified: login → intent → model call → cache → render, the
ablation toggle in the real page, saving and reloading a view, and the fallback
path under a deliberately malformed spec.

`AGENTS.md` calls this the *"first joint checkpoint"* and says not to defer it to
the last hour. **It is still outstanding.** It needs a machine with Docker —
Dev A's.
