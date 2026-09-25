# Haven Configurator: Build Plan (v2, 2026-09-25: standalone app)

This plan covers the Haven Configurator described in the build spec v3 (`docs/spec-v3.md`, cited here as §1–§14) and Andre's request: **"help me plan this, i want the sofa view to be orthographic."**

**v2 change (2026-09-25):** Andre decided the configurator is **its own project**: its own GitHub repo (`haven-configurator`), its own Vercel project and its own Claude Code cloud environment. v1 planned it as a lazy feature inside another app; every host-app dependency has been removed from this version (§3). The engine, rules, orthographic 3D design, plan view, exports and tests are unchanged.

It is the single document future Claude Code sessions build from. It condenses six research reports and two working engine prototypes. Numbers marked *measured* were produced by code that ran in the prototypes archived under `docs/prototypes/` (see Appendix B). Items marked **UNVERIFIED** have not been checked yet. Where this plan and spec v3 differ, **this plan wins** (Appendix A lists the differences; there is deliberately no separate spec v4 to drift out of sync).

---

## 1. TL;DR

- **"Orthographic" = the 3D view uses an orthographic camera.** Nothing shrinks with distance. The presets become a true Top plan, true Front and Side elevations, and a 3/4 axonometric view. Orbit and pinch-zoom still work, but pinch now changes the camera zoom instead of moving the camera. Because zoom is exactly *pixels per inch*, the 3D Top view lines up with the SVG plan to within 1e-4 px (*measured*), the Front/Side views carry an on-screen scale bar and height ticks, and a Front render drops onto a sheet at a stated scale. If Andre meant a drafting sheet (plan + front + side laid out together), H3 switches to the H3-alt block in §10.
- **Engine: model A ("explicit lengths + rebalancing ops"), plus five changes borrowed from model B:**
  1. When a table leaves the middle of a seat, the two halves merge back.
  2. The shape picker keeps the back run's pieces.
  3. The wedge slider stops at the last value that fits instead of being refused.
  4. The engine outputs `bounds` and `heights` alongside the pieces.
  5. With the lock off, adding or removing an arm keeps the cushion size.

  New rules: every edit returns a reason when it is refused, coffee-table clearance is measured diagonally to the wedge faces, and arms can never end up mid-run. Both prototypes pass all nine §12 tests. A wins on the §1 "neighbouring seats absorb" rule, seam drags, lock-off, share-link stability and UI simplicity (§4 below).
- **Where it lives:** a standalone Vite + React 19 + TypeScript (strict) app at the root of its own repo (`haven-configurator`), deployed as its own Vercel project and installable on the iPad/iPhone home screen through its own manifest. **No login and no backend** for H1–H6: the layout lives in the URL hash (`#c=…`), plus a localStorage draft and a localStorage "Saved layouts" list on each device. A share link is simply the app URL with `#c=` (with `?view` for a read-only client view), so there is no separate share page. A precache-only service worker (from H2) makes the installed app open with no network in a client's home. three.js and jsPDF stay out of the entry chunk; a lint rule and a post-build entry-chunk budget enforce this.
- **Milestones H0–H8, one at a time, one branch each (`h1-engine`, `h2-plan-view`, …):**
  - **H0** docs only (**done**): this plan, the spec, the prototype sources and a few evidence images are in `docs/`, so later sessions never depend on the planning session's scratch space.
  - **H0b** repo scaffold: Vite react-ts, strict tsconfig, oxlint guards, vitest, entry-chunk budget, manifest + iOS meta, Vercel project. A placeholder page only.
  - **H1** engine + tests, no UI.
  - **H2** plan view with measurement inputs, URL/draft state, service worker.
  - **H3** read-only orthographic 3D viewer. Moved up from spec phase 4, because it is what Andre asked about and it only depends on the engine.
  - **H4** editing.
  - **H5** Blender pillows, textures and the Sketch style.
  - **H6** PDF sheets, share links (incl. `?view`) and the local "Saved layouts" list.
  - **H7** cloud saves + hand-off to the production tracker: **optional, later, owner decides** (default: stay local, hand off PDFs by hand).
  - **H8** Blender round-trip, later.
- **3D stack:** R3F `<Canvas orthographic frameloop="demand">` with drei `<CameraControls>` (camera-controls 3.1.2) and a small fix for the first frame after idle. Framing uses a custom `fitOrtho`. Depth reads through a camera-relative key light, 1 px outlines and a contact shadow. The lazy 3D chunk is 1,012 kB raw / 273 kB gzip (*measured*).
- **Plan view, state and sharing:**
  - The plan is one pure SVG `<PlanDrawing>` that both the screen and the PDF use.
  - Undo history is hand-rolled around a draft slot, so one drag is one undo step.
  - A config fits in a text link: the Standard U encodes in 38 characters (*measured*).
  - Sheets are vector PDFs built with jsPDF + svg2pdf.js, at a true architectural scale. The Standard U prints at 3/8″ = 1′-0″.
- **One question has no default** (§13): Q1, the reading of "orthographic", must be answered before H3. (Q2 "where it lives" is answered: standalone. Q3 no longer applies.) H3 also needs the craft questions (Q9, Q10, Q12–Q14) answered, or their defaults accepted after Andre sees the Front/Side screenshots. Every other question has a default that applies if there is no answer.
- **Unverified:** nothing has run on a real iPad yet. All touch behaviour was checked with Chromium touch emulation. Every milestone from H2 on ends with Andre testing on an iPad using the Vercel preview.

---

## 2. "Orthographic"

**What it means for this build.** The 3D view (§7 "Views", §9) uses an `OrthographicCamera`. Consequences:

- **One scale everywhere.** R3F sizes the orthographic frustum in CSS pixels, so `camera.zoom` equals CSS px per inch. At zoom S, the Top preset is the SVG plan drawn at S px/in.
  - *Measured* at 3 viewports: 26 plan vertices at floor height and at 27″, max error 7.4e-5 px, silhouette IoU 0.99957–1.0.
- **Presets become exact drawings:** Top = plan; Front and Side = elevations that show the 1 / 10 / 18 / 23 / 27″ heights at true scale; 3/4 = an axonometric view.
- **Pinch and wheel change `camera.zoom`.** The camera never moves closer.
- **Depth cues have to replace perspective:** lighting, outlines, contact shadow.
- **Renders are to scale.** A render at a chosen px/in drops onto a sheet at an architectural scale.

**What it changes in the spec:**

| Spec | v3 says | This plan |
|---|---|---|
| §7 Views | "3D (orbit, plus presets: top, front, 3/4)" | Presets **Top, Front, Side, 3/4, Iso**, with exact camera directions (§7 of this plan). Orbit is limited to above the floor. Pinch changes zoom (px/in), with limits. The 3D view is view-only; all editing happens in the plan. |
| §9 3D approach | Soft studio light, light wood floor, ContactShadows | Adds orthographic depth cues: camera-relative key light, 1 px drei `<Outlines>`, ContactShadows placed at the world origin, a 1.5″ floor slab (a flat plane disappears in elevation), NeutralToneMapping. No HDRI background. |
| §10 Outputs | Plan only | Sheets add a **to-scale front elevation**: vector on the shop sheet, a shaded orthographic render on the client sheet (client-sheet pictures are Q30). The 3/4 render is labelled "not to scale". |
| §11 Stack | R3F + drei | Adds `camera-controls` (a drei dependency). The 3D code is a lazy chunk and never enters the entry chunk. |
| §13 Phases | 3D in phase 4 | A read-only orthographic viewer becomes **H3**, ahead of editing. |

**The alternative reading: classic multi-view drafting.** Plan, front and side elevations laid out together (third-angle: plan above the front, right side to the right of the front).

If Andre means this (Q1 = drafting or both), H3 is replaced by **H3-alt** (§10): a vector "Drawings" view built from the engine (`plan/elevation.ts`, already prototyped in `planview/src/plan/elevation.ts`, moves there from H6). For "drafting", the WebGL viewer becomes a later H3b. It is not dropped, because spec §7 ("3D, orbit") and §9 require it, unless Andre explicitly waives those. For "both", H3b follows immediately. Everything else stays as planned.

The orthographic-camera plan already produces a third-angle composite (*measured*: `ortho-demo/shots/export-sheet-third-angle-4ppi.png`), so the two readings share most of the work. Question Q1 in §13 asks which one.

The SVG plan view is orthographic already, so nothing changes there.

---

## 3. Where it lives

**Decision (Andre, 2026-09-25): a standalone app in its own repo.** `haven-configurator` has its own GitHub repo, its own Vercel project, its own Claude Code cloud environment and its own `CLAUDE.md`. It shares no code, database or deployment with any other app. (The Venegas production tracker is a separate app; the only hand-off between them is files, i.e. a shop-sheet PDF uploaded by hand, see H7.)

**What that means:**
- **Stack.** Vite + React 19 + TypeScript `strict` at the repo root, `src/` layout (tree in §4). Tailwind CSS for the chrome, plus the few Radix primitives the plan names (Slider, Popover, Dialog) as small local components. zustand (vanilla store) for state. vitest, oxlint, Playwright (`playwright-core`) for browser checks.
- **No login, no backend (H1–H6).** The engine, plan view, 3D view, exports and share links never need a server. The layout lives in three places, all on the device:
  - the URL hash `#c=<code>` (the live layout; reloads and share links restore it);
  - a localStorage **draft** (last committed layout, offered as "Resume last layout");
  - a localStorage **"Saved layouts"** list (named layouts on this device, H6).
  Every storage read and write is wrapped in try/catch; the app works with storage blocked (private mode), it just can't resume or save.
- **One entry, no share page.** Because the app needs no login, a share link is the app URL itself: `https://<app>/#c=<code>`. `?view` opens a read-only client view (plan + 3D + seat count, no editing chrome) with an "Edit a copy" button that drops `?view`. v1's separate `share.html` entry is gone.
- **Installed web app.** Its own `public/manifest.webmanifest`: `start_url "/"`, **`scope "/"`** (keeps in-app navigation out of a Safari sheet), `display "standalone"`, **no `orientation` field** (landscape and portrait both allowed), icons 192/512/maskable-512, plus `apple-touch-icon` 180. `index.html` carries `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, and `viewport-fit=cover`; the top bar and the bottom slider/tray pad with `env(safe-area-inset-*)`. iOS caches a home-screen icon's settings when it is added, so manifest changes need the icon removed and re-added; get the manifest right in H0b.
- **Service worker: yes, precache-only, from H2.** An installed configurator is opened in a client's home, where Wi-Fi is often poor or absent, and there is no live data a cache could serve stale: everything the app needs is its own build output. So a service worker earns its place here:
  - `vite-plugin-pwa` with `strategies: 'generateSW'`, `manifest: false` (the hand-written manifest stays the source of truth), `injectRegister: null` and a manual `registerSW` call in `main.tsx`.
  - Precache every build asset, **including the lazy three.js and jsPDF chunks** and (from H5) the pillow `.glb` files and textures; precaching runs after first load, so it never slows first paint. `navigateFallback: 'index.html'`.
  - `registerType: 'prompt'`: a new deploy shows a small "Update available · Reload" chip. Never auto-reload: that would wipe an in-progress edit in front of a client (the hash and draft survive, but the jump is jarring).
  - The service worker never caches anything cross-origin (there is nothing cross-origin: no CDN HDRIs, no Draco decoder, §7).
  - **UNVERIFIED:** the `vite-plugin-pwa` release that supports the Vite major in use (check at H2; fallback is a ~40-line hand-written `sw.js` fed the asset list by a tiny build plugin); how long iOS keeps the precache for an icon that is not opened for weeks.
- **Lazy heavy code.** three.js / R3F (≈ 273 kB gzip, *measured*) and jsPDF + svg2pdf (≈ 160 kB gzip) load only on demand (3D view, export), so first paint on the iPad is the engine + plan view only. The 3D chunk is warmed after first paint (§7.5).
- **Entry-chunk budget** instead of a baseline. `scripts/check-bundle.mjs` (from `docs/prototypes/placement/check-bundle.mjs`, extended) runs after `vite build`. "Entry JS" = the sum of JS files referenced by `dist/index.html` (entry + modulepreloads). It fails if entry JS exceeds **350 kB raw or 110 kB gzip**, or if a `THREE.WebGLRenderer` or `jsPDF` marker appears in any entry file. Basis: the real engine + `PlanDrawing` + dims + codec + react-dom measured 230 kB raw / 74 kB gzip (*measured*), plus headroom for the store and UI. At the end of H2 the budget is tightened to the measured entry size + 15 %, rounded up, and recorded in the script.

**Considered and rejected:**
- *A feature inside another app (v1's recommendation):* superseded by Andre's decision. It tied the configurator to that app's login gate, database uptime and bundle, for a tool that needs none of them.
- *A backend from day one:* nothing in H1–H6 needs one. Cross-device saves are an optional later milestone (H7).

**Placement:**

| What | Where |
|---|---|
| App code | `src/**` at the repo root (tree in §4) |
| URL | `/` only. `#c=<code>` = layout; `?view` = read-only client view. No router. |
| Tests | `vitest.config.ts` at the root (node environment, `@` → `src/` alias), `src/**/*.test.ts`; DOM tests opt in per file with `// @vitest-environment jsdom`. Browser checks in `e2e/*.mjs` (`npm run e2e`) using `playwright-core` with `executablePath: process.env.HAVEN_CHROMIUM \|\| undefined`. In cloud sandboxes set `HAVEN_CHROMIUM=/opt/pw-browsers/chromium` (`PLAYWRIGHT_BROWSERS_PATH` already points at `/opt/pw-browsers`) and never run `playwright install`; on Andre's Windows machine run `npx playwright install chromium` once. Anything that depends on rAF (tweens, idle frame counts, drag feel) runs in Playwright or a foreground browser, never an embedded, backgrounded preview pane (it throttles rAF). |
| Assets | `public/models/` (pillow `.glb` files exported **without Draco**, textures). No CDN-hosted HDRIs: drei's `Environment` presets load from raw.githack.com, so use `<Lightformer>` or a self-hosted file. |
| Guards | `.oxlintrc.json` `no-restricted-imports`. Globally, patterns `three`, `three/**`, `@react-three/**` are allowed only in `src/three/**`. That the `three/` folder is only imported dynamically is enforced by `check:bundle`, not lint: *measured* with oxlint 1.85, `no-restricted-imports` also flags dynamic `import()` and has no option to skip it, so a lint pattern on `./three/**` would block the `lazy()` import itself (a static import of `src/three/**` pulls three into the entry and trips the `THREE.WebGLRenderer` marker). For `src/engine/**`: `paths: ['react','react-dom','zustand']` plus patterns `['react/**','zustand/**','three','three/**','@react-three/**','@/**','../**']` (the engine only imports `./` siblings). Use `/**`, not `/*`: *measured* with oxlint 1.72, `@/*` misses `@/state/store` and `three/*` misses `three/examples/jsm/…`. `ignorePatterns: ["docs/**"]` so the archived prototypes never add lint noise. Plus `scripts/check-bundle.mjs` (above). |
| Deploy | Vercel project `haven-configurator`, framework preset Vite, production = `main`, a preview per branch. No environment variables. A `vercel.json` only if a header rule is needed (`/assets/*` immutable caching is **UNVERIFIED**; the service worker makes it matter less). |
| Database | None. See H7 (optional). |

**Working rules** (also in `CLAUDE.md`):
- One milestone at a time; `git fetch` first; one branch per milestone (`h1-engine`, `h2-plan-view`, …) from `origin/main`.
- Commits are `H<N>: <summary>`.
- Andre previews every milestone (localhost or the Vercel preview, and from H2 on the iPad) and it merges on Andre's word.
- Price stays a pure stub (`engine/priceFor.ts`), never rendered, until Andre asks for pricing.
- Update the milestone checklist in `CLAUDE.md` in every H PR.

---

## 4. Architecture

```
index.html                 the only entry: manifest link, apple-mobile-web-app-* meta, viewport-fit=cover
public/
  manifest.webmanifest     scope "/", start_url "/", display standalone, no orientation lock
  icons/                   192, 512, maskable-512, apple-touch-icon-180
  models/                  pillow .glb (no Draco) + textures (H5)
src/
  main.tsx                 createRoot; registerSW (H2, prompt-to-update)
  App.tsx                  HavenStoreProvider + HavenLayout; reads ?view; lazy(() => import('./three/ThreeView'))
  engine/                  PURE TypeScript: no React / three / zustand / @/ imports (lint-enforced)
    types.ts defaults.ts pieces.ts layout.ts ops.ts buildHaven.ts
    seating.ts clearance.ts profiles.ts limits.ts codec.ts world.ts priceFor.ts
    *.test.ts              §12 tests + edge tests + property test + codec golden links
  ortho/                   pure camera math, no three import (lets HTML preset buttons avoid loading three)
    presets.ts orthoFit.ts screenBasis.ts  (+ orthoFit.test.ts)
  state/
    store.ts               zustand/vanilla createStore inside HavenStoreProvider; useHaven(selector)
    history.ts             past/present/future + draft slot + keyed coalescing (+ test)
    useUrlSync.ts          commit → debounced history.replaceState (#c=, keeps ?view); hashchange → load
    storage.ts             try/catch localStorage wrapper (+ test with storage throwing)
    useDraft.ts            localStorage draft, offered as "Resume last layout"
    savedLayouts.ts        localStorage "Saved layouts" list {id, name, code, savedAt} (H6)
  plan/                    SVG only, never imports three
    PlanView.tsx PlanDrawing.tsx DimsLayer.tsx GripsLayer.tsx PlacementPins.tsx
    usePlanGestures.ts dims.ts hitTest.ts tableSnap.ts elevation.ts geometry.ts
    format.ts textMetrics.ts theme.ts   (+ DrawingsView.tsx only under H3-alt)
  three/                   the ONLY folder that may import three / @react-three/*; loaded via lazy()
    ThreeView.tsx Rig.tsx controls.ts parts.ts prism.ts keyLight.ts SofaModel.tsx
    Pillows.tsx export.ts parity.test.ts
  ui/  HavenLayout.tsx TopBar.tsx Sidebar.tsx MeasureField.tsx WedgeSlider.tsx
       PieceTray.tsx TapMenu.tsx StartMenu.tsx WarningsList.tsx ExportMenu.tsx
       SavedLayouts.tsx UpdateChip.tsx ViewModeBar.tsx
  export/  sheet.tsx pdf.ts png.ts share.ts               (jspdf + svg2pdf loaded dynamically)
scripts/check-bundle.mjs   vite.config.ts   vitest.config.ts   .oxlintrc.json   e2e/*.mjs
docs/{README.md, spec-v3.md, HAVEN-PLAN.md, prototypes/, evidence/}   (H0, done)
CLAUDE.md   README.md
```

**Data flow.** One source; every view derives from it:

```
Config (plain JSON, the only domain state)
   │  draft ?? config  ("live")
   ▼
buildHaven(live) ── memoised per object (WeakMap) ──► BuildResult
   pieces[] (polygons, arms, backs, cushion rects, heights) · runs · seams · gaps
   seats · opening · clearances · warnings · exportBlocked · bounds · heights
   ├─► plan/PlanDrawing  (SVG <g>, plan inches, y-down)  ─► screen editor, PDF sheet, PNG
   ├─► plan/elevation    (vector front/side from pieces + profiles)  ─► shop sheet
   ├─► three/parts       (pieces → rounded prisms, §3 heights)  ─► ortho 3D, exportView renders
   └─► engine/codec      (Config ⇄ text)  ─► #c= hash, share links, draft, saved layouts, QR
```

**Store vs derived.**

| State | Holds |
|---|---|
| **Store** | `config`, `draft \| null`, `past[]`, `future[]` (limit 100), `lastKey`/`lastAt`, and `ui: {view, look, preset, selectedId, menu, placing, planFit, lastStart, readOnly}` (`lastStart` = the last Start-menu choice, used by Reset; `readOnly` from `?view`). |
| **Derived, never stored** | `built`, the dimension layout, grips, seats, warnings, `exportBlocked`, the fit. |
| **Refs inside `usePlanGestures`** | Gesture bookkeeping: pointerId, `startConfig`, frozen screen-to-plan transform (CTM) and k, latest point, animation-frame id. |
| **localStorage** (through `state/storage.ts`) | The draft code and the Saved-layouts list, both as codec strings (never raw JSON, so they share the link's versioning and migrations). Read once on demand, never mirrored into the store. |

**Module boundaries.**
- `engine/` has zero React, three or zustand imports.
- `ortho/` has zero three imports.
- `three/` is reachable only through `lazy(() => import('./three/ThreeView'))` from `App.tsx`, and from `export/` for renders.
- `export/` loads jspdf and svg2pdf with `await import()`.
- `engine/priceFor.ts` is a pure stub (§9); nothing in `ui/` or `plan/` imports it.
- The ortho demo hit a trap here: one value import (`PRESETS`) from a module that imports three pulled all of three into the entry chunk. That is why `ortho/presets.ts` must not import three.

---

## 5. Geometry engine

### 5.1 Verdict: model A, with grafts from B

Both prototypes were re-run for this plan (2026-09-24):

| | engine-A (explicit lengths) | engine-B (pinned + flex, solved at build) |
|---|---|---|
| Tests | **42/42 pass**, tsc clean; includes a 4,000-op property test | **45/45 pass**, tsc clean; includes a 5,000-op fuzz (120,000 once) |
| §12 tests 1–9 | all pass | all pass |
| Engine lines (excl. tests) | 1,660 in 7 files (layout 451, ops 406) | 1,483 in 6 files (layout.ts 819, over the repo's ~300-line guideline) |
| §1/§6 "the **neighbouring** seat pieces absorb" | Yes: the nearest seat unit absorbs | No: every flex seat in the run absorbs equally (pinned in B's own test) |
| Measurement / wedge / D changes | An op rebalances at the run ends. W=140 on the Standard U is refused (*measured*: same reference returned) | No op needed; never refused; degrades to "relaxed" or "overflow" and recovers when the size comes back |
| Seam drags | Native: stored lengths, the pair total is invariant | Pins both pieces. Flex seats get used up, so later W changes land on whichever seat is still flex. Needs "pinned" indicators and a "reset sizes" action |
| Table drag round-trip | Path-dependent: 3b, then back to the back run, leaves the leg at [armless 45][one-arm 27] (*measured*) | Clean: flex halves merge back |
| Lock off | Native: W/L/R re-derived from run sums (`deriveOutside`, ~13 lines) | Bolted on: about 60 lines of per-op hints and a verify-and-pin fallback; the fuzz test found a real bug in it |
| Undo / determinism | Plain JSON, pure, id counter, same reference on no-op | Same |
| Share-link stability | The stored lengths *are* the geometry: old links never reshape. Codec built and round-trip tested on A (400 random sequences) | Geometry comes out of the solver, so any rule change reshapes old links. Links would need a rules version |
| UI burden | Piece ids stable (split pieces reuse ids). One concept: pieces | Split sub-ids (`s2.0`) appear and disappear, so selection must key on segment id. Pinned/flex indicator, unpin, and four solver states to show |

**Decision: A.** The shop cares about pieces. A stores exactly what goes on the shop sheet. It matches §1's "neighbouring seats absorb". Seam drags, lock-off, undo and share links all fall out directly. B's real advantages are narrow: measurement changes that never fail, and clean table round-trips. Both can be grafted onto A. A's weaknesses cannot be removed from B without re-introducing stored lengths.

**Grafts and changes to the A prototype (all must be covered by tests in H1):**

| # | Change | From | Why |
|---|---|---|---|
| G1 | A table split tags both halves `joinedBy: tableId`. Whenever that table stops sitting directly between its two tagged halves (`moveTable` to any placement, including a same-run seam; `deletePiece`; `setEndCap` removing it), the halves merge into one seat **first**: the merged seat takes the split target's id, keeps the arm, and its footprint is the sum of the halves. Only then is the freed width absorbed or the table re-placed. Every `Placement` passed to `moveTable` (seam indices, split `pieceId`s) is resolved against the run after the table is removed and the merge applied; `anchoredTargets(c, id)` is computed on that same post-removal config. Any manual edit of a half (resize, seam drag, convert, delete, reorder) clears both tags. | B (merge rule) | Makes 3b → back to the back run return exactly the Standard U, so "try it there… no, put it back" works by dragging. |
| G2 | `setShape` keeps the back run's pieces. For U → L, the end that becomes open absorbs +C at that end. The edge seat then becomes one-arm (footprint kept), or an edge table becomes the table end cap. L → U: the back end that becomes a wedge end absorbs −C there by the needed-space rule (refused with `infeasible` + `min.W` if it can't); an arm at that end is removed (footprint kept); a table there stays, now beside the wedge; the new leg gets the default fill. L-left ↔ L-right mirrors: the back's order is reversed and arm ends flipped on back pieces only; leg pieces are copied unchanged (legs run from the wedge in y); L and R are swapped, so mirroring twice is the identity. `setShape` holds W and the kept leg under both lock states. | B | A's version default-filled the back and lost the user's edits. |
| G3 | `setWedge` under the lock clamps to the last C every run can absorb (scanning 1″ steps from the current C toward the target), instead of refusing. `wedgeRange(config)` gives the slider its live feasible range. | B | A slider that silently won't move is worse than one that stops. |
| G4 | `BuildResult.bounds` (plan extents) and `BuildResult.heights` (the `profiles.ts` z-values). | B | Feeds the SVG viewBox, `fitOrtho` and elevations with no per-view recomputation. |
| G5 | Adding or removing an arm (convert, end cap, `replaceArm`): **lock on** keeps the piece footprint, so the cushion changes by ±14. **Lock off** keeps the cushion, so the run changes by ±14. | B | "Lock off: a run grows instead" (§1). *Test E1: lock off, `moveTable(back table → left, replaceArm)` gives W 188→156, L 132→150. (Lock-off `setEndCap(left, 'table')` adds a new table: W 188, L 150.)* |
| G6 | Every op returns `EditResult = {config, rejected}`. When refused, `config === input` and `rejected = {code, message, min?}`. `limits(config)` computes minimum W/L/R: corners + tables + arms + 6″ × each seat unit. | new (both lacked it) | Lets the UI say "Can't fit: min W 158″" (W=140 Standard U: 2×60 + 32 + 6 = 158). |
| G7 | Clearance = Euclidean distance from the coffee-table rectangle to built sofa polygons (wedges, seats, tables; never gaps), reported per region: `back` = back-run pieces, `left`/`right` = leg pieces, `backLeft`/`backRight` = the wedge's angled face from (C, D) to (D, C) (mirrored x′ = W − x). A region the shape lacks is `null`. `min` = the smallest non-null value; warn if `min` < 14; `coffeeOverlap` if any region intersects. | spec audit | A measured only straight out from each edge, which misses a table corner facing the wedge (11.3″ diagonal vs 16/16 straight). |
| G8 | `snugWidth` setting (default 24). Snug seats = floor(len / min(snugWidth, seatWidth)). | B | §8 treats seat width as a setting; snug is the same kind of setting. |
| G9 | Auto-split divides into **equal overall piece lengths** (arm included), as §7 literally says. The prototype made cushions equal instead. Owner question Q6. | B / spec | Literal spec, fewest distinct frames. Switching to equal cushions is a one-function change. |
| G10 | Integer half-inch arithmetic inside `distribute`/`absorb` (`toH`/`toIn`). | B | Exact sums with no float reasoning. |
| G11 | **Arm invariant**, asserted in `finalize`: in every run, each one-arm piece's arm faces the run's open end, and nothing but at most one table lies between it and that end. Runs with no open end (U back) hold no one-arm pieces. Any op whose result would break this (`addPiece`, `reorderPiece`, `moveTable`, `fillGap`, `convertPiece`) is refused with `notAllowed`: "Remove the arm first (end cap Open)". `convertPiece(→ oneArm)` is allowed only on the last seat before the open end. | spec audit | No mid-run arms (§4: "goes at the open end"). A's version only guarded the one-arm piece itself; reordering *another* piece past it still stranded the arm. |

### 5.2 Types (target; engine-A verbatim, trimmed, with grafts marked)

```ts
export type Shape = 'U' | 'L-left' | 'L-right';
export type RunId = 'back' | 'left' | 'right';
export type CornerId = 'backLeft' | 'backRight';
/** Run-local end. Runs are ordered by increasing x (back) or y (legs); legs start at their wedge. */
export type RunEnd = 'start' | 'end';
export type EndKind = 'wedge' | 'open';
export type SeatKind = 'armless' | 'oneArm';
export type RunPieceKind = SeatKind | 'table' | 'gap';

export interface RunPiece {
  id: string;            // from Config.nextId: stable, used for keys / tap menu / selection
  kind: RunPieceKind;
  length: number;        // along-run footprint, multiple of 0.5; oneArm INCLUDES its 14" arm
  arm?: RunEnd;          // oneArm only
  splitGroup?: string;   // auto-split siblings = one logical seat; re-merge when ≤ 108
  joinedBy?: string;     // G1: halves of a seat split around table <id>
}
export interface LoosePiece { id: string; kind: 'ottoman' | 'coffeeTable'; x: number; y: number; w: number; d: number }  // coffeeTable: w === d (§4 "free square")

export interface HavenDims {           // §3, kept as data so §14 answers are data changes
  A: number; B: number; backFrame: number;        // 14, 10, 4
  legHeight: number; deckHeight: number; seatHeight: number;   // 1, 10, 18
  cushionCrown: number; cushionEdge: number;      // 8, 6
  armHeight: number; backHeight: number; tableHeight: number;  // 23, 27, 23
  ottomanHeight: number; coffeeTableHeight: number;            // 18, 16 (Q29)
}
export interface Config {
  schema: 1;
  shape: Shape;
  W: number; L: number; R: number; D: number;   // L and R both kept even if the shape lacks one
  wedgeC: number | null;                        // null = auto (D + 16); number = slider value, sticks
  lockOutside: boolean;
  runs: Partial<Record<RunId, RunPiece[]>>;
  loose: LoosePiece[];
  seatWidth: number; snugWidth: number;         // 28, 24 (G8)
  fabric: string;                               // key into the FABRICS data table; 'boucle-white' to start
  tableFinish: 'walnut' | 'darkWood';
  dims: HavenDims;
  nextId: number;
}

export type Placement =
  | { run: RunId; at: 'seam'; seam: number }        // between pieces seam-1 and seam
  | { run: RunId; at: 'split'; pieceId: string }    // middle of a seat (test 3b)
  | { run: RunId; at: 'replaceArm' };               // at the open end, in place of the arm (test 3a)
export type EndCap = 'arm' | 'table' | 'open';
export type EndCapState = EndCap | 'armTable' | 'unfilled';   // derived, never stored

export interface Rejection { code: 'noRoom' | 'infeasible' | 'notAllowed'; message: string;
  min?: Partial<Record<'W' | 'L' | 'R' | 'C', number>> }
export interface EditResult { config: Config; rejected: Rejection | null }   // G6

export interface BuiltPiece {
  id: string; kind: 'wedge' | SeatKind | 'table' | 'ottoman' | 'coffeeTable';
  run: RunId | null; corner: CornerId | null; index: number | null; offset: number | null;
  length: number; depth: number; cushion: number | null;   // cushion = length − A on oneArm
  bbox: Rect; polygon: Pt[];                               // one winding for every piece
  arm: { at: RunEnd; facing: 'LAF' | 'RAF'; rect: Rect } | null;
  backs: Rect[]; cushionRect: Rect | null; height: number | null; splitGroup: string | null;
}
export interface BuildResult {
  shape: Shape; W: number; L: number; R: number; D: number; seatDepth: number;
  wedge: { C: number; auto: boolean; face: number; readout: string };
  runs: BuiltRun[];              // available, sum, filled, unfilled, ends, endCap, origin, seams
  pieces: BuiltPiece[]; gaps: BuiltGap[];
  seats: { comfortable: number; snug: number; label: string };
  opening: { width: number; depth: number } | null;
  clearances: Clearance[]; warnings: Warning[]; errors: string[];   // Clearance = {pieceId, back, left, right, backLeft, backRight, min} (G7)
  exportBlocked: boolean;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };   // G4
  heights: HavenDims;                                                   // G4
}
```

### 5.3 Operations

Every op is pure: `(config, …) => EditResult`, built on one choke point, `edit()`. `edit()` JSON-clones the config, mutates the draft, then runs `finalize()`. `finalize()` normalises each run, re-derives W/L/R when the lock is off, and asserts the invariants (it **throws** on a violation, so engine bugs cannot pass silently).

| Group | Signatures |
|---|---|
| Presets | `standardU(o?)`, `standardL(side, o?)`, `blankConfig(shape, o?)` → `Config` |
| Build | `buildHaven(c): BuildResult` (layout and validation only, never rebalances); `limits(c)`; `wedgeRange(c): {min, max}` |
| Measurements | `setMeasurements(c, {W?, L?, R?, D?})`, `setWedge(c, C)`, `resetWedge(c)`, `setLock(c, on)`, `setSeatWidth(c, w)`, `setShape(c, shape)` |
| Pieces | `addPiece(c, kind, placement, opts?)`, `deletePiece(c, id)`, `resizePiece(c, id, length)`, `convertPiece(c, id, arm?)`, `setEndCap(c, run, cap)`, `reorderPiece(c, id, toIndex)`, `fillGap(c, gapId, kind)` |
| Seams | `dragSeam(c, run, seam, dx)`: always called with the **gesture-start** config and the **cumulative** dx |
| Tables | `moveTable(c, id, placement)`; `anchoredTargets(c, id): {placement, anchor: Pt}[]` for drag snapping; `snapTable(startConfig, id, pointer)` |
| Loose | `addLoose(c, kind, at?)`, `moveLoose`, `resizeLoose`, `deleteLoose` |
| Codec | `encode(c): string`, `decode(s): {config} \| {error: 'damaged' \| 'newer'}` |

A no-op (e.g. `setLock` to its current value) returns `{config: input, rejected: null}`. `deletePiece`/`reorderPiece` on a wedge id: `notAllowed`. `fillGap` kind ∈ armless \| oneArm \| table; the arm on a seat fill is automatic (see Cushion floor); a table fill is refused over 108 and warns outside 16–40.

### 5.4 Rules

**Units.**
- Stored lengths and W/L/R are multiples of 0.5″. D and C are whole inches, so auto C = D + 16 and the slider range [D, D+30] are too (the prototype allowed D 40.5 and stored C 56.5).
- Inputs snap at the op boundary: W/L/R, piece lengths and seam dx to 0.5; D and C to 1 (`setWedge` rounds C to 1″ before clamping).
- Internal arithmetic is in half-inch integers (G10).
- Displayed-only values (angled face, clearance) are shown to 1 decimal.

**Runs and wedges (§8).**
- Available space:

  | Run | Available |
  |---|---|
  | U back | W − 2C |
  | L back | W − C |
  | Left leg | L − C |
  | Right leg | R − C |

- Run ends:

  | Shape | Back run | Each leg |
  |---|---|---|
  | U | wedge / wedge | wedge / open (end) |
  | L-left | wedge / open (end) | wedge / open (end) |
  | L-right | open (start) / wedge | wedge / open (end) |

- Wedges are structural, not run pieces.
  - Back-left wedge: (0,0)(C,0)(C,D)(D,C)(0,C).
  - Back-right wedge: x′ = W − x, with the point order reversed.
  - Duplicate vertices are dropped when C = D.
- **Invariant, checked after every op:** every run (gaps included) sums **exactly** to its available space; no stored seat or table is over 108 (gaps may be any positive length); every stored length is > 0 and on the 0.5 grid; every seat cushion is ≥ 6; the G11 arm invariant holds.

**Absorption (lock on, piece edits).**
- The anchor is the edited piece (which is excluded from absorbing) or a seam.
- Distance is counted in pieces; pieces touching the anchor are at distance 0.
- A split group counts as one unit. **Tables, wedges and arms never absorb.**
- **Freed space (+Δ):**
  - If the run has any gap: for a piece edit, the freed space becomes a gap immediately after the edited piece (or at the seam), merged with adjacent gaps; for a measurement/D/wedge change, the nearest existing gap grows. Placed pieces never change length (Blank mode).
  - Otherwise the nearest seat unit grows (ties: larger cushion, then lower index, as for needed space), auto-splitting if needed.
  - If the run has no seat at all, a gap is created.
- **Needed space (−Δ):**
  - Gaps first, nearest first.
  - Then seat units in order of distance, then **larger cushion**, then lower index. Each can shrink down to a **6″ cushion floor**, cascading to the next unit.
  - If space is still needed after that, the op is refused (`noRoom`).
  - The 20″ minimum stays a warning, never a clamp.

**Cushion floor.** Every seat cushion is ≥ 6″ after every op. An op that would make one smaller is refused with `noRoom` (resize, convert, `setEndCap` arm, `addPiece`, typed lengths). Default fill and `fillGap` add the arm only if the remaining cushion is ≥ 6, otherwise place an armless seat; a run or gap shorter than 6″ stays a gap. Seam drags use their own clamp (below).

**Measurements, D and wedge (§5, §7).** These always hold the outside size, lock on or off.
- A wedge end absorbs −ΔC. An open end absorbs its run's outside change. A U back takes ΔW in halves at its two wedge ends; the start end gets the extra 0.5. Growth is applied before shrinkage.
- **D:** presets 44 / 40 / 36, free entry in [30, 48], snapped to 1″, and D must exceed B. Auto C follows D + 16.
- **Manual C** sticks through D changes, clamped into [D, D+30], until "Reset wedge". The clamped value is stored: C 74 at D 44 → D 36 gives 66, and going back to D 44 keeps 66.
- **`resetWedge(c)`** sets `wedgeC = null` (C = D + 16). If that C doesn't fit, it is refused with `infeasible` + `min.W` (unlike the slider, which clamps).
- **Infeasible measurements** are refused (`infeasible`, with `min`) and the field shows the minimum.
- **Test 2:** D 44 → 36 gives C 52 and ΔC = −8. Each wedge end gives +8 to its nearest seat, skipping the table. Back armless becomes 52, legs 80.

**Auto-split and rounding (G9).**
- A logical seat is a lone seat or a split group.
- If its footprint is over 108, it becomes n = ceil(len / 108) pieces of **equal footprint, arm included**. The arm stays on the piece at the arm end.
- Remainder half-inches go to the pieces **farthest from the arm**; with no arm, to the pieces nearest the run start.

  | Length | Result |
  |---|---|
  | 148 (test 5) | 74 + 74 |
  | 148.5 | 74.5 + 74 |
  | 248 | 83 + 82.5 + 82.5 |
  | One-arm 200 | armless 100 + one-arm 100 (86 + 14) |

- A group is re-divided on every normalise, and re-merges into one piece (keeping the original id) once it fits in 108. So W 300 → 188 restores the armless 36.
- A manual edit of a member dissolves the group permanently: resize, convert, delete, table split, or dragging the seam *inside* the group. Dragging a group's *outer* seam keeps it equal.

**Tables (§6).**
- Width 16–40 is a warning only. More than 108 is a hard limit (tables cannot split). Several tables are allowed.
- **`seam` placement:** insert, then absorb.
- **`split` placement:**
  - The shared cushion is the target's cushion minus the table width with the lock on, or the target's **full** cushion with the lock off (the run then grows by the table width). It is shared equally on both sides.
  - The extra 0.5 goes to the side away from the arm (with no arm, to the start side).
  - The arm stays on the outer half.
  - At least 12″ of cushion must remain; otherwise the op is refused.
  - Both halves are tagged `joinedBy`.
  - **Test 3b:** leg cushion 58 − 32 = 26, giving [armless 13][table 32][one-arm 27 = 13 + 14].
- **`replaceArm` placement:** the end seat loses its arm (G5 decides whether the footprint or the cushion is kept), then the table is appended at the open end. Refused (`notAllowed`) when the end is already `table` or `armTable`; with end cap `open` it is simply a seam placement at the open end.
  - **Test 3a:** [armless 40][table 32]. The back absorbs +32, giving armless 68.
- **"Outside the arm"** is simply a `seam` at the run end next to a one-arm piece (end cap `armTable`). Lock on: [one-arm 40 (26 + 14)][table 32].
- **Moving a table:**
  - To a seam in the same run: a pure reorder (lengths unchanged, seam counted without the table).
  - Anywhere else: remove (G1 merge, then the source absorbs +w at the old seam, or the run shrinks with the lock off), then place.
- **Drag snapping** uses anchors: every seam, every seat midpoint (split), and two special anchors for the run end.
  - `replaceArm` is anchored on the arm's centre.
  - "Outside the arm" is anchored half a table beyond the open end.
  - Both land in the same place, so each needs its own anchor. The ordinary seam at the open end is **not** an anchor when the end piece is one-arm; that placement exists only as the outside-the-arm anchor.
  - The nearest anchor wins, with 6″ hysteresis.

**End caps (§4)** are derived from the end pieces:

| End pieces | End cap |
|---|---|
| End seat has an arm at that end | `arm` |
| End is a table whose inner neighbour has no arm | `table` |
| Table outside an arm piece | `armTable` |
| End is a gap | `unfilled` |
| Anything else | `open` |

`setEndCap` transitions:

| Target | From | Result |
|---|---|---|
| **arm** | open | Adds an arm to the end seat |
| | armTable | Removes the table (absorbed) |
| | table | Removes the table, then adds the arm |
| **table** | arm or open | 32″ table in place of the arm |
| | armTable | Drops the arm, keeps the table |
| **open** | any | Removes the arm and/or the table |

Refused on wedge-only runs and on unfilled ends.

**Lock.**
- **On (default):** piece ops never change W/L/R.
- **Off:** piece ops change their run's sum, and W/L/R are re-derived after every op:
  - U: W = sum(back) + 2C
  - L shapes: W = sum(back) + C
  - L = sum(left) + C; R = sum(right) + C
- A table moved from the back to a leg with the lock off changes both W and L.
- In a run containing a gap, space for a new or grown piece comes from gaps first (nearest first); only what the gaps can't cover grows the run. Freed space becomes a gap as with the lock on. So Blank mode behaves the same under both lock states, except that W/L/R can grow.
- Deleting the last non-gap piece of a leg with the lock off is refused (`notAllowed`, "Switch to an L instead").
- Typed measurements, D and the wedge slider still hold the outside size with the lock off.
- Turning the lock back on freezes the current values.
- While unlocked, the sidebar shows the values from the moment of unlocking as a reference ("W 206 · was 188"). This is UI state, not config.

**Blank mode (§2).**
- Wedges come with the shape. Each run starts as one stored gap. No arms are added automatically (test 8).
- New pieces use up gaps first, then cascade into seats (lock on or off, see Lock).
- Adjacent gaps merge; zero-length gaps are removed.
- "Fill" turns a gap into a seat, with an arm if the gap touches an open end and the cushion floor allows it.
- `exportBlocked` = any gap or any build error. This blocks **both** sheets. Share and save stay allowed.

**Seam drag (§7).**
- Allowed on seat|seat, seat|table and seat|gap seams. Not allowed on wedge seams (use the slider) or at the open end.
- dx snaps to 0.5 and the pair total never changes, so the lock does not matter.
- Each side is clamped to [min(rule, now), max(rule, now)], so a drag never creates a new violation and never jumps. The rules:
  - seat cushion ≥ 20
  - piece ≤ 108
  - table 16–40
  - gap ≥ 0
  - a split group has no upper bound (it re-splits)

**Presets.**
- **Default fill** of a run = one seat for the whole length, with an arm at the open end if its cushion is ≥ 6 (spec §8); auto-split if over 108.
- **`standardU()`:** W 188, L 132, R 132, D 44; back = [table 32][armless rest] if rest ≥ 6, else default fill; legs default fill.
- **`standardL(side)`:** W 132, kept leg 132 (the other leg's value stays 132), default fill, no table (Q5). The literal spec wording ("the same pieces minus one leg") would leave a 188″ back with the table at the open end and no arm; spec test 4 instead shows the L's back as a plain one-arm fill, so the plan follows test 4. The shape picker on an edited U (G2) deliberately keeps the user's pieces instead.
- **`blankConfig(shape)`:** one gap per run of length > 0.
- **`addPiece` defaults:** armless 36, one-arm 50 (36 + 14), table 32.

**Reorder.**
- Seats and gaps move within their run.
- One-arm pieces stay at their arm end (G11).
- Tables move with `moveTable`. Wedges are fixed.

**Derived numbers (§8).**
- **Seat depth** = D − B. Warn below 24.
- **Seat count:**
  - Each wedge counts 1.
  - A stretch is a run of seat cushion broken by wedges, tables, arms, gaps and run ends. Piece seams and split seams do *not* break a stretch.
  - Comfortable = floor(len / seatWidth); snug = floor(len / min(snugWidth, seatWidth)).
  - Label: "Seats N", or "Seats N–M" with an en dash.
- **Opening (U only):** W − 2D wide × min(L, R) − D deep. Warn if either is under 60. L shapes get `null`.
- **Wedge:**
  - Angled face = (C − D)·√2. Warn only when 0 < face < 8; a square corner is legal.
  - Readout: `Wedge 60 × 60 · angled face 22.6"`.
- **Clearance (G7):** coffee table only, per region, using exact distances (wedge faces included). Warn under 14. Standard U with a centred 48″ table: back 20, left 26, right 26, backLeft = backRight 21.2.
- **Default coffee-table position:** centred in the inside region, then pushed away from the sofa until every clearance is ≥ 14 when possible. Region: U = the opening; L-right x ∈ [0, W − D], y ∈ [D, R]; L-left x ∈ [D, W], y ∈ [D, L]. (The prototype's L fallback placed it on top of the leg.)

**Warnings** (amber chips, never blocking):

| Code | Fires when |
|---|---|
| `pieceOver108` | A piece is over 108 (safety net) |
| `seatUnder20` | A cushion (not the piece) is under 20 |
| `tableOutOfRange` | A table is outside 16–40 |
| `wedgeFaceUnder8` | The angled face is over 0 and under 8 |
| `openingUnder60` | Either opening dimension is under 60 |
| `seatDepthUnder24` | Seat depth is under 24 |
| `coffeeClearanceUnder14` / `coffeeOverlap` | Coffee table too close / overlapping |

**Loose pieces** never touch runs, the lock, W/L/R or the seat count. `resizeLoose` keeps w = d for the coffee table (§4 "free square", one "size" field in its menu); the ottoman is a free rectangle.

**Arm side** uses the industry convention of how the arm looks when you **face** the piece:

| Piece | Arm side |
|---|---|
| U left-leg end piece | LAF |
| U right-leg end piece | RAF |
| L-right back piece (arm at x = 0) | LAF |
| L-left back piece | RAF |
| L-left leg end piece | LAF |
| L-right leg end piece | RAF |

Owner question Q7.

---

## 6. Spec gaps and proposed resolutions

These are deduplicated from the spec audit (ENG-, 3D-, EXP-, PLAT-, ORTHO- ids) and from what the prototypes decided. Every resolution has been checked against all nine §12 tests. Rules for tests 1–9 run on the A prototype were re-verified on 2026-09-24.

| id | § | Issue | Resolution | Owner? |
|---|---|---|---|---|
| ENG-01 | §1/§11 | Config stores intent or lengths? | Explicit lengths; pure ops (§5) | no |
| ENG-02 | §1/§6 | Which seat absorbs; the table sits next to the left wedge in tests 2 and 6 | Nearest seat unit, tables skipped; then larger cushion, then lower index; 6″ floor with cascade | no |
| ENG-03 | §4/§8 | Arm as element vs part of the piece | Part of the one-arm piece's length (`length` includes 14); outputs expose `cushion` | no |
| ENG-04 | §4/§6 | "Outside the arm" vs the three end caps | Derived state `armTable`; with the lock on the table sits inside L/R | no |
| ENG-05 | §4/§7 | End-cap transitions undefined | `setEndCap` table in §5.4 | no |
| ENG-06 | §6/T3b | No seam in the middle of a one-piece leg | `split` placement, centred in the cushion span (arm excluded) | no |
| ENG-07 | §7/§8 | Stored splits don't come back (300 → 188 gives 18 + 18) | Split groups re-merge (tested: armless 36 with the same id) | no |
| ENG-08 | §3/§7 | Splitting a one-arm piece: equal frames or equal cushions | Equal footprint (literal §7), arm on the end piece | **Q6** |
| ENG-09 | §8 | 0.5 rounding vs free input | Snap at the op boundary; half-inch integers inside | no |
| ENG-10 | §2/T4 | Standard L contents | Default fill, **no table**, 132 × 132; follows test 4 rather than the literal "minus one leg" (§5.4 Presets) | **Q5** |
| ENG-11 | §7 | Shape switch on an edited layout | G2 | no |
| ENG-12 | §4/§8/§10 | Mirroring and arm-side naming | Mirror formula in §5.4; LAF/RAF as you face the piece | **Q7** |
| ENG-13 | §1/§5 | Lock-off semantics | §5.4 "Lock" + G5 | no |
| ENG-14 | §1/§4 | Absorber can go ≤ 0 | 6″ cushion floor; refuse with `noRoom` | no |
| ENG-15 | §7/§8 | Infeasible inputs (W < 2C + contents) | `infeasible` + `limits()` minimums; slider clamps (G3) | no |
| ENG-16 | §7 | Which seams have handles | seat\|seat, seat\|table, seat\|gap; not wedge seams or the arm line | no |
| ENG-17 | §5/T6 | Per-corner vs global C | One global C (test 6 needs it) | no |
| ENG-18 | §3/§5 | Manual C after a D change; D range | Clamp to [D, D+30], keep manual; D in [30, 48] | no |
| ENG-19 | §5/§8 | Square corner fires the face warning | Warn only when 0 < face < 8 | no |
| ENG-20 | §8 | Stretch boundaries; snug setting | §5.4 seat count; `snugWidth` = 24 | no |
| ENG-21 | §3/§8 | Minimum seat measured on piece or cushion | Cushion; §4 ranges are warnings | no |
| ENG-22 | §8 | Opening for an L; which side the 60 applies to | U only, either dimension; L gets `null` | **Q8** |
| ENG-23 | §4/§8 | Clearance geometry | G7 | no |
| ENG-24 | §4/§14 | Loose pieces: sizing, heights, which sheets show them | Ottoman free rectangle (starts 36 × 36), coffee table free square (starts 48 × 48), 0.5 snap. Heights 18 / 16 in `HavenDims`. Ottoman on the shop piece list; coffee table is a prop, client sheet only. Both in 3D and the plan; hidden in elevations by default | **Q11, Q29** |
| ENG-25 | §2/§8 | Blank gap model | Stored gap pieces (§5.4) | no |
| ENG-26 | §7 | Reorder limits; editing in 3D? | G11; 3D is view-only | no |
| ENG-27 | §1/§9 | Views re-deriving sub-parts could disagree | `pieces[]` carries arm/back/cushion rects; `profiles.ts` holds heights | no |
| ENG-28 | §8/§9 | Plan frame is left-handed; top view could flip | Pure `engine/world.ts` `planToWorld(x, y, h) = (x − cx, h, y − cy)` (E20a, H1); Top at azimuth 0 puts the back at the top of the screen (E20b, H3) | no |
| ENG-29 | §12 | Incomplete fixtures | Explicit fixtures and extra assertions (§11) | no |
| ENG-30 | §7 | Reset / undo granularity | Reset (TopBar, H2) = the preset for `ui.lastStart` at default size, one undoable commit, confirm first if the config differs from it; one undo step per pointer-up (keyed coalescing for keys and steppers) | no |
| NEW-1 | §6 | Path dependence (prototype A) | G1 merge-back | no |
| NEW-2 | §7 | Refusals are silent | G6 `EditResult` | no |
| NEW-3 | §7 | The two prototypes chose different split rules | G9 (one rule, one test) | Q6 |
| NEW-4 | §10 | Codec stability across engine versions | Stored lengths make links stable; golden links per codec version kept forever | no |
| NEW-5 | §2/§9 | Blank gaps in 3D | Hatched floor decal + "unfilled 68″" label (§7.4) | no |
| 3D-01 | §3/§9 | Table at 23 breaks the 27 back | Back and back cushion stop at each table (full-depth table) | **Q12** |
| 3D-02 | §9/§14 | Back geometry | Frame 4 deep, 1–27; cushion 6 deep, 10–26, no rake; one back cushion per seat cushion; wedge gets 2, mitred | **Q10, Q13** |
| 3D-03 | §9 | Cushion division | One seat cushion per piece cushion span; wedge seat (B,B)(C,B)(C,D)(D,C)(B,C) | **Q13** |
| 3D-04 | §9 | Back vs arm meeting | Back stops at the arm; arm is a rounded prism 14 × D, 1–23 | Q12 |
| 3D-05 | §3 | Leg diameter and placement | 1.5″ dia × 1″, 3″ inset at footprint vertices; centre pair on pieces > 72″ | **Q14** |
| 3D-06 | §3 | Seat height reference | `profiles.ts`: legs 0–1, body 1–10, cushion 10–18 crown / 16 edge, arm 23, back 27, table 23 | no |
| 3D-07 | §9 | Pillow placement; assets | 2 square + 1 ball per wedge, 1 square per arm end, none at Table/Open ends; `.glb` without Draco | **Q15, Q16** |
| 3D-08 | §9 | Sketch reference image missing | Andre supplies it before H5 | **Q16** |
| EXP-01 | §10 | Contents of the client vs shop sheet | §9 of this plan | **Q20, Q30** |
| EXP-02 | §10 | jsPDF can't draw SVG | svg2pdf.js, vector | no |
| EXP-03 | §10 | Downloads in the installed iOS app | Two taps: Generate, then `navigator.share({files})`; laptop uses `save()` | no |
| EXP-04 | §10 | Share-link design and audience | Text codec v1 in the URL fragment; no names or prices | **Q17** |
| EXP-05 | §2 | Where saved configs live | On the device: URL hash + localStorage draft + localStorage "Saved layouts" list (H6); cross-device saves are optional H7 | **Q18** |
| EXP-06 | §9/§10 | "Don't stretch models" vs "rebuild with real models" | Export `parts[]` dimensions and both cameras; Andre defines "real models" before H8 | **Q24, Q31** |
| EXP-07 | §10 | Hard-coded "44″D" callout | Print the live D | no |
| PLAT-01 | §11 | Where it lives; bundle; offline use | Standalone repo + Vercel project, no backend, entry-chunk budget, precache service worker (§3) | Q2 (answered) |
| ORTHO-01 | §7 | Two readings of "orthographic" | Camera reading; drafting 3-up as the alternative | **Q1** |
| ORTHO-02 | §7 | Preset definitions | §7 of this plan | no |

---

## 7. Orthographic 3D view

**Screenshots**, all under `ortho-demo/shots/` (Appendix B):
- 3/4 view: `ipadLandscape-trimetric.png`
- Elevations and plan: `ipadLandscape-front.png`, `-side.png`, `-top.png`
- Parity overlays: `parity-overlay-{1180x820,820x1180,390x844}.png`
- Third-angle sheet: `export-sheet-third-angle-4ppi.png`
- Outline styles compared: `style-{outline,soft,edges}-trimetric.png`

### 7.1 Camera and controls

**Canvas.**
```tsx
<Canvas orthographic frameloop="demand" dpr={[1, 2]}
        camera={{ near: 1, far: 6000, position: [0, 0, 2000] }}
        onCreated={({ gl }) => { gl.toneMapping = NeutralToneMapping }}>
```
- Pass **only** near/far/position. Passing left/right/top/bottom sets `camera.manual`, and R3F then stops resizing the frustum.
- Don't use drei `<OrthographicCamera>`: it always allocates a 256² render target and a per-frame hook.
- Orthographic depth is linear: near 1 / far 6000 gives 0.00036″ per depth step (*measured*, 24-bit depth buffer).

**Controls.** drei `<CameraControls makeDefault impl={DemandSafeCameraControls}>`:
- Pinch and wheel change `camera.zoom`, and zoom toward the pinch point (`dollyToCursor`).
- Two-finger pan.
- The subclass fixes the first frame after idle. It clamps that frame's delta to 1/60 s and later deltas to 0.1 s. Without it, the first frame covered 98.6% of a preset tween; with it, 0.6% followed by a 26-frame tween (*measured*).

**Don't use:**
- camera-controls `fitToBox`: it rounds angles to 90°, which breaks the 3/4 preset.
- drei `<Bounds>`: it throws when used with CameraControls.
- `setLookAt` for presets: it ignores the angle limits and can spin the long way. Use it only once on mount, to place the camera 2,000″ from the target.

**Applying a preset.** `normalizeRotations()`, then `rotateTo(nearestAngle(current, θ), φ, true)`, `moveTo(target, true)` and `zoomTo(fit, true)`. `smoothTime` 0.3.

**Limits.**
- Polar angle [0°, 90°]: never below the floor. Elevations sit exactly on the 90° limit.
- Azimuth is free.
- `setBoundary` = `BuildResult.bounds` (sofa **and** loose pieces) + 24″.
- `minZoom` = 0.5 × the smallest preset fit for the current viewport; `maxZoom` = 40 px/in.

**Auto-fit.** Presets, rotation and resize re-fit until the user touches the camera (`controlstart`). After that, a resize keeps the user's zoom. *Measured* both ways: rotation refit 4.764 → 3.155 px/in; a user zoom of 4.58 was kept across rotation.

### 7.2 Presets

**World mapping.** Plan (x, y, height) maps to three (X, Y, Z) = (x − cx, height, y − cy), where (cx, cy) is the centre of the plan's bounding box. The world must be centred because ContactShadows renders its blur pass at the world origin. `camera.up` is always (0, 1, 0).

Direction is the vector from the target to the camera. Fit values are *measured* in px/in on iPad landscape 1180×820 / iPad portrait 820×1180 / phone 390×844.

| Preset (label) | Direction | Screen axes | Fit (iPad L / P / phone) | Notes |
|---|---|---|---|---|
| **Top** | (0, 1, 0), polar ≈ 0, azimuth 0 | right = +X; up = −Z (back at the top, same as the SVG plan) | 5.038 / 3.84 / 1.83 | **Parity mode** `setTopAt(S, cx, cy)`: zoom = the plan's px/in, target = the plan point at the view centre. Parity *measured* to 1e-4 px |
| **Front** | (0, 0, 1): from the open end | right = +X | 5.798 / 3.84 / 1.83 | Width-bound (188 × 27 is 7:1). **Phone (≤ 480 px wide):** opens at zoom = max(fit, 3 px/in), anchored to the left end, pan horizontally (so it does not frame the whole sofa) |
| **Side** | U and L-right: (1, 0, 0) (right elevation). L-left: (−1, 0, 0) (left elevation) | right elevation: right = −Z (open end on the left) | 8.258 / 5.47 / 2.606 | Same phone rule as Front |
| **3/4** (default 3D view) | trimetric, azimuth ±30°, elevation 30°: (±0.4330, 0.5, 0.75). +30 for U and L-left; −30 for L-right, so the leg's inside face shows | foreshortening x 0.901, y 0.866, z 0.661 | 4.764 / 3.155 / 1.503 | Opens the U toward the viewer; both wedges, the table and both legs' insides are visible. For looking, not measuring |
| **Iso** (to scale) | azimuth ±45°, elevation 35.264°: (±0.5774, 0.5774, 0.5774), same side rule | all axes × 0.8165 | 4.355 / 3.191 / 1.52 | One scale bar (× 0.8165) measures lengths, depths and heights along the three axes **only**: the 45° wedge faces read +22% / −29%. The U reads as a diamond. Not on any sheet unless Q30 says so |

Dimetric 45/30 was evaluated and **not shipped**: it looks almost identical to Iso. The ortho demo still defaults to it (`ortho-demo/src/App.tsx:9–12`), so H3 does not port it straight: `presets.ts` moves to `ortho/`, "3/4" = trimetric with the L-right sign flip, Iso keeps its own button, and the dimetric preset is deleted.

**Fit rule (`ortho/orthoFit.ts`, pure):**
- Project the silhouette points onto the preset's screen basis. The points are every part-polygon corner at its bottom and top heights (run pieces, loose pieces, gap decals, and from H5 the pillow anchor boxes from the `.glb` bounds), plus the floor slab, all taken from engine data (never `Box3.setFromObject`).
- Padding p = 6% of the short side, clamped to 20–64 CSS px.
- zoom = min((W − 2p) / spanU, (H − 2p) / spanV).

**Scale overlay** (HTML, driven by `camera.zoom`, so it is exact): a scale bar in Top, Front, Side and Iso (× 0.8165 in Iso, labelled "along length / depth / height only"), hidden in 3/4. In Front and Side, stacked height ticks at 1 / 18 / 23 / 27″ from `BuildResult.heights`. This is what makes the orthographic view readable in a client meeting.

**Plan ↔ 3D hand-off.** The first switch to 3D opens Top in parity mode (the same scale and centre as the plan), then animates to 3/4, so the two views visibly show one drawing. Later switches restore the last preset.

### 7.3 Depth cues (all verified in the screenshots)

1. **Camera-relative key light.** A directional light from camera-space (−0.55, 0.75, 1), re-aimed on every rendered frame and for every export camera. Plus a hemisphere light (sky #fff, ground #b9ab97, intensity 1.2) and a weak fixed fill. A fixed world light made the side elevation look grey.
2. **Outlines.** drei `<Outlines thickness={1.25}>` with the **default** `screenspace={false}`, which is the pixel-constant mode (the prop name is misleading). Stays 1 px at 5.8 and at 20 px/in. The alternatives were worse: no lines lost the cushion boundaries, and `<Edges>` looked like a CAD wireframe.
3. **Contact shadow.**
   ```tsx
   <ContactShadows position={[0, -0.1, 0]} scale={[boundsW + 60, boundsD + 60]} far={9} blur={2.5}
                   opacity={0.85} resolution={1024} frames={1} key={configHash} />
   ```
   - `far` must be under the 10″ deck so only the base parts cast. Otherwise draw order lets the cushions lighten the shadow.
   - Placed off the world origin, its render target came out empty.
   - Strong in Top, subtle in 3/4.
4. **Floor.** A 1.5″ light-oak slab with 6″ planks and `repeat = size / tile` (box UVs run 0..1), top surface at y = −0.2 (under the shadow plane at −0.1; legs start at 0). A slab with its top at 0 would hide the shadow. Sized to `bounds` + 60″. It gives the elevations a ground band.
5. **Tone mapping.** NeutralToneMapping; ACES turns white bouclé grey and yellow.
6. **Left out:** shadow maps (the default shadow frustum is 10″ wide in inch units, and PCFSoft was removed in three r186), SSAO, post-processing, HDRI background.

### 7.4 Procedural geometry (`three/parts.ts`, `three/prism.ts`)

**Part heights.** Every part is `roundedPrism(poly, z0, z1, r)`. Run-local coordinates (s along the run, t depth from the back edge) map to plan coordinates as:
- back run: (s, t)
- left leg: (t, s)
- right leg: (W − t, s)

| Piece | Parts (footprint · height range in inches) |
|---|---|
| Armless / one-arm | body t 4..D · 1–10 · back frame t 0..4 · 1–27 · back cushion t 4..10 · 10–26 · seat cushion t 10..D (0.25″ seam gaps) · 10–16 at the edges, crowned to 18 (`cushionEdge` / `cushionCrown`) · arm (one-arm, last 14″) t 0..D · 1–23 |
| Table | full footprint · 1–23, walnut or dark wood; back and cushions stop at the table (3D-01) |
| Wedge | §8 polygon (mirrored for back-right). Body = polygon inset 4″ on both outside edges · 1–10. Two frames + two back cushions along the outside edges. Seat (B,B)(C,B)(C,D)(D,C)(B,C) · 10–18 |
| Legs | 1.5″ dia × 1″ at footprint vertices, inset 3″, instanced |
| Ottoman | rounded prism w × d on 1″ legs, top at `ottomanHeight` 18, fabric |
| Coffee table | slab w × d, top at `coffeeTableHeight` 16, `tableFinish` |
| Gap (Blank) | flat hatched floor decal, 0.1″ thick, same hatch as the plan, plus an HTML label "unfilled 68″"; included in bounds and fit |
| Pillows (H5) | `.glb` at wedge and arm-end anchor points from the same data |

Loose pieces are hidden in the Front/Side presets and in the vector elevation by default (a centred coffee table would hide the back run), with a "show loose pieces" toggle.

**`roundedPrism` construction.**
- `ExtrudeGeometry` with depth h − 2r, `bevelSize` r, `bevelThickness` r, **`bevelOffset` −r**, 4–5 bevel segments (3 shows facets at 20 px/in).
- Then `rotateX(+π/2)`, translate, and `toCreasedNormals(π/5)`.
- The side walls sit exactly on the polygon, so the Top silhouette equals the SVG plan.
- **No two parts may share a face.** Coplanar body and frame faces z-fought as a visible band in the elevations.
- **Crowned seat cushion (required, H3):** a subdivided custom top cap rising from `cushionEdge` (16″) at the ends to `cushionCrown` (18″) mid-span. A flat 18″ top would make the Front preset and the client-sheet render disagree with the shop sheet's vector elevation, which draws the crown.

**Performance.**
- Memoise geometry per piece, keyed by its dimensions, so a seam drag rebuilds two pieces. Dispose geometry on change.
- About 80 draw calls for the Standard U. Instancing the legs and merging static parts per material brings it under 10.

### 7.5 Touch, performance, battery

**Gestures.** One finger orbits. Two-finger pinch zooms toward the pinch point, and two fingers also pan. Mouse: left orbits, right pans, wheel zooms.
- *Measured* with CDP touch: a pinch took zoom from 3.155 to 5.404 px/in while page scale stayed 1.000. Zoom clamps at 40 and 1.578. Orbit stops at 90° polar.
- Control check: the same pinch on the toolbar zoomed the *page* 5×, which shows the canvas-level setting below is what prevents page zoom.

**Stopping page zoom and scroll** (iOS ignores `user-scalable=no`). On the 3D container:
- `touch-action: none`, `-webkit-touch-callout: none`, `user-select: none`.
- A non-passive `gesturestart`/`gesturechange` `preventDefault`.
- `overscroll-behavior: none` on the route.

**Other rules.**
- Preset buttons are at least 44 px.
- Tap-to-inspect uses R3F `onClick` on part meshes. Ignore it when `event.delta > 6` px, so orbits don't select.

**Battery and performance.**
- `frameloop="demand"`: 0 frames rendered in 2.5 s of idle (*measured*).
- `dpr [1, 2]`. Optionally `<CameraControls regress>` with `performance={{min: 0.5}}` to drop resolution while orbiting.
- ContactShadows renders once (`frames={1}`), re-keyed only on config change. That is two 1024² targets, about 8 MB of GPU memory.
- **UNVERIFIED:** frame rate on a real iPad. SwiftShader's ~300 ms/frame is a CPU renderer and not representative.
- Warm the 3D chunk after first paint, so it is already in the HTTP cache when the iPad leaves the shop's Wi-Fi even before the service worker (§3) has finished precaching on a first visit. iOS Safari has **no** `requestIdleCallback` (it would throw and blank the route), so feature-detect: `const idle = window.requestIdleCallback ?? ((cb) => window.setTimeout(cb, 1500)); idle(() => void import('./three/ThreeView'))`, cancelled with the matching cancel on unmount. A unit test (jsdom) deletes `window.requestIdleCallback` and mounts `App`.

### 7.6 PNG capture and export renders

**`exportView(preset, pxPerInch, {floor, shadows, padIn})` → `{url, pxW, pxH, pxPerInch, u0, z0}`**, in the lazy `three/export.ts` (H6). If 3D has never been opened (export from Plan view), it creates its own `WebGLRenderer` on a detached canvas (antialias, NeutralToneMapping), builds `SofaModel` from `BuildResult`, renders, then disposes the renderer and forces context loss. When 3D is mounted it reuses the live renderer:
1. Build a dedicated `OrthographicCamera` whose frustum is in inches, from the tight fit plus padding.
2. Resize only the drawing buffer: `setPixelRatio(1)` and `setSize(w, h, false)`.
3. For technical sheets, hide the floor and the contact shadow (a shadow wider than the frame gets hard-clipped).
4. Re-aim the key light at the export camera, render, and read with `toDataURL`.
5. Restore the renderer and re-render the live view **in the same task**.

**Measured:**
- The live view had 0 changed pixels afterwards.
- At 6 px/in the front elevation measured 1130 × 163 px against an exact 1128 × 162 (188 × 27″). The extra 2 px are the outline and antialiasing.

**Also:**
- `preserveDrawingBuffer` is not needed, because render and read happen in the same task.
- Never export through a `WebGLRenderTarget`: in r186 render targets are linear and not tone-mapped, so the image would not match the screen.
- Keep each export ≤ ~4,000 px per side (iOS canvas memory).
- Convert renders to JPEG q0.85 before putting them in a PDF: 104 kB and ~0.1 s, against 697 kB and 1.5 s for PNG (*measured*).

**Bundle.** The lazy 3D chunk is 1,012.28 kB raw / 273.25 kB gzip / 219.5 KiB brotli (*measured*, vite 7.3.6).

| Library | gzip |
|---|---|
| three | 192.8 kB |
| R3F | 52.3 kB |
| camera-controls | 10.4 kB |
| three-stdlib | 6.4 kB |
| drei (used parts) | 4.3 kB |

**Don't:**
- ship a vendor `manualChunks` config: it made the 3D chunks load eagerly;
- import drei `StatsGl`: it pulls in a second copy of three (0.170).

**Version pins.**
- Keep `@vitejs/plugin-react` ^5 while the repo is on vite 7 (version 6 needs vite 8). H0b picks the Vite major; if it is 8, use plugin-react 6 and re-check the R3F/drei builds (**UNVERIFIED**).
- R3F 9.8 peers React >= 19 and < 19.4, so React upgrades wait for R3F (pin React 19.2.x in H0b).
- Expect two harmless console warnings: `THREE.Clock` deprecated, and the PCFSoft warning if `shadows` is ever set.

---

## 8. Plan view and interaction

**SVG architecture.**
- `<PlanDrawing built k look theme …/>` returns a `<g>` in plan inches (y down, origin at the outside back-left corner, §8). The same markup is wrapped by the screen editor and by the PDF sheet.
- Group order:
  1. wedges
  2. runs: fill → backs → arm → cushions → grain → outline → warning overlay → selection
  3. gaps: explicit 45° hatch, dashed outline, "unfilled 68″" chip
  4. loose pieces
  5. `DimsLayer`
  6. seats
- Anything that must not scale with zoom (strokes, fonts, arrows) is given in display units × `k`, where k = inches per CSS px on screen, or per pt on paper.
- Colours are literal values in a `PlanTheme` (`LIGHT`, `SKETCH`). No CSS variables inside the SVG, because svg2pdf can't resolve `var()`.
- Font family is lowercase `helvetica`, weights 400 or 700 only. Capitalised `Helvetica` silently falls back to Times, and 600 doesn't map to bold.

**Dimension layout** (`plan/dims.ts`, pure, deterministic):

1. **Requests:**
   - Top: a chain [C | back pieces and gaps | C] plus the overall W with a feet-inches label (`188" (15'-8")`).
   - Left and right: a chain [C | leg pieces] plus the overall L or R.
   - `D"` callouts: live D (EXP-07), across the leg end, and at an L's open back end.
   - Table widths in bold. Gaps on dashed dimension lines.
2. **Fit:** arrows are used when the segment is at least 2·arrow + 4. Tight chains switch to dot terminators. A lone short dimension gets outside arrows.
3. **Labels:** least-squares placement (PAVA isotonic regression). Labels that can't fit alternate onto a second row with leaders.
4. **Tiers:** chain < callout < overall. The overall dimension is always outermost.
5. **Text:** vertical labels rotated −90°. Widths come from the Helvetica AFM table, so layout is identical in tests, on screen and in the PDF.

Two profiles:

| | SCREEN (px) | PRINT (pt) |
|---|---|---|
| Chain / overall font | 12 / 13 | 7 / 8 |
| Arrowhead | 8 × 2.6 | 5.5 × 1.4 |
| Extension gap / overshoot | 4 / 5 | 2.5 / 3 |

*Measured:* 0 overlapping labels and 0 clipped labels across 36 renders (9 fixtures × 3 viewports + Sketch). PDF scale is exact: at 3/8″ = 1′-0″ (2.25 pt/in) the shop sheet's two wedge "60″" label centres are 288.00 pt apart, i.e. (188 − 60) × 2.25.

**Screen fit.** `fitScreen(built, w, h)` iterates 2–3 times, because the dimension margins are in px and depend on k. It is computed from the **committed** config. The viewBox, k and CTM stay frozen during a gesture, so a lock-off drag never rescales under the finger.

**Gesture engine** (`usePlanGestures`):
- **pointerdown:**
  - Ignored if a gesture is already running (a second finger).
  - Freeze the CTM inverse, k and the viewBox.
  - `hitTest` in plan inches.
  - `setPointerCapture` on the **root `<svg>`**. Grips can be re-keyed when a split changes, which would drop capture.
  - Record `{kind, pointerId, start, startConfig}`.
- **pointermove:** store the point and schedule one animation frame. The frame runs `op(startConfig, …)` and then `setDraft`. It never applies moves incrementally, so nothing drifts.
- **pointerup:** flush the last frame, then `commit`.
- **pointercancel / lostpointercapture:** `cancelDraft`.

**Interactions and their engine ops:**

| Interaction | UI | Engine op |
|---|---|---|
| Measurements | `MeasureField`: text, `inputMode=decimal`, `enterKeyHint=done`, ≥ 16 px font. Accepts `188`, `188.5`, `188 1/2`, `15'8"`. Draft 150 ms after a valid parse; commit on blur/Enter; Escape cancels. On refusal, revert and show "min 158″". ±1″ steppers (coalesced). D preset chips 44/40/36 | `setMeasurements` |
| Shape picker | Segmented U / L-left / L-right | `setShape` |
| Start menu | Dialog: Standard U · Standard L (left/right) · Blank (shape + W/L/R/D) · "Resume last layout (date)" from the localStorage draft · Saved layouts (H6, localStorage). A normal undoable commit plus a toast; sets `ui.lastStart` | `standardU` / `standardL` / `blankConfig` |
| Reset | TopBar button. Confirms first when the config differs from the preset; one undoable commit with key `reset` | preset for `ui.lastStart` (`standardU` / `standardL` / `blankConfig`) |
| Lock | Switch. When off, W/L/R show "from pieces" plus the value at unlock | `setLock` |
| Wedge slider | Radix Slider, range = `wedgeRange` within [D, D+30], step 1, 44 px thumb, ± steppers. `onValueChange` → draft, `onValueCommit` → commit. Readout `Wedge 60 × 60 · angled face 22.6"`, amber chip under 8. "Reset wedge" enabled while `wedgeC !== null` | `setWedge`, `resetWedge` |
| Seam handles | 44 pt grips 14 px outside the seat front, in the open area; the nearest grip wins; crowded grips stagger. Mouse and pen also get ±7 px on the seam line; touch never grabs the line. HTML pill 72 px above the finger showing `40" \| 28"`. Keyboard: `role=slider`, arrows ±0.5″, Shift ±6″, coalesced by key within 800 ms | `dragSeam(startConfig, run, seam, cumulativeDx)` |
| Table drag | Press a table and move 6 px. Anchored targets, nearest wins with 6″ hysteresis, live preview (the 3b warning shows during the drag). Trash zone in the tray; dropping on nothing snaps back | `snapTable` / `moveTable` |
| Reorder | Long-press 350 ms (touch) or a 6 px drag (mouse); target = number of piece centres before the pointer | `reorderPiece` |
| Tap menu | Tap: under 6 px and under 500 ms. Radix Popover anchored to the piece's bbox; bottom sheet on phones. Seat: title (`One-arm seat · 72" (58 + 14 arm) · LAF`), length, convert, end cap (at open ends), delete. Table: width chips 24–40, delete. Gap: Fill with… | `resizePiece`, `convertPiece`, `setEndCap`, `deletePiece`, `fillGap` |
| Add-piece tray | Armless 36, One-arm L/R, Table 32, Ottoman, Coffee table. **Tap to place (primary on iPad):** "+" pins at every valid target. Or drag from the tray through the plan's CTM | `addPiece`, `addLoose` |
| Loose pieces | Free drag with 0.5″ snap; live clearance dimensions, amber under 14 | `moveLoose` |
| View / look | Plan \| 3D (lazy); CAD \| Sketch (H5) | UI only |
| Keys | Cmd/Ctrl+Z, Shift+Cmd+Z / Ctrl+Y, Delete, Escape | undo / redo / delete / cancel |

*Measured* with CDP touch at iPad 1180 × 820, DPR 2:
- A seam drag held capture while crossing the toolbar and produced `[40, 28]` as exactly one undo step.
- A table drag produced 3b in one step, at 0.55–0.69 ms per move (9 candidate builds per move).
- touchCancel left no trace.

**Undo / redo** (`state/history.ts`, hand-rolled, about 60 lines):
- `commit(next, {key})` skips when `next === config` (includes refused edits) and pushes the previous config (limit 100).
- The same key within 800 ms replaces the top step.
- `undo`/`redo` are ignored while a draft is live.
- UI changes never enter history.
- *Measured* (vitest): 20 draft moves + 1 commit = 1 step; cancel leaves no trace; 6 fast nudges = 1 step.
- zundo 2.3.0 was rejected. It needs a custom `equality` plus a restore-while-paused workaround to get the same behaviour, and its last release was 2024-11.

**URL sync** (`state/useUrlSync.ts`; there is no router).
- 300 ms after a commit, `history.replaceState(null, '', location.pathname + location.search + '#c=' + encode(config))`. Never on drafts. Keeping `location.search` preserves `?view`; a test checks `?view` survives a commit.
- `replaceState`, not `location.hash = …`: assigning the hash pushes a browser history entry per edit and fires `hashchange`.
- The hash, not search params: changing it never reloads the page, and it is never sent to the server (no layout in Vercel logs).
- A `hashchange` from outside the app (a pasted link, the browser Back button in a tab) decodes and loads that layout as one undoable commit; a damaged or newer link shows the codec's message and keeps the current layout.
- Load order: hash, then Standard U (spec §2: it "loads first"). The localStorage draft is never loaded automatically; it is offered as "Resume last layout" in the Start menu. The draft is written 1 s after each commit (as a codec string, through `state/storage.ts`).

**Saved layouts (H6, per device).**
- "Save" asks for a name and stores `{id, name, code, savedAt}` in a localStorage list (codec string, newest first, cap 200). The Start menu's "Saved" lists them with rename, duplicate and delete (delete asks to confirm).
- They are **per device and per browser context**: on iOS the home-screen app has its own storage, separate from Safari's, so a layout saved in Safari does not appear in the installed app. The Saved list therefore offers "Share link" on every row, which is the cross-device path until H7.
- On first save, call `navigator.storage.persist()` (feature-detected, result ignored) to ask the browser not to evict the list.
- **UNVERIFIED:** whether iOS evicts script-written storage of a home-screen app that goes unopened for weeks (WebKit's 7-day rule counts days of use per app). Mitigation: the share links above, and H7 if it matters.

**iPad Safari specifics.**
- `touch-action: none` on the plan `<svg>`, slider thumbs, and a tray chip while it is dragged. `manipulation` elsewhere, which kills double-tap zoom.
- `-webkit-user-select: none` and `-webkit-touch-callout: none` on the plan. SVG text gets `pointer-events: none` (otherwise long-press shows the loupe).
- Hover styles only under `@media (hover: hover)`. Grips are always visible.
- Hit tolerance by `pointerType` (the Pencil reports as `pen`).
- Safe areas: `env(safe-area-inset-top)` on the top bar and `env(safe-area-inset-bottom)` on the slider/tray (`viewport-fit=cover`, §3). They compute to 0 in a normal browser, so they look like no-ops but are not.
- Don't refit on keyboard-driven `visualViewport` changes; a ResizeObserver on the container handles rotation.
- Orientation: the app's own manifest sets **no** `orientation`, so both work (Safari does not implement manifest orientation anyway, per MDN compat data). One-minute rotation check on the iPad in H0b.
- **Phones** are for viewing, sharing and opening shared layouts. Seam editing works but is not guaranteed at 1.47 px/in (Q27). Noted in CLAUDE.md.

---

## 9. Outputs

**Pipeline** (lazy `export/pdf.ts`):
1. Build the sheet SVG in pt (Letter landscape, 792 × 612) by rendering `<Sheet>` with `createRoot` + `flushSync` into a detached div.
2. `new jsPDF({orientation: 'landscape', unit: 'pt', format: 'letter'})`.
3. `await doc.svg(el, {x: 0, y: 0, width: 792, height: 612})`.
4. `viewerPreferences({PrintScaling: 'None'})`.
5. `output('blob')`.

*Measured:* vector shop sheets are 6–8 kB and take 31–48 ms; text is selectable; scale is exact. jspdf 386.24 kB + svg2pdf 87.53 kB raw (~160 kB gzip together), loaded only when exporting.

**Delivery.** iPad: two taps ("Generate", then "Share PDF" → `navigator.share({files})`), because user activation expires during generation. Laptop: `doc.save()`. PNG: the same SVG drawn to a canvas at 200 dpi (2200 × 1700, 581 kB) for "send as image".

**Scale.**
- `fitSheet` picks the largest of 1″, 3/4″, 1/2″, 3/8″, 1/4″, 3/16″, 1/8″ = 1′-0″ that fits. The Standard U prints at 3/8″; W 300 at 1/4″.
- Prints "SCALE 3/8" = 1'-0" (Letter, print at 100%)" and a graphic scale bar, which stays correct even if a printer rescales.
- Helvetica with straight quotes: WinAnsi lacks ″ and ′.

**Client sheet** (blocked while `exportBlocked`):
- CAD plan: overall W/L/R with feet-inches, table widths, the live `D"` callout, "Seats X–Y".
- Piece seams drawn but **not** dimensioned (Q20).
- A **shaded orthographic front elevation** (`exportView('front', ppi)`, JPEG) placed under the plan, x-aligned, at the **same scale**. Placement: x = originX + u0·S, width = pxW / ppi · S, where S = 72 × paper scale (*measured*: aligns exactly).
- A 3/4 render labelled "Illustration, not to scale" (default of Q30; the alternative is the Iso render with a × 0.8165 axis scale bar).
- A block with Seats, seat depth, opening, fabric and table finish.
- Title block: client/project (typed at export time; never in the link), date, and a short link or QR.

**Shop sheet:**
- Page 1:
  - The same plan with **chain dimensions on every piece**. One-arm pieces show `72 (58+14)`.
  - Amber warning overlays.
  - Wedge C and angled face.
  - A **vector front elevation**, drawn with painter's-algorithm hidden lines from `pieces[]` + `profiles.ts`, with stacked 1 / 18 / 23 / 27″ height dimensions using ordinate-style marks (a plain leader dipped below the floor in the prototype).
  - The right elevation is added when it fits the page.
- Page 2: a piece list grouped by (type, length, arm side).

  | Qty | Piece | Length × depth | Seat + arm | Arm side | Heights (leg / seat / arm / back) | Notes |
  |---|---|---|---|---|---|---|
  | 2 | One-arm seat | 72 × 44 | 58 + 14 | 1 LAF, 1 RAF | 1 / 18 / 23 / 27 | |
  | 1 | Armless seat | 36 × 44 | 36 | – | 1 / 18 / – / 27 | |
  | 2 | Wedge | 60 × 60 | face 22.6 | – | 1 / 18 / – / 27 | C 60 |
  | 1 | Table insert | 32 × 44 | – | – | top 23 | walnut |

  Plus the ottoman if present, the warnings list, and the config link.
- Blocked while `exportBlocked` (test 8; owner can relax it with Q21).

**How the orthographic views feed the sheets.**
- The vector plan is the source of truth for dimensions.
- The orthographic front and side renders are shaded companions at an exact scale.
- The Iso render is measurable along the three axes only (scale bar × 0.8165) and is on a sheet only if Q30 picks it.
- The 3/4 trimetric is illustrative only.
- Under the drafting reading (Q1 = drafting or both), both sheets use the third-angle layout (plan, front below, right side to the right), and the same 3-up view is the on-screen Drawings view from H3-alt.

**Share link** (`engine/codec.ts`, text codec v1):
- Example: `1UW188L132R132D44_bt32s36_la72_ra72.wh` (Standard U, 38 characters; *measured* on the prototype config; recaptured when the H1 config shape is final).
- Grammar:
  - Version, then shape (`U` / `l` / `r`).
  - W, L, R, D, plus optional fields: `C` manual wedge, `K` lock off, `S` seat width, `N` snug width (when not 24), `X` dims overrides (the prototype's keys plus `f` backFrame, `k` deckHeight, `o` ottomanHeight, `q` coffeeTableHeight), `F` fabric and `T` finish read from `Config.fabric` / `Config.tableFinish` (the prototype passed them as a separate `look` argument).
  - Runs: `_b`, `_l`, `_r`, with `s` armless, `a` one-arm, `t` table, `g` gap, `~` for split siblings, and a `j` marker on seat halves tagged `joinedBy`, paired positionally with the adjacent table (ids are regenerated on decode). Without it, G1 merge-back silently stops working after a reload or a share link.
  - Loose pieces `_o` / `_c`.
  - A 2-character FNV checksum.
- Only RFC 3986 unreserved characters. Always ends in an alphanumeric, so link detectors keep the whole thing.
- *Measured:* typical 30–61 characters, maximum 126 over 409 configs. The alternatives were JSON + lz-string 381–542 and deflate + base64url 314–402.
- Decode is strict: a damaged link reads "This link looks damaged"; a higher version reads "made with a newer version, reload". Old versions are migrated. **Golden links are kept per version forever.**
- It carries geometry, fabric and finish only. Never names, project numbers or price.
- Working link: `/#c=…`. Client link: `/?view#c=…` (read-only plan + 3D + seat count; "Edit a copy" drops `?view`). The Share button (H6) offers both, plus the QR on the client sheet (which encodes the `?view` link).

**Later phases.**
- **H8 Blender:** `config.json` = the Config plus `parts[]` with their procedural dimensions, plus two cameras: the orthographic preset (azimuth, elevation, ortho scale) and a perspective camera (about 50 mm equivalent from the 3/4 direction), because photoreal client renders are normally perspective (Q31). Andre defines what "real models" means first (EXP-06).
- **Price:** `engine/priceFor.ts` (H1) is a pure stub returning `null`, never rendered, until Andre asks for pricing. A test asserts nothing in `ui/` or `plan/` imports it. Prices never enter the link.

---

## 10. Build phases

**Rules for every milestone:**
- `git fetch`, branch from `origin/main`, one branch per milestone (`h0b-scaffold`, `h1-engine`, `h2-plan-view`, …).
- The PR updates the milestone checklist in `CLAUDE.md`.
- Andre previews on localhost or the Vercel preview (`npx vercel deploy --yes` if the GitHub integration skips the branch) and, from H2 on, on the iPad; it merges on Andre's word.
- Stage explicit paths only.
- Pre-PR gate: `npm test && npm run lint && npm run build && npm run check:bundle` (all four exist from H0b). From H2, verify in a foreground browser or Playwright at 1180×820, 820×1180 and 390×844, judging by outcome.

**Changes to the spec's §13 phases:**
- The spec's kickoff asked for phases 1 and 2 in one go. The plan splits them (H1, H2) because milestones are built one at a time; the Standard-U-in-the-plan-view checkpoint Andre asked for is the end of H2 (§14b).
- A scaffold milestone (H0b) comes first, because the repo starts empty; it keeps H1's diff pure engine.
- The read-only orthographic viewer moves from phase 4 to **H3**.
- The wedge slider moves to H2: it is a measurement, not a piece edit.
- The Sketch style moves to H5, with the reference image and assets.
- Saved layouts are local (localStorage) and ship with sharing in H6; cloud saves are an optional H7.

### H0: Docs hand-off (done)
- **Why:** the plan, the spec and the prototypes were produced in a cloud session's scratch space, which is lost with the session and does not exist on Andre's Windows machine.
- **Landed** in this repo: `docs/README.md` (index), `docs/spec-v3.md` (the uploaded spec, unchanged), `docs/HAVEN-PLAN.md`, `docs/prototypes/{engine-a, planview, ortho-demo, placement}` (sources + `package.json`/`tsconfig.json`, no `node_modules` or lockfiles; `planview/src/engine/` omitted because it is byte-identical to `engine-a/src/engine/`), and `docs/evidence/` (8 compressed screenshots + 2 sample PDFs, ~0.5 MB). Plus the root `CLAUDE.md`, `README.md` and `.gitignore`.
- **Verified (planning session):** the archived engine-a passes 43/43 (`npx vitest run` in `docs/prototypes/engine-a` after `npm install`: the 42 prototype tests + the seat spot-check).
- **Done when:** this is on `main` of the `haven-configurator` repo, and every later kickoff references repo paths only.

### H0b: Scaffold (`h0b-scaffold`)
- **Scope:**
  - `npm create vite@latest . -- --template react-ts` (React 19.2.x pinned, see §7.6); TypeScript `strict` plus `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`; `@` → `src/` alias in `vite.config.ts` and `tsconfig.app.json`.
  - Tailwind CSS (Vite plugin) with a minimal token set (`--canvas`, `--ink`, `--accent`, dark-mode variants).
  - oxlint with the §3 guards (the `engine/` and `three/` rules already configured, even though the folders are empty) and `ignorePatterns: ["docs/**"]`.
  - vitest (`vitest.config.ts`, node environment, `@` alias) with one smoke test; `test` / `test:watch` scripts. vitest ^5 needs Node ≥ 22.12: check `node -v`, else vitest ^4.
  - `scripts/check-bundle.mjs` (entry budget + markers, §3) and a `check:bundle` script; `e2e/` helper (`e2e/browser.mjs`: launches `playwright-core` Chromium via `HAVEN_CHROMIUM`) and an `e2e` script with one smoke check (page renders, manifest link present, no console errors).
  - `public/manifest.webmanifest` + icons + `index.html` iOS meta + safe-area CSS (§3). A placeholder page: "Haven Configurator" wordmark, "Planned — nothing built yet", the build's short commit hash.
  - Vercel project `haven-configurator` linked to the GitHub repo (Andre creates it in the Vercel dashboard or approves `npx vercel link`); production = `main`.
  - `.nvmrc` (22), `engines.node` ≥ 22.12.
- **Done when:**
  - The gate passes on an empty `src/engine/`; deliberately adding `import 'react'` to a file in `src/engine/` fails `npm run lint`, and `import * as THREE from 'three'` in `src/App.tsx` fails it too (remove both).
  - `check:bundle` reports the placeholder's entry size (expected ≈ 60 kB gzip, React + react-dom) under budget.
  - The Vercel preview serves the placeholder; Andre adds it to the iPad home screen: it opens full-screen (no Safari chrome), the status bar and home indicator don't cover content, and it rotates to landscape.
- **Not in H0b:** engine code, service worker, UI beyond the placeholder.

### H1: Engine + tests (`h1-engine`)
- **Scope:**
  - Commit 1: port `docs/prototypes/engine-a/src/engine/` into `src/engine/` as is, with §12 T1–T9 green, splitting `layout.ts` (451 lines) and `ops.ts` (406) below ~300 lines.
  - Commit 2: apply G1–G11 and the §5.4 rules; add `profiles.ts`, `clearance.ts`, `limits.ts`, `codec.ts` (from `docs/prototypes/planview/src/share/`, extended per §9), `world.ts`, `priceFor.ts`.
- **Files:** `src/engine/**` only (plus `CLAUDE.md` status).
- **Done when:**
  - `npm test` passes: the nine §12 tests, E1–E19, E20a and E21–E30 (§11), and the property test (≥ 4,000 random ops, invariants on every accepted op, refused ops leave the input untouched).
  - `npm run lint` passes, and deliberate imports of `react`, `@/state/store` and `../state/store` in `engine/` each fail it.
  - `npm run build` and `check:bundle` pass; entry JS is unchanged (nothing imports the engine yet).
- **Verify:** run the gate; paste the vitest summary into the PR; confirm with `git diff --stat` that nothing outside `src/engine/` and `CLAUDE.md` changed.
- **Not in H1:** any UI, zustand, three, storage.

### H2: Plan view + inputs (`h2-plan-view`)
- **Scope:**
  - `App.tsx` replaces the placeholder: `HavenLayout` (safe areas, full-screen, no page scroll).
  - Store + history + draft/commit, URL hash sync (keeps `?view`), `hashchange` load, localStorage draft + "Resume last layout" (§8).
  - `PlanDrawing` + `DimsLayer` (CAD look).
  - Start menu (Standard U / L / Blank / Resume), **Reset** (§8), shape picker, `MeasureField` W/L/R/D, D chips, lock switch, wedge slider + Reset wedge, seat-width setting.
  - Seats chip, warnings list, Blank-mode gaps rendered, undo/redo buttons.
  - Service worker (§3): precache, prompt-to-update chip (`UpdateChip`).
  - Tighten the `check:bundle` budget to measured + 15 % (§3).
- **Files:** `src/{App.tsx, main.tsx}`, `src/state/**`, `src/plan/{PlanView,PlanDrawing,DimsLayer,dims,format,textMetrics,geometry,theme}.*`, `src/ui/{HavenLayout,TopBar,Sidebar,MeasureField,WedgeSlider,StartMenu,WarningsList,UpdateChip}.tsx`, `vite.config.ts`, `scripts/check-bundle.mjs`, `e2e/**`; dependencies `zustand`, the Radix primitives, `vite-plugin-pwa` (dev).
- **Done when:**
  - `/` opens on the Standard U (even with a saved draft) showing back chain `60 | 32 | 36 | 60`, overall `188"`, legs `72`, `44"D`, "Seats 7".
  - Typing D = 36 shows back 52, legs 80, "Seats 7–8" (test 2).
  - The slider at 55 shows legs 77 and back 46 (test 6).
  - W = 300 shows `74 | 74` (test 5).
  - W = 140 shows "min 158″" and reverts.
  - Warnings: D = 30 shows "Seat depth 20″ (under 24)"; slider at 49 shows the amber "angled face 7.1″"; L = 100 shows "Opening 56″ deep (under 60)". None blocks editing.
  - After D = 36 and W = 300, Reset restores the Standard U; one Undo brings the edited layout back.
  - Blank U shows hatched "unfilled 68/72/72".
  - Reload restores the layout from the hash; `?view` survives a commit; with localStorage throwing, the app still loads and edits.
  - Offline: after one online load, Playwright with the network offline reloads `/` and `/#c=…` and both render (service worker).
  - Undo walks back each commit.
- **Verify:**
  - Playwright screenshots at 3 viewports; label overlap/clip check (0/0).
  - `check:bundle`: entry within budget, no three/jsPDF markers.
  - Andre on the iPad (installed from the preview): the layout opens, landscape works, pinch does not zoom the page, airplane mode + reopen still works.
- **Not in H2:** seam handles, tray, table drag, tap menu, 3D, Sketch, exports, saved layouts, `?view` presentation (the flag is only preserved).

### H3: Orthographic 3D viewer, read-only (`h3-ortho`)
- **Prerequisite:** Q1 = camera (otherwise build H3-alt). Q9, Q10, Q12, Q13, Q14 answered, or their defaults explicitly accepted by Andre after seeing the demo's Front/Side screenshots, because the elevations show them at true scale.
- **Scope:**
  - `ortho/{presets,orthoFit,screenBasis}.ts` (pure, tested; ported per §7.2, trimetric 3/4, no dimetric).
  - `three/{ThreeView,Rig,controls,parts,prism,keyLight,SofaModel}.ts(x)` behind `lazy()`, including the crowned seat cushion (§7.4) and Blank gap decals.
  - Plan | 3D switch with the parity hand-off.
  - Presets Top / Front / Side / 3/4 / Iso; scale overlay (scale bar + height ticks, §7.2).
  - Depth cues (§7.3); procedural materials (white bouclé canvas texture, walnut).
  - Idle chunk warm-up (feature-detected, §7.5).
  - `e2e/ortho.mjs` (parity, presets, touch, elevation scale).
- **Files:** as listed; dependencies `three`, `@react-three/fiber`, `@react-three/drei`, `camera-controls` (transitive), `@types/three`.
- **Done when:**
  - Every preset frames the whole sofa at all 3 viewports, except Front/Side at ≤ 480 px wide (they open at 3 px/in anchored left).
  - Top in parity mode overlays the SVG plan with IoU ≥ 0.999.
  - Elevations are to scale (V9): Front back top 27 × zoom ± 1 px, arm 23, seat cushion 16 at its ends and 18 mid-span; height ticks within ±1 px of the rendered edges.
  - A pinch zooms the canvas, not the page.
  - The 3D chunk is not modulepreloaded from `dist/index.html` and is fetched only after first paint.
  - Offline (service worker), switching to 3D still works after one online load.
  - Idle renders 0 frames over 2 s.
  - `check:bundle` passes.
  - A config edit in the plan (typing W) updates 3D.
- **Verify:**
  - vitest `three/parity.test.ts` (|Δ| < 0.01 px for the T1, T2, T4 and T5 configs); E20b; the `requestIdleCallback`-absent mount test.
  - Playwright IoU, V9 and touch scripts.
  - Andre on the iPad: orbit, pinch, presets, rotation refit, smoothness (**first real-device frame-rate check**).
- **Not in H3:** pillows/`.glb`, fabric swatches, editing in 3D, tap-to-inspect (optional stretch), exports.

### H3-alt: Drawings view (only if Q1 = drafting or both) (`h3-drawings`)
- **Scope:** `plan/elevation.ts` (moved here from H6; port from `docs/prototypes/planview/src/plan/elevation.ts` and add the crown) and `plan/DrawingsView.tsx`: a third-angle 3-up (plan above the front, right side to the right of the front) at one shared scale, with the view switch Plan | Drawings | 3D (3D disabled until H3b).
- **Done when:** plan and front x-extents align within 0.5 px; front and side height extents align; the 1 / 18 / 23 / 27 heights are dimensioned; label overlap/clip 0/0 at 3 viewports.
- **Then:** H3b = H3 as above, immediately for "both", later for "drafting" (not dropped unless Andre waives spec §7/§9 3D orbit).

### H4: Editing (`h4-editing`)
- **Scope:**
  - `usePlanGestures`, `GripsLayer`, `hitTest`, `tableSnap`, `PlacementPins`.
  - Seam handles with readout and keyboard.
  - Table drag with anchored targets and trash.
  - Reorder; `TapMenu` (resize/convert/end cap/delete/fill).
  - `PieceTray` (tap-to-place and drag), loose pieces with live clearance, rendered in 3D (§7.4) and included in the ortho fit.
  - Blank-mode fill; global keys.
- **Done when:**
  - Tests 3a and 3b are reproducible by touch.
  - Dragging the 3b table back to the back run restores the Standard U (G1), also after a reload.
  - Each gesture is exactly one undo step; touchCancel leaves no trace.
  - Blank U can be filled piece by piece until export unblocks.
  - Seam drag readout `40" | 28"`.
  - A coffee table added in the plan appears in 3D Top at parity and inside the frame in every preset.
- **Verify:** vitest for `tableSnap`/`hitTest`/history; the CDP touch script (seam, table, cancel, tap, keyboard); Andre on the iPad: every gesture with a finger and, if available, the Pencil.
- **Not in H4:** 3D editing, Sketch, exports, saved layouts.

### H5: Look (`h5-look`)
- **Prerequisite:** Andre delivers the pillow `.glb` files, textures, the fabric list and the Sketch reference image (Q16).
- **Scope:**
  - `Pillows.tsx` (anchors from the engine; pillow boxes join the ortho fit), real bouclé and wood maps at real-world inch scale. Load `.glb` with `useLoader(GLTFLoader, url)` from `three/examples/jsm/loaders/GLTFLoader.js`, **not** drei `useGLTF` (it hard-codes the gstatic Draco URL).
  - Fabric and table-finish swatches from a `FABRICS` data table (config fields `fabric` / `tableFinish`).
  - Plan `look: 'sketch'` theme: white fill, black lines, cushion seams, deterministic wood grain.
  - Add `public/models/**` to the service worker's precache globs.
- **Done when:** pillows sit on the wedges and arm ends at the Q15 counts and stay inside the frame in every preset; every fabric in `FABRICS` renders in 3D and round-trips through the link; Sketch toggles the plan; the 3D chunk stays ≤ 300 kB gzip plus the assets (≤ 1.5 MB total assets, no Draco); pillows render offline after one online load.
- **Verify:** a runtime check that no request goes to `gstatic.com` or `githack.com`; screenshots; iPad check.
- **Not in H5:** exports, saved layouts.

### H6: Sheets, share links, saved layouts (`h6-exports`)
- **Scope:**
  - `export/{sheet.tsx,pdf.ts,png.ts,share.ts}`, `plan/elevation.ts` (vector front/side; already built if H3-alt ran), `three/export.ts` (offscreen-capable `exportView`, §7.6).
  - Export menu with the two-tap share on iPad.
  - Share button: copy link / share sheet for the working link and the `?view` client link; QR on the client sheet.
  - `?view` read-only presentation (`ViewModeBar`: plan | 3D, seat count, "Edit a copy").
  - Saved layouts (§8): `state/savedLayouts.ts` + `ui/SavedLayouts.tsx`, Save / rename / duplicate / delete / share link, listed in the Start menu.
- **Dependencies:** `jspdf`, `svg2pdf.js`.
- **Done when (pdf.js checks at 3/8″ = 1′-0″, 2.25 pt/in):**
  - Shop sheet: the two wedge 60″ label centres are 288.00 pt apart ((188 − 60) × 2.25); the overall 188″ dimension line is 423.00 pt.
  - Client sheet: the overall 188″ extension lines are 423.00 pt apart; the 4′ scale-bar segment is 108.00 pt; the front elevation's left/right edges align with the plan's W extension lines within 0.5 pt, and its 27″ back measures 60.75 pt.
  - The client sheet exports from Plan view on a fresh load (3D never opened), and offline after one online load.
  - The shop sheet page 2 lists 2 one-arm 72 (LAF, RAF), 1 armless 36, 2 wedges 60, 1 table 32.
  - Both sheets are disabled on the Blank U.
  - `/?view#c=…` in Playwright with empty storage renders the read-only view with no editing controls; "Edit a copy" opens the same layout editable; entry JS stays within budget and jsPDF stays out of it.
  - Saved layouts: save, reload, reopen, rename, delete all work; with localStorage throwing, Save shows "Can't save on this device" and nothing else breaks.
  - Every §12 fixture survives a link round trip, and a saved-layout round trip.
- **Verify:** vitest codec golden links + `savedLayouts` tests; the Playwright `?view` check; jspdf absent from entry JS (`check:bundle` marker); Andre shares a PDF from the installed app on the iPad (navigator.share) and prints one at 100% to check the scale bar with a ruler.
- **Not in H6:** cloud saves, anything involving another app.

### H7: Cloud saves + tracker hand-off (optional, later; Andre decides, do not start until told)
The configurator is complete without H7. Options, in order of cost:
- **(a) Stay local (default).** Layouts live on each device; share links and PDFs move them between devices and people. Nothing to build.
- **(b) Own small backend for cross-device saves.** A Supabase project (or similar) belonging to this app only, with a `layouts` table (codec string, name, timestamps, soft delete) and a login. Brings back the costs H1–H6 avoided: auth, uptime, a free-tier pause risk, an offline-save queue. Plan it as its own milestone with its own migration and review when chosen.
- **(c) Hand off to the production tracker by file.** Export the shop-sheet PDF (H6) and upload it to the tracker item by hand as its shop drawing. No code in either repo.

No cross-repo code coupling in any option: no shared packages, no shared database, no deep links that assume the other app's routes.

### H8: Blender round-trip (later; do not start until Andre says so)
`config.json` export (orthographic and perspective cameras, §9) + a Blender Python script (§10). Andre defines "real models" first.

---

## 11. Test plan

**Fixture.** Every test starts from an explicit fixture: Standard U = W188 L132 R132 D44, C auto (60), A14, B10, lock on, seatWidth 28, snug 24.

**Invariant.** `valid(config)` runs on every config any test produces (§12 test 9):
- each run (gaps included) sums to its available space;
- no seat or table is over 108 (gaps may be longer);
- every length is > 0 and on the 0.5 grid; D and C are whole inches;
- every seat cushion is ≥ 6; the G11 arm invariant holds;
- no build errors;
- a JSON round trip is lossless;
- the input is deep-frozen (purity).

**§12 tests** (assertions extended with the unasserted numbers, verified on engine-A 2026-09-24):

| Test | Assertions |
|---|---|
| T1 | Back [wedge 60][table 32][armless 36][wedge 60] = 188; legs one-arm 72 (58 + 14), LAF/RAF; seat depth 34; opening 100 × 88; "Seats 7"; no warnings; exact wedge polygons (0,0)(60,0)(60,44)(44,60)(0,60) and mirror |
| T2 | D = 36: C 52 (auto); back [32][52]; legs 80 (66 + 14); seat depth 26; W/L/R 188/132/132; opening 116 × 96; "Seats 7–8" |
| T3a | `moveTable(→ left, replaceArm)`: left [armless 40][table 32], end cap `table`; back [armless 68]; "Seats 7" |
| T3b | `moveTable(→ left, split)`: left [armless 13][table 32][one-arm 27 = 13 + 14]; back [68]; `seatUnder20` on both 13″ cushions; "Seats 6"; export not blocked |
| T4 | `standardL('right', {W120, R100})` with D 44: back one-arm 60 (46 + 14) arm at start, LAF; leg one-arm 40 (26 + 14); opening null; "Seats 2–3" |
| T5 | W = 300: back [table 32][74][74] (one split group); legs 72; "Seats 11–12" |
| T6 | `setWedge(55)`: legs 77 (63 + 14); back [32][46]; W/L/R unchanged; face 15.6; "Seats 7" |
| T7 | `setEndCap(right, open)`: right [armless 72]; "Seats 7–8" |
| T8 | `blankConfig('U')` (D 44, C 60): gaps 68 / 72 / 72, no arms, `exportBlocked` true, "Seats 2" |
| T9 | The invariant above, on every config in T1–T8 and every edge test, plus `blankConfig('U', {W: 300})` (one 180″ back gap) |

**Edge tests (H1):**

| # | Name | Asserts |
|---|---|---|
| E1 | `lockOff_tableReplacesArm_growsLegBy18` | lock off, `moveTable(back table → left, replaceArm)`: W 156, L 150 (G5); lock-off `setEndCap(left, 'table')` instead: W 188, L 150 |
| E2 | `lLeft_mirrorsTest4` | x → W − x, LAF ↔ RAF |
| E3 | `W140_refusedWithMin158` | `rejected.code = 'infeasible'`, `min.W = 158`, config unchanged |
| E4 | `splitRemainder_W300_5` | back [32][74.5][74] |
| E5 | `tableSplitOddRemainder` | L = 132.5, split the left leg: [13.5][32][27 = 13 + 14] |
| E6 | `tableRoundTrip_restoresStandardU` | 3b, then back to back seam 0, equals the Standard U lengths (G1) |
| E6b | `tableRoundTrip_afterCodec` | 3b, encode/decode, then back to back seam 0, equals the Standard U lengths (`j` marker) |
| E6c | `sameRunMove_mergesHalves` | 3b, then `moveTable` to the left leg's end seam: left [one-arm 40 (26 + 14)][table 32] (G1 merge before placing) |
| E7 | `splitGroup_remerges` | W 300 → 188 gives armless 36 with the original id |
| E8 | `oneArmAutoSplit_equalFootprint` | L = 260: left [armless 100][one-arm 100 (86 + 14)] (G9) |
| E9 | `manualC_sticksAndClamps` | C 74 at D 44, then D 36 gives C 66 (stored); back to D 44 keeps 66; reset at D 36 gives 52 |
| E9c | `D_wholeInch` | typed D 40.5 is stored as 41, auto C 57 |
| E10 | `squareCorner_noFaceWarning` | C = D gives no warning; C = D + 5 warns (face 7.1) |
| E11 | `wedgeSlider_clampsToFeasible` | W 160 Standard U, `setWedge(74)` gives C 61 (back armless 6), not refused (G3) |
| E12 | `blank_fillUnblocksExport` | filling every gap reproduces the Standard U lengths, `exportBlocked` false |
| E13 | `lockOff_seamDrag_keepsTotals_relockFreezes` | lock off, `dragSeam(back, table\|armless, +6)` gives [table 38][armless 30], W 188; `addPiece(armless 20, back end seam)` gives W 208; `setLock(on)` keeps 208; the next piece op leaves W 208 |
| E14 | `coffeeClearance_standardU` | centred 48: back 20, left 26, right 26, backLeft = backRight 21.2, min 20, no warning; moved 8″ back → warns (G7) |
| E15 | `reorderOneArm_refused` | `notAllowed` (G11) |
| E16 | `codec_roundTrip_goldenLinks` | 9 fixtures + 400 random sequences give a config equal after id normalisation (incl. `joinedBy`, `snugWidth`, all `dims`, fabric, finish) and every piece bbox; golden strings frozen at the end of H1 |
| E17 | `property_4000RandomOps` | invariants; with the lock on, piece ops (not `setMeasurements`/`setWedge`/`setShape`) never move W/L/R; refused ⇒ same reference |
| E18 | `standardL_default` | 132 × 132: back one-arm 72, leg one-arm 72, no table |
| E19 | `setShape_UtoLRight_keepsBack` | back [table 32][armless 96], end cap `table` (G2) |
| E20a | `worldHandedness` (H1) | pure `planToWorld(x, y, h) = (x − cx, h, y − cy)`; the back-left wedge diagonal maps to the inner corner (+X, +Z quadrant from the corner) |
| E20b | `topPresetOrientation` (H3, with V1) | via `ortho/screenBasis.ts`, Top at azimuth 0 puts the back at the top of the screen |
| E21 | `tableOutsideArm_lockOn` | back table → left end seam: left [one-arm 40 (26 + 14)][table 32], end cap `armTable`; back [armless 68] |
| E22 | `twoTables` | add a 24″ table at right seam 0: right [table 24][one-arm 48 (34 + 14)]; sums exact; "Seats 6" |
| E23 | `lockOff_splitGrowsRun` | lock off, 3b: left [armless 29][table 32][one-arm 43 (29 + 14)], W 156, L 164; moving it back to back seam 0 restores W 188 / L 132 (G1) |
| E24 | `blank_lockOff_takesGapsFirst` | lock off, Blank U, table at back seam 0: back [table 32][gap 36], W 188 |
| E25 | `armInvariant_refusals` | from 3b: reorder armless 13 to index 2 → `notAllowed`; from E21, add armless after the `armTable` end → `notAllowed`; add one-arm at back seam 1 → `notAllowed` (G11) |
| E26 | `setShape_roundTrips` | L-right → U → L-right equals the original; L-right → L-left → L-right is the identity (G2) |
| E27 | `cushionFloor` | resize the back armless to 3 → `noRoom`; `standardU({L: 79})` gives left [armless 19] (no arm) |
| E28 | `coffeeDefault_noOverlap` | default coffee-table position has no `coffeeOverlap` for U, L-left, L-right |
| E29 | `resetWedge_infeasible` | W 160, `setWedge(44)`, W 128, then `resetWedge` → `infeasible`, `min.W` 158 |
| E30 | `lockOff_deleteLastLegPiece_refused` + `replaceArm_onTableEnd_refused` | both `notAllowed` |

**View-level checks:**

| Id | When | Check |
|---|---|---|
| V1 | H3, vitest | Ortho ↔ SVG parity: build `OrthographicCamera` exactly as R3F does (±w/2, ±h/2), run the production `fitOrtho`/`setTopAt`, project every footprint vertex at 0″ and 27″ for T1/T2/T4/T5 at 3 viewports; \|Δ\| < 0.01 px |
| V2 | H3, Playwright | Silhouette render pinned to S vs the rasterised PlanView SVG: IoU ≥ 0.999, mean edge offset ≤ 0.25 px |
| V3 | H3 | Every preset's projected silhouette (T1, T2, T4, T5, T8) lies inside the canvas minus padding at 1180×820, 820×1180, 390×844; Front/Side exempt at 390 |
| V4 | Every PR from H0b | Bundle split: `check:bundle` exit 0; `dist/index.html` has no modulepreload of the three or jspdf chunks; lazy 3D chunk ≤ 300 kB gzip; entry JS (sum of files referenced by `dist/index.html`) within the §3 budget |
| V5 | H2–H4, CDP touch at DPR 2 | Pinch on the canvas leaves `visualViewport.scale` = 1; seam drag = 1 undo step; touchCancel = no trace; table drag gives 3b; tap selects |
| V6 | H3 | 0 frames rendered in 2 s idle |
| V7 | H6 | PDF scale at 3/8″ = 1′-0″: shop-sheet wedge labels 288.00 pt apart, overall 188″ = 423.00 pt, 4′ bar = 108.00 pt, client front elevation aligned within 0.5 pt with a 60.75 pt back; fonts are Helvetica (no Times fallback) |
| V8 | H0b (install only), then every milestone from H2 | Real iPad pass by Andre on the Vercel preview, installed to the home screen |
| V9 | H3, Playwright + vitest on `ortho/` | After each preset settles: Front polar 90° / azimuth 0°, Side azimuth ±90°, Iso 45° / 35.264° (to 1e-6 rad). Front at the fit zoom: floor-to-back-top 27 × zoom ± 1 px, arm 23 × zoom, seat cushion 16 × zoom at its ends and 18 × zoom mid-span. Iso: an axis-aligned 188″ edge measures 0.8165 × 188 × zoom ± 1 px |

---

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Nothing has run on a real iPad (touch, frame rate, share sheet, orientation) | Install check in H0b; V8 at the end of every milestone from H2; H3 includes the first frame-rate check; `regress` + dpr [1, 2] fallback |
| three.js or jsPDF leaks into the entry chunk and slows first paint on the iPad | Lint rule + `check:bundle` markers and entry budget (the prototype check caught a deliberate 1,851 kB leak) + three-free `ortho/presets.ts`; no vendor `manualChunks` |
| Path-dependent layouts confuse clients | G1 merge-back; undo; Reset; Start menu |
| Refusals feel broken | G6 reasons with a minimum; the slider clamps (G3) |
| No network in a client's home | Precache service worker from H2 (all chunks, from H5 the models); idle 3D warm-up for first visits; hash + localStorage draft survive reloads; `.glb` without Draco; no CDN HDRIs; H2/H3/H5/H6 each have an offline done-when item |
| A stale service worker serves an old build | `registerType: 'prompt'` update chip; the build hash on the About line; never auto-reload mid-meeting |
| Layouts are stuck on one device, or evicted | Every saved layout has a share link (cross-device path); `navigator.storage.persist()`; H7 option (b) if Andre needs real sync. **UNVERIFIED:** iOS eviction of an unopened home-screen app's storage |
| Safari and the installed app have separate storage | Stated in the Saved-layouts UI ("Saved on this device"); share links bridge them |
| Craft defaults are wrong (back vs table, cushions, legs, pillows) | All of them are data in `profiles.ts`/`HavenDims`; Q9, Q10, Q12–Q14 answered or accepted before H3 (H3 prerequisite), Q15 before H5; Front/Side screenshots shown for sign-off |
| Engine rule changes break old share links and saved layouts | Stored lengths plus codec versioning with golden links; decoders and migrations per version; saved layouts are codec strings, so they migrate the same way |
| R3F peer range (React < 19.4) blocks React upgrades | Pin React 19.2.x; watch R3F releases; note in CLAUDE.md |
| drei/three quirks (ContactShadows origin, Outlines prop naming, Bounds + CameraControls, fitToBox, `useGLTF` Draco URL, no `requestIdleCallback` on iOS) | Documented in §7; the H3 kickoff (§14c) links it |
| PDF on iOS: downloads unreliable in standalone mode | Two-tap `navigator.share({files})`; laptop `save()` |
| Scope creep toward an ERP or a second tracker (accounts, orders, pricing, a database) | No backend in H1–H6; H7 is optional and owner-decided; piece list lives only inside the PDF; `priceFor` stub not rendered |
| Scratch prototypes are lost with the planning session | Done: H0 archived the plan, spec and prototype sources in `docs/`; §5 alone is enough to rebuild the engine |

---

## 13. Open questions for Andre

Answer in a word. **Q1 has no default and must be answered before H3.** Every other default applies if there is no answer, except that Q9, Q10, Q12–Q14 must be answered or explicitly accepted before H3 (they show at true scale in the elevations). Numbering is stable: questions that no longer apply are kept and marked.

| # | Question | Default |
|---|---|---|
| **Q1** | "Orthographic" means the 3D camera (flat, to-scale views you can still orbit), or a drafting sheet (plan + front + side laid out together)? *camera / drafting / both* | **must answer before H3** (plan assumes camera; drafting or both → H3-alt) |
| Q2 | Where does it live? | **Answered 2026-09-25:** standalone app, own GitHub repo, own Vercel project, own Claude Code environment (§3) |
| Q3 | Haven before or after the other app's order-intake work? | **Not applicable** (separate repo; no shared milestone sequence) |
| Q4 | Keep a perspective "photo" toggle in 3D as well? *yes / no* | no |
| Q5 | Standard L: *(a)* 132 × 132, no table, arm on the back (matches spec test 4) or *(b)* the Standard U minus one leg (188 × 132, table at the open end)? | a |
| Q6 | When a long run splits, equal frames or equal seat cushions? *frames / cushions* | frames (§7 literal) |
| Q7 | Arm side named as you face the piece (LAF/RAF)? *yes / no* | yes |
| Q8 | "Opening under 60″" warns if either width or depth is under 60? *yes / no* | yes |
| Q9 | Table top flush with the arm at 23″ (§14)? *yes / or give height* | yes (confirm before H3) |
| Q10 | Back = 4″ frame + 6″ cushion (§14)? *yes / or give split* | yes (confirm before H3) |
| Q11 | Ottoman: free size (starts 36 × 36) and listed on the shop sheet? *yes / no* | yes |
| Q12 | Back and back cushion stop at each table and at the arm? *yes / no* | yes (confirm before H3) |
| Q13 | One seat cushion and one back cushion per piece? *yes / or give max cushion width* | yes (confirm before H3) |
| Q14 | Legs 1.5″ round, 3″ in from each corner? *yes / or give spec* | yes (confirm before H3) |
| Q15 | Pillows: 2 square + 1 ball per wedge, 1 square per arm? *yes / or give counts* | yes |
| Q16 | Before H5: the pillow `.glb`s, fabric/wood textures, the sketch reference image, and which fabrics besides white bouclé (names + texture maps)? *yes / date* | needed before H5; H5 waits |
| Q17 | Share links go to clients (no names, no prices)? *yes / no* | yes |
| Q18 | *(Rewritten.)* Before H7: which option for saves across devices and hand-off to the production tracker? *(a) stay local + share links/PDFs / (b) own small backend / (c) PDF uploaded by hand* | (a), with (c) whenever a sheet should live on a tracker item; H7 not started unless Andre asks |
| Q19 | Attach the shop sheet to a tracker item automatically? | **Not applicable** (folded into Q18 option c: by hand) |
| Q20 | Client sheet shows each piece's length? *yes / no* | no (overall + tables only; pieces on the shop sheet) |
| Q21 | Block both sheets while gaps are unfilled? *yes / or "draft watermark"* | yes |
| Q22 | PDF font: Helvetica, or the app's UI font (needs static TTFs embedded)? *helvetica / ui font* | helvetica |
| Q23 | Show feet-inches next to overall sizes (`188" (15'-8")`)? *yes / no* | yes |
| Q24 | Blender phase: what are "our real models"? *(one line)* | asked before H8 |
| Q25 | Upgrade a database plan so it never pauses? | **Not applicable** (no backend; revisit only if H7 option b is chosen) |
| Q26 | Allow any orientation? | **Answered by design:** the app's own manifest has no orientation lock (§3, §8) |
| Q27 | Phone = view and share only (editing not guaranteed)? *yes / no* | yes |
| Q28 | OK to add a sofa-specific table to another app's database? | **Not applicable** (no shared database) |
| Q29 | Ottoman and coffee-table heights? *give inches* | 18 / 16 |
| Q30 | 3D pictures on the client sheet: *front elevation + 3/4 / front elevation + iso / front elevation only / none*? | front elevation + 3/4 ("not to scale") |
| Q31 | Blender photo renders: *orthographic / perspective / both*? | both |

---

## 14. Kickoff prompts (replace the spec's)

For a fresh Claude Code session in the `haven-configurator` repo. Every prompt references repo paths only; `CLAUDE.md` loads automatically. Paste one prompt per milestone, and only after the previous milestone's PR is merged.

### 14a. H0b

> Read `CLAUDE.md`, then `docs/HAVEN-PLAN.md` §3 and §10 (H0b). Build **milestone H0b only**: the repo scaffold. Vite react-ts at the repo root (React 19.2.x pinned), strict tsconfig with the extra flags in §10, `@` → `src/` alias, Tailwind, oxlint with the §3 guards and `docs/**` ignored, vitest with one smoke test, `scripts/check-bundle.mjs` (start from `docs/prototypes/placement/check-bundle.mjs`; entry budget 350 kB raw / 110 kB gzip, three and jsPDF markers), the `e2e/` Chromium helper (`HAVEN_CHROMIUM`, in this sandbox `/opt/pw-browsers/chromium`; never `playwright install`), `public/manifest.webmanifest` + icons + iOS meta + safe-area CSS, and a placeholder page. Check `node -v` ≥ 22.12 first.
>
> `git fetch`, branch `h0b-scaffold` from `origin/main`, stage explicit paths only. Run `npm test && npm run lint && npm run build && npm run check:bundle && npm run e2e`, show me the lint-guard proof (the two deliberate violations failing) and the entry size, commit as `H0b: …`, open the PR, and tell me how to link the Vercel project and add the preview to the iPad home screen. Stop there.

### 14b. H1

> Read `CLAUDE.md`, then `docs/HAVEN-PLAN.md`. H0b is merged. Build **milestone H1 only** (plan §10): the pure geometry engine in `src/engine/` with vitest. Commit 1 ports `docs/prototypes/engine-a/src/engine/` as is, with the nine §12 tests green first and files split below ~300 lines. Commit 2 applies plan §5 exactly: grafts G1–G11, the types in §5.2, the ops in §5.3, the rules in §5.4, plus `codec.ts` (from `docs/prototypes/planview/src/share/`, extended per plan §9), `world.ts` and `priceFor.ts`. `BuildResult.bounds`/`heights` (G4) exist to feed the H3 orthographic fit.
>
> Tests: every §12 test, E1–E19, E20a and E21–E30 from plan §11, the T9 invariant on every config, and a ≥ 4,000-op property test. Prove the engine lint guard: deliberate imports of `react`, `@/state/store` and `../state/store` in `src/engine/` each fail `npm run lint`.
>
> No UI, no state, no storage. `git fetch`, branch `h1-engine` from `origin/main`, stage explicit paths only. Run the gate, show me the test summary and the Standard U build output (pieces, seats, warnings), commit as `H1: …` (two commits, port then grafts), open the PR, and stop. If an open question from Q4 onward blocks you, use its default and list it in the PR.

### 14c. H2

> Read `CLAUDE.md` and `docs/HAVEN-PLAN.md`. H1 is merged. Build **milestone H2 only** (plan §10): the app shell (`HavenLayout`), store/history, URL hash sync and the localStorage draft (plan §8), the SVG plan view with CAD dimensions, Start menu, Reset, shape picker, measurement inputs, lock, wedge slider, seat count and warnings, and the precache service worker with the update chip (plan §3). Port from `docs/prototypes/planview/src/`. Meet every H2 done-when item (including the offline reload), tighten the entry budget per §3, then show me the Standard U in the plan view (screenshots at 1180×820, 820×1180 and 390×844) and stop. Branch `h2-plan-view`, commits `H2: …`.

### 14d. H3

> Read `CLAUDE.md` and `docs/HAVEN-PLAN.md`. Q1 = camera; the craft questions Q9, Q10, Q12–Q14 are answered or accepted (write the answers here). Build **milestone H3 only**: the read-only **orthographic** 3D viewer per plan §7: `<Canvas orthographic>` given only near/far/position; presets Top / Front / Side / 3/4 (trimetric) / Iso; depth cues §7.3; `fitOrtho` §7.2; crowned cushions and loose/gap parts §7.4; the scale overlay; and every "Don't" in §7.1 and §7.6. Port from `docs/prototypes/ortho-demo/src/` (not its dimetric default). Done when the H3 items, V1–V6, V9 and E20b pass. Branch `h3-ortho`, commits `H3: …`. Stop for Andre's iPad check.

Later milestones (H4–H6, and H7/H8 only when Andre asks) follow the same shape: read `CLAUDE.md` and the plan, build that milestone's §10 block only, meet its done-when list, open the PR, stop.

---

## Appendix A: Differences from spec v3 (this plan wins)

1. **§1:** "The neighbouring seat pieces absorb" becomes "the nearest seat piece absorbs (tables, wedges and arms never do); if it reaches a 6″ cushion it cascades to the next; if nothing can absorb, the edit is refused with a reason." Typed measurements, D and the wedge slider always hold W/L/R.
2. **§2:** Standard U is a stored preset (table next to the left wedge) and always loads first; the last draft is offered as "Resume last layout". Standard L = default fill, no table, 132 × 132, following test 4 rather than the literal "minus one leg" (Q5). Blank mode places wedges automatically and no arms. Both sheets are blocked while anything is unfilled; share and save are allowed.
3. **§3:** Add `backFrame 4`, deck 10, snug seat width 24, D range 30–48 in whole inches, ottoman 18″ and coffee table 16″ high (Q29). Heights move into a shared profile used by 3D, elevations and Blender. Stitch-line edge at 16″, crown 18″, in both the 3D cushion and the vector elevation.
4. **§4:** The one-arm piece's length includes its arm. Ranges are warnings; a 6″ cushion is the hard floor. Arms only face an open end (or a table at the open end). Table outside the arm = end cap state "arm + table". The coffee table stays square.
5. **§5:** One global C for every wedge. A manual C clamps into [D, D+30] when D changes. The face warning fires only when 0 < face < 8. The slider stops at the last value that fits.
6. **§6:** Snap targets = seams + seat midpoints (split, centred on the cushion span, arm excluded) + in place of the arm + outside the arm. The split halves re-merge whenever the table leaves them, including a move within the same run and after a share-link round trip.
7. **§7 Views:** 3D uses an **orthographic camera**. Presets: Top (matches the plan), Front, Side, 3/4 (trimetric 30/30, mirrored for L-right), Iso (to scale). Orbit stays above the floor; pinch changes zoom (px/in). 3D is view-only.
8. **§7:** The lock governs piece edits only. Lock off: arms keep the cushion and runs grow. Auto-split = the fewest equal pieces (arm included) with half-inch remainders away from the arm (pending Q6). Undo = one step per gesture.
9. **§8:** Seat stretches are not broken by piece seams. Opening is U only; warn if either side is under 60. Clearance is measured to the seat fronts including the wedge faces. Add a coffee-table overlap warning.
10. **§9:** Depth cues for orthographic (key light, outlines, contact shadow at the world origin, floor slab). No HDRI. The back stops at tables and arms. Cushions keep the true 16/18″ crown. Loose pieces and Blank gaps appear in 3D. Cushion, leg and pillow rules per Q12–Q15. Assets without Draco.
11. **§10:** Sheets are vector PDFs at an architectural scale with a scale bar. The client sheet adds a to-scale orthographic front elevation and, per Q30, a "not to scale" 3/4. The shop sheet adds a vector elevation with heights and the piece-list columns in §9. Live D callout. Share link = versioned text codec in the URL fragment encoding the whole config (incl. split tags, snug width, all dims), no personal data. Blender gets orthographic and perspective cameras (Q31).
12. **§11:** A standalone Vite + React 19 + TypeScript app in its own repo and Vercel project, `src/` split into engine / ortho / state / plan / three / ui / export. No login and no backend; layouts live in the URL hash and localStorage. three.js and jsPDF are lazy chunks under an entry-chunk budget. Add camera-controls, svg2pdf.js, vitest, a precache service worker. One entry: a share link is the app URL with `#c=` (`?view` for read-only).
13. **§12:** Explicit fixtures and the added assertions and edge tests in plan §11.
14. **§13:** Milestones H0b–H8 as in plan §10 (scaffold first, orthographic viewer moved to H3, local saved layouts in H6, cloud saves an optional H7).
15. **§14:** Superseded by plan §13.
16. **Kickoff prompt:** replace with plan §14. The spec's single phase 1 + 2 prompt becomes one prompt per milestone (one milestone at a time); the "show me the Standard U in the plan view" checkpoint closes H2.

## Appendix B: Evidence

The research ran in the planning session's scratch space, which is gone. Prototype sources are archived under `docs/prototypes/` with the same relative paths (run `npm install` in a prototype folder to re-run it; `planview/src/engine/` is omitted as byte-identical to `engine-a/src/engine/`, so copy it back before running planview). Selected screenshots and PDFs are in `docs/evidence/` (listed in `docs/README.md`). Paths below that are not in the archive (the other screenshots, `engine-b`, the review probes) are kept for the record only.

| Item | Path | Result |
|---|---|---|
| Spec v3 | `docs/spec-v3.md` (uploaded as `haven-configurator-spec.md`) | 265 lines, §1–§14 + kickoff |
| Engine A | `engine-a/src/engine/` | Re-run 2026-09-24: `npx vitest run` gives **42/42 pass** (vitest 3.2.7, 1.49 s, property test 4,000 ops); `tsc --noEmit` clean. 1,660 engine lines + 742 test lines |
| Engine B | `engine-b/src/engine/` | Re-run 2026-09-24: **45/45 pass** (vitest 5.0.1, 3.39 s); `tsc -p` clean. 1,483 engine lines + 708 test lines |
| Engine A spot checks | `lead/seats.test.ts` (run inside engine-a) | Seats: T1 7, T2 7–8, T3a 7, T3b 6, T4 2–3, T5 11–12, T6 7, T7 7–8, T8 2. Opening T2 116 × 96. Face T6 15.6. W=140 returns the same reference. 3b → back leaves left [armless 45][one-arm 27] (the G1 motivation). Centred coffee table clearance back 20 / left 26 / right 26 |
| Ortho demo | `ortho-demo/` (`src/three/{Rig,controls,orthoFit,presets,prism,keyLight,SofaModel,ThreeView}.tsx?`) | `dist/assets/ThreeView-*.js` 1,012,276 B (gzip -9: 270,849 B; vite-reported 273.25 kB); entry 200,563 B |
| Ortho screenshots | `ortho-demo/shots/` (35 files) | `ipad{Landscape,Portrait}-{trimetric,iso,dimetric,front,side,top}.png`, `phone-*.png`, `parity-overlay-*.png`, `export-*.png`, `style-*-trimetric.png`, `outline-zoom20-front.png`, `shadow-{on,off}-trimetric.png`, `resize-portrait-after-rotate.png` |
| Plan view prototype | `planview/` | Re-run: **56/56 pass** (engine-a 42, codec 4, store 8, table snap 2). Shots `planview/shots/*.png`; PDFs `planview/pdf/*.pdf` (+ pdf.js renders) |
| Placement prototype | `placement/check-bundle.mjs` (+ `placement/prototype.diff`, v1's host-app placement, historical only) | The bundle check caught a deliberate three.js leak (entry 1,851.27 kB) and is the starting point for this repo's `scripts/check-bundle.mjs`. Real engine + `PlanDrawing` + dims + codec + react-dom: 230,217 B raw / 74,469 B gzip (critic esbuild measurement), the basis of the §3 entry budget |
| Review probes | `engine-critic/probe.test.ts`, `editor/probe.test.ts` (run inside engine-a) | Prototype behaviour behind E-F1–E-F19; E13, E21, E22, E27 numbers confirmed |
| Unverified | – | Real-iPad behaviour (all touch via Chromium CDP emulation); iPad frame rate; `vite-plugin-pwa` support for the Vite major in use; iOS retention of the precache and localStorage for a rarely opened home-screen app; Vercel `/assets/*` cache headers |
