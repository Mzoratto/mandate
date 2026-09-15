import {
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  SRGBColorSpace,
  MathUtils,
} from "three";

import { createPortraitVolume } from "./PortraitVolume";

/** Reference-colored front with modeled volume and surface-sampled sides/back. */
export function generateReferencePortrait(
  image: HTMLImageElement,
  source: BufferGeometry,
) {
  const volume = createPortraitVolume(source);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
  const color = new Color();
  // Stratified samples preserve eye/lip detail without clustering or a visible pixel grid.
  for (let py = 0.145; py < 0.94; py += 1.15 / image.height)
    for (let px = 0.19; px < 0.79; px += 1.15 / image.width) {
      const u = px + (random() - 0.5) / image.width,
        v = py + (random() - 0.5) / image.height;
      const i =
        (Math.floor(v * image.height) * image.width +
          Math.floor(u * image.width)) *
        4;
      const r = data[i] / 255,
        g = data[i + 1] / 255,
        b = data[i + 2] / 255;
      if (b < 0.065 || b - r < 0.018) continue;
      // Exclude the reference's rings, labels and frame; retain detached bust particles.
      const width = v < 0.67 ? 0.205 : 0.205 + (v - 0.67) * 0.5;
      if (Math.abs(u - 0.5) > width) continue;
      const x = (u - 0.5) * 3.78,
        y = (0.5 - v) * 3.5;
      const { position: p, normal: n } = volume.lift(x, y);
      positions.push(p.x, p.y, p.z);
      color.setRGB(r, g, b, SRGBColorSpace);
      colors.push(color.r, color.g, color.b);
      seeds.push(random());
      back.push(0);
      sizes.push(1.05 + random() * 0.2);
      const interior = ((u - 0.5) / 0.15) ** 2 + ((v - 0.42) / 0.24) ** 2 < 1;
      coverage.push(interior ? 1 : MathUtils.smoothstep(color.b, 0.008, 0.055));
      regions.push(v > 0.67 ? 5 : 0);
      directions.push(x * 0.3, -random() * 0.3, p.z * 0.15);
      normals.push(n.x, n.y, n.z);
    }
  for (const { position: p, normal: n } of volume.sample(random)) {
    positions.push(p.x, p.y, p.z);
    normals.push(n.x, n.y, n.z);
    const glow = 0.12 + Math.pow(random(), 4) * 1.4;
    colors.push(0.055 * glow, 0.24 * glow, 0.3 * glow);
    seeds.push(random());
    back.push(1);
    sizes.push(0.8 + random() * 1.5);
    coverage.push(MathUtils.smoothstep(p.y, -1.6, -1.0));
    regions.push(p.y < -0.65 ? 5 : 2);
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
