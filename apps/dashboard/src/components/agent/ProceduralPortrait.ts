import {
  BufferGeometry,
  Float32BufferAttribute,
  MathUtils,
} from "three";

import { createPortraitVolume } from "./PortraitVolume";

/** Deterministic particles sampled only from the bundled CC0 anatomical mesh. */
export function generateProceduralPortrait(source: BufferGeometry) {
  const volume = createPortraitVolume(source);
  let seed = 9132026;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const positions: number[] = [],
    colors: number[] = [],
    seeds: number[] = [],
    sizes: number[] = [],
    regions: number[] = [],
    directions: number[] = [],
    normals: number[] = [],
    coverage: number[] = [],
    back: number[] = [];

  for (const { position: p, normal: n } of volume.sample(random)) {
    const frontLight = Math.pow(Math.max(0, n.z), 1.7);
    const eye = p.z > 0.55
      && Math.abs(p.y - 0.31) < 0.16
      && Math.abs(Math.abs(p.x) - 0.29) < 0.17;
    const mouth = p.z > 0.48 && p.y > -0.31 && p.y < -0.12 && Math.abs(p.x) < 0.22;
    const energy = 0.18 + 0.82 * frontLight;
    positions.push(p.x, p.y, p.z);
    normals.push(n.x, n.y, n.z);
    colors.push(
      eye ? 0.36 : mouth ? 0.11 * energy : 0.07 * energy,
      eye ? 0.78 : mouth ? 0.38 * energy : 0.34 * energy,
      eye ? 1 : mouth ? 0.5 * energy : 0.48 * energy,
    );
    seeds.push(random());
    const isBack = n.z < 0.05;
    back.push(isBack ? 1 : 0);
    sizes.push((isBack ? 0.72 : 0.96) + random() * (isBack ? 0.9 : 0.48));
    coverage.push(
      MathUtils.smoothstep(p.y, -1.65, -0.95) * (0.62 + 0.38 * frontLight),
    );
    regions.push(p.y < -0.65 ? 5 : isBack ? 2 : 0);
    directions.push(n.x * 0.3, -random() * 0.3, n.z * 0.3);
  }

  const geometry = new BufferGeometry();
  for (const [name, values, itemSize] of [
    ["position", positions, 3],
    ["aReferenceColor", colors, 3],
    ["aSeed", seeds, 1],
    ["aBack", back, 1],
    ["aCoverage", coverage, 1],
    ["aBaseSize", sizes, 1],
    ["aRegion", regions, 1],
    ["aRandomDirection", directions, 3],
    ["normal", normals, 3],
  ] as [string, number[], number][])
    geometry.setAttribute(name, new Float32BufferAttribute(values, itemSize));
  return { particles: geometry, surface: volume.surface };
}
