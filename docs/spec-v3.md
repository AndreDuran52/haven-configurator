# Haven Configurator: Build Spec (v3)

A tool for Venegas Designs. It opens on our standard Haven U. From there you type in a client's measurements, or clear it and build from scratch, then move pieces and tables around live with the client on an iPad or laptop.

---

## 1. Core idea

**One geometry engine, two views.**

- `buildHaven(config) → pieces[]` is a pure TypeScript function. It returns every piece with its exact position, size, and shape in inches.
- The plan view (SVG, CAD dimensions) and the 3D view (Three.js) both draw from that same list, so they can never disagree.

**A sectional is a set of "runs."**

- A run is one straight side: the back, the left leg, or the right leg.
- Each run is an ordered list of pieces.
- Corners are wedges shared by two runs.
- A U-shape has 3 runs and 2 wedges. An L-shape has 2 runs and 1 wedge.

**The outside size is locked by default.** When you resize, add, or move something, the neighboring seat pieces absorb the change so W / L / R stay at the client's numbers. Turn the lock off and a run grows instead.

---

## 2. Starting point: the Standard Haven U (loads first)

```
 ┌──────────┬────────┬──────────┬──────────┐
 │  WEDGE   │ TABLE  │ ARMLESS  │  WEDGE   │   Back = 60 + 32 + 36 + 60 = 188"
 │  60×60   │  32"   │   36"    │  60×60   │
 │      ╲___├────────┴──────────┤___╱      │
 ├──────┤                        ├──────────┤
 │ ONE- │                        │   ONE-   │   Legs = 132" (11 ft)
 │ ARM  │                        │   ARM    │   = 60 wedge + 72 piece
 │ 72"  │                        │   72"    │   72 = 58 seat + 14 arm
 │      │                        │          │
 ├──────┤                        ├──────────┤
 │ ARM  │                        │   ARM    │
 └──────┘                        └──────────┘
```

**The "Start from" menu** has four choices:

- **Standard U** (default, shown above).
- **Standard L**: left or right, the same pieces minus one leg.
- **Blank**: you set W / L / R and the shape, then add pieces yourself.
- **Saved configs.**

In Blank mode the gaps are allowed and shown hatched with a label ("unfilled 68"") until you fill them. The client sheet export is disabled until nothing is unfilled.

---

## 3. Real Haven dimensions (defaults)

**Plan (top view)**

| Item | Value | Notes |
|---|---|---|
| Overall depth (D) | 44" | Front of cushion to back of frame. Presets: 44 / 40 / 36 |
| Back (B) | 10" | The back frame plus the back cushion (assumed 4" frame + 6" cushion). Seat depth = D − B = 34" |
| Arm width (A) | 14" | Runs the full depth |
| Wedge (C) | 60" | The slider default. The auto rule is C = D + 16 |
| Side table | 32" | Range 16–40". Full depth D |
| Max single piece | 108" (9 ft), **including its arm** | Anything longer auto-splits |
| Min seat piece | 20" | Warn below this |

**Heights (for the 3D view)**

| Item | Value | Notes |
|---|---|---|
| Legs | 1" round | There's no base. The body sits on the legs |
| Seat height | 18" | Floor to the top of the seat cushion |
| Seat cushion | 8" crown, 6" at the stitch line | So the deck is at 10" |
| Arm height | 23" | Floor to the top of the arm |
| Back height | 27" | Floor to the top of the back = 1" leg + 26" body |
| Table height | 23" | Assumed to be flush with the arm (still needs confirming) |

---

## 4. Piece library ("Add piece" tray)

| Piece | Plan shape | Size rule | Notes |
|---|---|---|---|
| **Wedge** | A C × C square with the inside corner cut at 45° | Set by the wedge slider | Corners only. Has a back on both outside edges. No arm |
| **Armless seat** | Rectangle, length × D | 20–108" | The filler piece. Default 36" |
| **One-arm seat** (left or right arm) | Rectangle with a 14" arm at one end | Seat + 14 ≤ 108 | Goes at the open end of a run |
| **Table insert** | Rectangle, width × D, wood top | 16–40", default 32 | Anywhere (see section 6) |
| **Ottoman** (loose) | Free rectangle | Default 36 × 36 | Freestanding. **Not a chaise.** The Haven has no chaise |
| **Coffee table** (loose) | Free square | Default 48 × 48 | For checking clearance |

**Every run end has one of three end caps:** Arm (default), Table, or Open (no arm).

---

## 5. Wedge slider

- A drag bar under the plan: **Wedge size C**, range **D (a square corner, no angle) up to D + 30**, snapping every 1".
- The default is 60 at 44 deep and follows **C = D + 16** when the depth changes. Once you drag it, it stays where you put it until you hit "Reset wedge."
- Live readout next to it:
  - `Wedge 60 × 60 · angled face 22.6"`
  - The angled face = (C − D) × √2.
- Dragging it resizes the seat pieces in both runs next to that corner. The outside size stays locked.
- Warn if the angled face is under 8".

---

## 6. Tables go anywhere

- A table insert snaps to **any seam** in any run:
  - next to a wedge,
  - between seats,
  - in the middle of a leg,
  - or at a run's end, either **in place of the arm** or **outside the arm**.
- Drag it along a run and it snaps to the nearest seam. The seat pieces around it resize to keep the run's total.
- There can be several tables.

---

## 7. Interaction

- **Shape picker:** U / L-left / L-right.
- **Measurements:** W (back), L (left leg), R (right leg), and D. The pieces rebuild immediately.
- **Seam handles:** drag the line between two pieces to resize both. Their total stays the same. The inches show live.
- **Reorder:** drag a piece along its run.
- **Tap a piece** to see its type and size, with a menu: delete, convert (armless ↔ one-arm), and end cap (arm / table / open).
- **Auto-split:** anything over 108" splits into equal pieces.
- **Lock outside size** toggle (on by default).
- **Views:** Plan (default) / 3D (orbit, plus presets: top, front, 3/4).
- **Fabric swatches:** white bouclé to start. **Table finish:** walnut or dark wood.
- **Undo / redo**, **Reset**, and big touch targets for iPad.

---

## 8. Geometry rules

Coordinates are in inches. The origin is the outside back-left corner, x runs across the back, y runs toward the open end.

**Wedges and runs**

- **Wedge polygon** (back-left corner): (0,0) (C,0) (C,D) (D,C) (0,C). Mirror it for the other corners.
- **Space available for pieces:**
  - U back run = W − 2C.
  - U leg = its length − C.
  - L-shape: the back run is W − C, the leg is its length − C.
- The pieces in each run add up **exactly** to the available space. No gaps or overlaps, except the labeled gaps in Blank mode. Round to 0.5".
- **The default fill** for a new run is end cap arm (14) + one seat piece for the rest, auto-split if it's over 108.

**Derived numbers**

- Seat depth = D − B.
- **Inside opening (U):** width = W − 2D, depth = min(L, R) − D.
- Coffee table clearance: warn if it's under 14" on any side.

**Seat count**

- Each wedge = 1 seat.
- Each straight stretch of seat pieces (between wedges, tables, and arms) = floor(length / 28) comfortable, floor(length / 24) snug.
- It's shown as "Seats 7" when the two match, or "Seats 7–8" when they differ.
- The seat width is a setting (default 28").

**Warnings** (yellow, never blocking):

- A piece is over 108" or a seat is under 20".
- The table is outside 16–40".
- The wedge's angled face is under 8".
- The opening is under 60".
- Seat depth is under 24".

---

## 9. 3D approach

- **Build frames and cushions procedurally from the dimensions above. Don't stretch Blender models,** because stretching distorts the rounded ends and the stitching.
  - Seat cushion: a rounded box, 6" at the edges, crowned to 8".
  - Body, arm, and back: rounded boxes at the heights in section 3.
  - Wedge: the extruded polygon.
  - 1" round legs at the corners of each piece.
- **Reuse our Blender assets that don't need to stretch.** Export the square pillow, ball pillow, and fabric and wood textures as `.glb` + texture maps and put them in `public/models/`. Pillows auto-place on the wedges and the arm ends.
- Soft studio light, a light wood floor, and `ContactShadows`.
- The line-art top view (like our reference image) is a **"Sketch" style toggle** in the plan view: white fill, black outlines, cushion seams, and wood grain on the tables.

---

## 10. Outputs

- **Client sheet** (PNG/PDF): the CAD-style plan. Thin lines, small arrowheads, extension lines with a gap from the object, rotated vertical labels, overall W / L / R, table widths, a 44"D callout, and "Seats X."
- **Shop sheet:** the same plan plus a piece list (type, length × depth, arm side, quantity, heights) for the PM.
- **Share link:** the whole configuration encoded in the URL.
- **Blender export (phase 6):** a `config.json` plus a Blender Python script that rebuilds the layout with our real models for photoreal renders at true size.
- **Price (later):** a `priceFor(config)` stub.

---

## 11. Tech stack and files

Vite + React + TypeScript · `@react-three/fiber` + `@react-three/drei` · SVG plan view · Zustand with URL sync · `jspdf` · Vercel.

```
src/
  engine/types.ts          // Piece, Run, Config
  engine/defaults.ts       // Standard U / L, all dimensions in section 3
  engine/pieces.ts         // piece library
  engine/buildHaven.ts     // config → pieces[] (pure, no React)
  engine/layout.ts         // fill, auto-split, seam resize, table placement, blank-mode gaps
  engine/seating.ts        // seat count, opening, clearances, warnings
  engine/buildHaven.test.ts
  views/PlanView.tsx       // SVG + CAD dimensions + seam handles + sketch style
  views/ThreeView.tsx
  views/WedgeSlider.tsx
  ui/Sidebar.tsx  ui/PieceTray.tsx  ui/StartMenu.tsx  ui/ExportButtons.tsx
  store.ts
public/models/
```

---

## 12. Engine tests (vitest, all must pass before any UI)

1. **Standard U** (W188, L132, R132, D44, C60, A14):
   - The back run is [wedge 60][table 32][armless 36][wedge 60] = 188.
   - Each leg = one one-arm piece of 72 (58 + 14).
   - Seat depth 34. Opening 100 wide × 88 deep. Seats 7.
2. **D = 36, auto wedge**: C = 52.
   - The back armless = 52.
   - Legs = 80 (66 + 14).
   - Seat depth 26. The outside stays 188 / 132 / 132.
3. **Moving the table.**
   - **a.** Move the table from the back to the end of the left leg, in place of the arm: left leg = 40 armless + 32 table, and the back armless = 68.
   - **b.** Move it to the middle of the left leg instead: left leg = 13 + 32 + 13 + 14 arm, and the "seat under 20" warning fires.
4. **L-right, W120, R100, C60**:
   - Back = one-arm 60 (46 + 14).
   - Leg = one-arm 40 (26 + 14).
5. **Auto-split: U with W = 300**: the back armless is 148, which is over 108, so it becomes 2 × 74.
6. **Wedge slider 60 → 55 on the Standard U**:
   - Legs = 77 (63 + 14).
   - The back armless = 46.
   - The outside is unchanged.
7. **Open end on the right leg**: the right leg is one 72 armless piece.
8. **Blank U, W188, L132, R132, with only the wedges placed**: the runs report as unfilled (68 on the back, 72 on each leg), and export is blocked.
9. **For every test**, each filled run adds up exactly to its available space, and no piece is over 108.

---

## 13. Build phases

1. Engine + tests.
2. Plan view: start menu, shape picker, inputs, CAD dimensions, seat count, warnings.
3. Editing: piece tray, seam handles, reorder, table dragging, the wedge slider, end caps, Blank mode.
4. 3D view with the Blender pillows and textures. Add the sketch style to the plan view.
5. Exports: client sheet, shop sheet, share link.
6. Blender round-trip for photoreal renders.

---

## 14. Open questions

- Table height: is it flush with the arm at 23"?
- The back split: 4" frame + 6" back cushion?
- Loose ottoman: a standard size, or free sizing?

---

## Kickoff prompt for Claude Code

> Read `haven-configurator-spec.md`. Build phases 1 and 2 only: the pure geometry engine in `src/engine` (no React imports) with all nine vitest tests passing, then the SVG plan view that loads the Standard Haven U with the start menu, shape picker, measurement inputs, CAD-style dimensions, seat count, and warnings. Use Vite + React + TypeScript. Run the tests and show me the Standard U in the plan view before starting phase 3.
