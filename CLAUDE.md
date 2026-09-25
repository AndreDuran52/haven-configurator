# CLAUDE.md: Haven Configurator

## What this is

A sectional-sofa configurator for the Haven sofa, used live with clients on an iPad (and on a laptop). The user picks a shape (U, L-left, L-right), types the room measurements, and edits pieces (seats, one-arm seats, wedges, tables) in a to-scale SVG plan view. A read-only **orthographic** 3D view shows the same sofa as flat, to-scale Top / Front / Side / 3/4 / Iso views. Outputs are vector PDF sheets (client + shop) at architectural scale, and share links.

It is a **standalone app**: its own repo, its own Vercel project, no login, no backend. The layout lives in the URL hash (`#c=…`), a localStorage draft and a localStorage "Saved layouts" list on each device. It is not part of any other app; the only hand-off to the production tracker is a PDF uploaded by hand.

## Docs (read before building)

- `docs/HAVEN-PLAN.md` is **the build plan and wins over everything else**, including the spec. §1 TL;DR, §3 where it lives, §5 engine, §10 milestones, §11 tests, §13 open questions, §14 kickoff prompts.
- `docs/spec-v3.md` is the owner's original spec. Where it differs from the plan, the plan wins (plan Appendix A).
- `docs/README.md` indexes the docs. `docs/prototypes/` is **reference code to port, never import**; `docs/evidence/` holds screenshots and sample PDFs.
- Do not assume anything the docs don't say. If the plan is silent, ask Andre (or use the §13 default and list it in the PR).

## Stack

Vite + React 19 (pinned 19.2.x: R3F peers React < 19.4) + TypeScript `strict`, Tailwind CSS, a few Radix primitives, zustand (vanilla store). three.js + @react-three/fiber + drei (camera-controls) for 3D, jsPDF + svg2pdf.js for sheets. vitest, oxlint, playwright-core. `vite-plugin-pwa` (precache-only service worker, from H2). Deployed on Vercel (production = `main`, a preview per branch). `@` → `src/`.

Layout: `src/{engine, ortho, state, plan, three, ui, export}` (plan §4). The share codec is `src/engine/codec.ts`.

## Non-negotiable rules

1. **Engine purity.** `src/engine/**` is pure TypeScript: no React, react-dom, zustand, three, `@/…` or `../…` imports (oxlint-enforced). Every op is `(config, …) => EditResult`, never mutates its input, returns the same reference when refused.
2. **Config is the only domain state.** Everything else (`BuildResult`, dimensions, seats, warnings, fits) is derived and never stored. Drafts during a gesture; one commit per gesture = one undo step.
3. **The plan wins over the spec.** Rules, numbers and tests come from `docs/HAVEN-PLAN.md`; don't "fix" them from the spec.
4. **Lazy 3D and PDF.** three / `@react-three/*` only inside `src/three/**`, reached only through `lazy()` / `import()`; jsPDF and svg2pdf only through `await import()` in `src/export/`. `src/ortho/**` never imports three. No vendor `manualChunks`.
5. **Entry-chunk budget.** `npm run check:bundle` must pass: entry JS within budget (plan §3), no `THREE.WebGLRenderer` or `jsPDF` markers in entry files.
6. **Share links are forever.** Codec changes bump the version, add a decoder/migration, and keep every golden link passing. Links carry geometry, fabric and finish only: never names, project numbers or prices.
7. **No hidden network.** No CDN HDRIs, no Draco decoder, nothing cross-origin; `.glb` exported without Draco. The app must work offline after one online load (from H2).
8. **No backend, no login** unless Andre explicitly starts H7 option (b). `priceFor` stays a stub, never rendered.
9. **Storage is fragile.** Every localStorage read/write goes through `src/state/storage.ts` (try/catch); the app must work with storage throwing.
10. **iPad first.** Touch targets ≥ 44 px, `touch-action` rules and safe-area insets per plan §8; never break `scope: "/"` or the iOS meta tags in `index.html`. Phones: view and share (editing best-effort).
11. Keep files under ~300 lines; extract when they grow.

## Milestones: one at a time, never skip ahead

Each milestone: `git fetch`, branch from `origin/main` (`h0b-scaffold`, `h1-engine`, `h2-plan-view`, `h3-ortho`, `h4-editing`, `h5-look`, `h6-exports`), build only that §10 block, meet its done-when list, open a PR, **stop**. Andre previews (localhost or the Vercel preview; from H2 on, installed on the iPad) and it merges on Andre's word. Tick the box below in the same PR.

**Current status: planned, nothing built** (docs only, H0).

- [x] H0 Docs hand-off (plan, spec, prototypes, evidence in `docs/`)
- [ ] H0b Scaffold (Vite, strict TS, oxlint guards, vitest, bundle budget, manifest, Vercel)
- [ ] H1 Engine + tests (nine §12 tests first, then G1–G11, E-tests, property test)
- [ ] H2 Plan view + inputs, URL/draft state, service worker
- [ ] H3 Read-only orthographic 3D viewer (**needs Q1 answered**; Q9, Q10, Q12–Q14 answered or accepted)
- [ ] H4 Editing (seams, tables, tray, tap menu, loose pieces)
- [ ] H5 Look (pillows, textures, Sketch; needs Q16 assets)
- [ ] H6 Sheets (PDF/PNG), share links + `?view`, local Saved layouts
- [ ] H7 Cloud saves + tracker hand-off (optional; do not start unless Andre asks)
- [ ] H8 Blender round-trip (later; do not start unless Andre asks)

Open questions: plan §13. Only Q1 has no default.

## Gate (before every PR)

```
npm test && npm run lint && npm run build && npm run check:bundle
```

From H2 also `npm run e2e`, and screenshots at 1180×820, 820×1180 and 390×844.

## Verification practices

- **vitest** for everything pure (engine, ortho, history, codec, dims). Paste the summary into the PR.
- **Playwright (Chromium)** via `playwright-core` in `e2e/*.mjs`, launched with `executablePath: process.env.HAVEN_CHROMIUM`. In cloud sandboxes the browser is preinstalled: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, executable `/opt/pw-browsers/chromium`. **Never run `playwright install`** there. On Andre's Windows machine, `npx playwright install chromium` once.
- Judge by outcome (DOM, measured pixels, PDF coordinates, decoded links), not by eye. Anything rAF-dependent (tweens, drag feel, idle frame counts) runs in Playwright or a foreground browser, never a backgrounded preview pane.
- Touch is checked with CDP touch emulation; real touch, frame rate and share sheet only on Andre's iPad. Mark anything not checked on a real device as UNVERIFIED.
- Offline checks: load once online, then reload with the network off in Playwright.

## Conventions

- Commits: `H<N>: <summary>` (e.g. `H1: port engine-a with §12 tests`), multi-line messages via `git commit -F <file>`. Stage explicit paths only; never `git add -A`.
- PR body: what was built, the done-when checklist with evidence, defaults used for unanswered questions, anything UNVERIFIED.
- Refer to Andre by name, or they/them.
- If the Vercel GitHub integration skips a branch, run `npx vercel deploy --yes`.
