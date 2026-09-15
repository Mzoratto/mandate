import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const referenceUrl = new URL("../public/models/portrait-reference.png", import.meta.url);

describe("approved particle portrait", () => {
  it("keeps the authorized generated reference and fitted projection pipeline", () => {
    const reference = readFileSync(referenceUrl);
    const component = readFileSync(
      new URL("../src/components/agent/ParticlePortrait.tsx", import.meta.url),
      "utf8",
    );
    const generator = readFileSync(
      new URL("../src/components/agent/ReferencePortrait.ts", import.meta.url),
      "utf8",
    );
    const attribution = readFileSync(
      new URL("../public/models/ATTRIBUTION.txt", import.meta.url),
      "utf8",
    );

    expect(createHash("sha256").update(reference).digest("hex")).toBe(
      "787fe9c9568f3c166679a8baa87abb559076ce0f40fe1a9f98947e87876e803d",
    );
    expect(component).toContain("THREE.TextureLoader");
    expect(component).toContain('"/models/portrait-reference.png"');
    expect(component).toContain("generateReferencePortrait");
    expect(component).toContain("Math.PI / 45");
    expect(generator).toContain("ctx.getImageData");
    expect(generator).toContain("volume.lift");
    expect(attribution).toContain("generated with ChatGPT");
    expect(attribution).toContain("explicitly authorized public use");
  });

  it("keeps the reference local and excludes its labels and frame", () => {
    const generator = readFileSync(
      new URL("../src/components/agent/ReferencePortrait.ts", import.meta.url),
      "utf8",
    );

    expect(generator).toContain("if (b < 0.065 || b - r < 0.018) continue");
    expect(generator).toContain("if (Math.abs(u - 0.5) > width) continue");
    expect(generator).not.toMatch(/https?:\/\//);
  });
});
