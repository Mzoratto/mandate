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
    const frontLight = Math.max(0, n.z);
    const keyLight = Math.pow(
      Math.max(0, n.x * -0.34 + n.y * 0.2 + n.z * 0.92),
      1.25,
    );
    const eyeSocket = p.z > 0.55
      && p.y > 0.16
      && p.y < 0.43
      && Math.abs(Math.abs(p.x) - 0.29) < 0.13;
    const mouth = p.z > 0.48
      && p.y > -0.31
      && p.y < -0.12
      && Math.abs(p.x) < 0.22;
    const noseBridge = p.z > 0.7
      && p.y > -0.06
      && p.y < 0.42
      && Math.abs(p.x) < 0.11;
    let tone = 0.1
      + 0.68 * keyLight
      + 0.14 * Math.pow(frontLight, 3)
      + 0.08 * Math.pow(Math.abs(n.x), 2);
    if (eyeSocket) tone *= 0.2;
    if (mouth) tone *= 0.32;
    if (noseBridge) tone = Math.min(1, tone + 0.2);
    positions.push(p.x, p.y, p.z);
    normals.push(n.x, n.y, n.z);
    colors.push(0.08 * tone, 0.42 * tone, 0.62 * tone);
    seeds.push(random());
    const isBack = n.z < 0.05;
    back.push(isBack ? 1 : 0);
    sizes.push((isBack ? 0.58 : 0.78) + random() * (isBack ? 0.76 : 0.42));
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
