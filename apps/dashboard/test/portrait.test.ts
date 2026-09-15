import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import type { Mesh } from "three";

import { generateProceduralPortrait } from "../src/components/agent/ProceduralPortrait";

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

describe("procedural portrait", () => {
  it("keeps dense facial detail with darker eye sockets than the nose bridge", () => {
    const object = new OBJLoader().parse(
      readFileSync(new URL("../public/models/NeutralHead.obj", import.meta.url), "utf8"),
    );
    const source = (object.getObjectByProperty("isMesh", true) as Mesh).geometry;
    const { particles } = generateProceduralPortrait(source);
    const positions = particles.getAttribute("position");
    const colors = particles.getAttribute("aReferenceColor");
    const eyeSocket: number[] = [];
    const noseBridge: number[] = [];

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
    }

    expect(positions.count).toBeGreaterThanOrEqual(42_000);
    expect(eyeSocket.length).toBeGreaterThan(400);
    expect(noseBridge.length).toBeGreaterThan(100);
    expect(average(eyeSocket)).toBeLessThan(average(noseBridge) * 0.65);
  });
});
