import { BoxGeometry, Group, Mesh, SphereGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { fitToBox, loadSoftModels, mergeScene } from './models';

describe('Blender models (H5c): refitted into the engine’s boxes', () => {
  it('fitToBox maps any bounds exactly onto ±w/2, ±h/2, ±t/2, with unit normals and UVs in inches', () => {
    const g = new BoxGeometry(0.5, 0.52, 0.17).translate(3, -2, 7); // metres, off-centre, like a Blender export
    fitToBox(g, 20, 20, 7);
    const b = g.boundingBox!;
    for (const [v, e] of [
      [b.min.x, -10],
      [b.max.x, 10],
      [b.min.y, -10],
      [b.max.y, 10],
      [b.min.z, -3.5],
      [b.max.z, 3.5],
    ] as const)
      expect(v).toBeCloseTo(e, 9);
    const n = g.getAttribute('normal');
    for (let i = 0; i < n.count; i++) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 6);
    // The front face (+z) keeps facing +z after the non-uniform scale.
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) if (n.getZ(i) > 0.5) expect([n.getZ(i), p.getZ(i)]).toEqual([expect.closeTo(1, 6), expect.closeTo(3.5, 9)]);
    const uv = g.getAttribute('uv');
    expect(uv.getX(0)).toBeCloseTo(p.getX(0) + p.getZ(0), 9);
  });

  it('mergeScene bakes node transforms and merges every mesh', () => {
    const root = new Group();
    const a = new Mesh(new BoxGeometry(1, 1, 1));
    a.position.set(10, 0, 0);
    const child = new Group();
    child.scale.set(2, 2, 2);
    child.add(new Mesh(new SphereGeometry(1, 8, 6)));
    root.add(a, child);
    const g = mergeScene(root)!;
    g.computeBoundingBox();
    expect(g.boundingBox!.min.x).toBeCloseTo(-2, 6);
    expect(g.boundingBox!.max.x).toBeCloseTo(10.5, 6);
    expect(g.getAttribute('normal')).toBeTruthy();
    expect(mergeScene(new Group())).toBeNull();
  });

  it('with no model files the procedural pillows stay (nothing is fetched)', async () => {
    const m = await loadSoftModels();
    expect(m.ball).toBeNull();
  });
});
