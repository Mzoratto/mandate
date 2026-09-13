import { describe, expect, it } from "vitest";
import { classifyAction } from "../../packages/effects/src/index.js";

const context = {
  repository: "checkout-demo",
  environment: "local",
  database: "checkout-db",
  service: "checkout-api",
};

describe("deterministic effect adapters", () => {
  it.each([
    ["services/checkout/index.ts", "CODE_MODIFICATION"],
    ["tests/checkout/index.test.ts", "TEST_MODIFICATION"],
    ["services/checkout/package.json", "DEPENDENCY_MODIFICATION"],
    ["services/checkout/migrations/001.sql", "DATABASE_SCHEMA_MUTATION"],
    ["services/checkout/.env", "SECRET_WRITE"],
  ] as const)("maps a write to %s as %s", (path, type) => {
    const effects = classifyAction({
      actionId: "action-write",
      tool: "filesystem",
      operation: "writeFile",
      inputs: { path },
    }, context);
    expect(effects[0]!.type).toBe(type);
    expect(effects[0]!.confidence).toBe(1);
  });

  it("classifies dangerous effects nested in shell commands", () => {
    const effects = classifyAction({
      actionId: "action-shell",
      tool: "shell",
      operation: "execute",
      inputs: { command: "drizzle-kit push && deploy --production" },
    }, context);
    expect(effects.map((effect) => effect.type)).toEqual([
      "LOCAL_COMMAND_EXECUTION",
      "DATABASE_SCHEMA_MUTATION",
      "PRODUCTION_DEPLOYMENT",
    ]);
  });

  it("marks every generic shell action uncertain", () => {
    const effects = classifyAction({
      actionId: "action-shell",
      tool: "shell",
      operation: "execute",
      inputs: { command: "echo safe-looking" },
    }, context);
    expect(effects).toMatchObject([{ type: "LOCAL_COMMAND_EXECUTION", confidence: 0 }]);
  });

  it("rejects traversal before classification", () => {
    expect(() => classifyAction({
      actionId: "action-traversal",
      tool: "filesystem",
      operation: "readFile",
      inputs: { path: "services/checkout/../secrets" },
    }, context)).toThrow("traversal");
  });
});
