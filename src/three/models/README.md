# Blender models (H5c)

No model ships today: since 2026-11-11 the square pillow is made in code (a plain knife-edge pillow, `src/ortho/pillowShape.ts`), so it can be pressed behind a person and the plan's outline follows it. The loader still works: a file dropped here replaces the code-made pillow of the same name in 3D (the plan's outline and the pillow behind the person stay code-made).

Drop `.glb` files here; the app picks them up at build time (`src/three/models.ts`):

| File | Replaces | Fitted into (w × h × t) |
|---|---|---|
| `pillow-square.glb` | the procedural knife-edge square | 20 × 20 × 6″ |
| `pillow-ball.glb` | the procedural ball | 11 × 11 × 11″ |

Export from Blender: one object, modifiers and transforms applied, standing upright with Z up and the front facing −Y, real size (the app refits it exactly, so proportions matter), smooth shading, ≤ 10k triangles, under ~500 kB. File → Export → glTF 2.0, format **glTF Binary (.glb)**, **Draco compression off**. Textures are not needed: the app paints the pillows in its own tones.
