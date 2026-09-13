import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalJson, mandateVersionDigest } from "../../packages/protocol/src/index.js";
import { MandateAmendmentSchema, MandateSchema, parseMandate } from "../../packages/schemas/src/index.js";

const fixturePath = (name: string) => fileURLToPath(new URL(`../fixtures/protocol-v0.1/${name}`, import.meta.url));
const fixture = <T>(name: string): T => JSON.parse(readFileSync(fixturePath(name), "utf8")) as T;

describe("protocol v0.1", () => {
  it("accepts the canonical checkout and child Mandates", () => {
    const parent = fixture<{ input: unknown }>("valid-checkout-mandate.json").input;
    const child = fixture<{ input: { child: unknown } }>("valid-child-mandate.json").input.child;

    expect(MandateSchema.safeParse(parent).success).toBe(true);
    expect(MandateSchema.safeParse(child).success).toBe(true);
  });

  it("accepts the canonical database amendment", () => {
    const amendment = fixture<{ input: { amendment: unknown } }>("database-amendment.json").input.amendment;
    expect(MandateAmendmentSchema.safeParse(amendment).success).toBe(true);
  });

  it("rejects unknown fields and malformed path patterns", () => {
    const parent = fixture<{ input: Record<string, unknown> }>("valid-checkout-mandate.json").input;
    expect(MandateSchema.safeParse({ ...parent, hiddenAuthority: true }).success).toBe(false);

    const scope = structuredClone(parent.scope) as { resources: Array<{ include: string[] }> };
    scope.resources[0]!.include = ["services/**/secrets"];
    expect(MandateSchema.safeParse({ ...parent, scope }).success).toBe(false);
  });

  it("rejects invalid timestamps, fractional micro-USD, and unsorted sets", () => {
    const parent = fixture<{ input: Record<string, any> }>("valid-checkout-mandate.json").input;
    expect(MandateSchema.safeParse({ ...parent, createdAt: "2026-99-01T00:00:00.000Z" }).success).toBe(false);
    expect(MandateSchema.safeParse({ ...parent, limits: { monetaryBudgetUsd: 0.0000001 } }).success).toBe(false);
    const authority = structuredClone(parent.authority);
    authority.allowedEffects.reverse();
    expect(MandateSchema.safeParse({ ...parent, authority }).success).toBe(false);
  });

  it("round-trips through canonical JSON and rejects invalid Unicode", () => {
    const parent = parseMandate(fixture<{ input: unknown }>("valid-checkout-mandate.json").input);
    expect(JSON.parse(canonicalJson(parent))).toEqual(parent);
    expect(() => canonicalJson("\ud800")).toThrow("lone surrogates");
  });

  it("produces the frozen version digest", () => {
    const parent = parseMandate(fixture<{ input: unknown }>("valid-checkout-mandate.json").input);
    expect(mandateVersionDigest(parent)).toBe(
      "sha256:f5c6ff202ed7c04f4b745d90daadabbdbb015dfea3531503b5cd752ebb6b8f24",
    );
  });
});
