# Blender models (H5c)

Drop `.glb` files here; the app picks them up at build time (`src/three/models.ts`):

| File | Replaces | Fitted into (w × h × t) |
|---|---|---|
| `pillow-square.glb` | the procedural karate-chop square | 20 × 20 × 7″ |
| `pillow-ball.glb` | the procedural ball | 11 × 11 × 11″ |

Export from Blender: one object, modifiers and transforms applied, standing upright with Z up and the front facing −Y, real size (the app refits it exactly, so proportions matter), smooth shading, ≤ 10k triangles, under ~500 kB. File → Export → glTF 2.0, format **glTF Binary (.glb)**, **Draco compression off**. Textures are not needed: the app paints the pillows in its own tones.
