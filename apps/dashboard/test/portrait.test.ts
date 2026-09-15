import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import type { Mesh } from "three";

import { generateProceduralPortrait } from "../src/components/agent/ProceduralPortrait";

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

describe("procedural portrait", () => {
  it("renders anatomical relief without a texture sampler", () => {
    const vertex = readFileSync(
      new URL("../src/components/agent/shaders/surface.vert.glsl", import.meta.url),
      "utf8",
    );
    const fragment = readFileSync(
      new URL("../src/components/agent/shaders/surface.frag.glsl", import.meta.url),
      "utf8",
    );

    expect(vertex).toContain("normalMatrix*normal");
    expect(fragment).toContain("vSurfaceNormal");
    expect(fragment).not.toMatch(/sampler2D|texture2D/);
  });

  it("keeps dense facial detail while fading the scalp and ears", () => {
    const object = new OBJLoader().parse(
      readFileSync(new URL("../public/models/NeutralHead.obj", import.meta.url), "utf8"),
    );
    const source = (object.getObjectByProperty("isMesh", true) as Mesh).geometry;
    const { particles } = generateProceduralPortrait(source);
    const positions = particles.getAttribute("position");
    const colors = particles.getAttribute("aReferenceColor");
    const eyeSocket: number[] = [];
    const noseBridge: number[] = [];
    const face: number[] = [];
    const scalp: number[] = [];
    const ears: number[] = [];
    const coverage = particles.getAttribute("aCoverage");

    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      if (
        z > 0.55 &&
        y > 0.16 &&
        y < 0.43 &&
        Math.abs(Math.abs(x) - 0.29) < 0.13
      ) eyeSocket.push(colors.getZ(index));
      if (z > 0.7 && y > -0.06 && y < 0.42 && Math.abs(x) < 0.11)
        noseBridge.push(colors.getZ(index));
      const visibleTone = colors.getZ(index) * coverage.getX(index);
      if (z > 0.6 && y > -0.5 && y < 0.55 && Math.abs(x) < 0.55)
        face.push(visibleTone);
      if (z > 0.2 && y > 0.62) scalp.push(visibleTone);
      if (Math.abs(x) > 0.62 && y > -0.15 && y < 0.45)
        ears.push(visibleTone);
    }

    expect(positions.count).toBeGreaterThanOrEqual(42_000);
    expect(eyeSocket.length).toBeGreaterThan(400);
    expect(noseBridge.length).toBeGreaterThan(100);
    expect(average(eyeSocket)).toBeLessThan(average(noseBridge) * 0.65);
    expect(average(scalp)).toBeLessThan(average(face) * 0.7);
    expect(average(ears)).toBeLessThan(average(face) * 0.65);
  });
});
