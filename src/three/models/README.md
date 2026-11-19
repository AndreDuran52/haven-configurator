# Blender models (H5c)

`pillow-square.glb` is Andre's karate-chop pillow (kept 2026-11-18: "looks more realistic to what is in real life"). It is used everywhere a square pillow is shown: the 3D (`src/three/Pillows.tsx`), the pillow behind a seated person (pressed where the back leans on it, `pressPillow`), and, through `scripts/pillow-outline.mjs` → `src/ortho/pillowBaked.ts`, the plan's footprint and the Side drawing's profile. **After changing the file or `SQUARE_PILLOW`, re-run** `node scripts/pillow-outline.mjs > src/ortho/pillowBaked.ts` (a test fails while the bake is stale).

Drop `.glb` files here; the app picks them up at build time (`src/three/models.ts`):

| File | Replaces | Fitted into (w × h × t) |
|---|---|---|
| `pillow-square.glb` | the procedural karate-chop square | 20 × 20 × 8″ |
| `pillow-ball.glb` | the procedural ball | 11 × 11 × 11″ |

Export from Blender: one object, modifiers and transforms applied, standing upright with Z up and the front facing −Y, real size (the app refits it exactly, so proportions matter), smooth shading, ≤ 10k triangles, under ~500 kB. File → Export → glTF 2.0, format **glTF Binary (.glb)**, **Draco compression off**. Textures are not needed: the app paints the pillows in its own tones.
