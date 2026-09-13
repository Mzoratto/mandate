import { describe, expect, it, vi } from "vitest";
import {
  assertGovernedAgentOsCapabilities,
  mandateToAgentOsTask,
  startAgentOsExecution,
  type AgentOsBridge,
} from "../../packages/adapter-agentos/src/index.js";
import { checkoutMandate } from "../helpers.js";

describe("AgentOS adapter boundary", () => {
  it("maps only explicit Mandate scope and limits", () => {
    const mandate = checkoutMandate();
    mandate.limits.maxExecutionSeconds = 601;
    mandate.limits.tokenBudget = 20_000;
    expect(mandateToAgentOsTask(mandate, true, () => "/tmp/checkout-demo")).toMatchObject({
      externalId: "M-1047@1",
      repository: "/tmp/checkout-demo",
      includePaths: ["services/checkout/**", "tests/checkout/**"],
      maxMinutes: 11,
      maxTokens: 20_000,
      dryRun: true,
    });
  });

  it("fails closed when the host lacks any enforcement capability", () => {
    expect(() => assertGovernedAgentOsCapabilities({
      isolatedWorktree: true,
      beforeActionInterception: false,
      stopOnDenial: true,
      evidenceCallbacks: true,
    })).toThrow("beforeActionInterception");
  });

  it("does not create a live task before capability validation", async () => {
    const createTask = vi.fn();
    const bridge: AgentOsBridge = {
      capabilities: async () => ({
        isolatedWorktree: true,
        beforeActionInterception: false,
        stopOnDenial: true,
        evidenceCallbacks: true,
      }),
      createTask,
      runTask: vi.fn(),
      stopTask: vi.fn(),
    };
    await expect(startAgentOsExecution(
      checkoutMandate(),
      bridge,
      { beforeAction: vi.fn(), publishEvidence: vi.fn() },
      { resolveRepository: () => "/tmp/checkout-demo" },
    )).rejects.toThrow("beforeActionInterception");
    expect(createTask).not.toHaveBeenCalled();
  });
});
