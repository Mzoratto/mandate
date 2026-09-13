import { describe, expect, it, vi } from "vitest";
import {
  assertGovernedAgentOsCapabilities,
  createAgentOsControlPlaneHandlers,
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

  it("binds AgentOS authorization and evidence to one authenticated execution", async () => {
    const mandateVersionDigest = `sha256:${"a".repeat(64)}`;
    const requests: Array<{ url: string; body: Record<string, unknown>; authorization: string | null }> = [];
    const fetch: typeof globalThis.fetch = async (input, init) => {
      const url = input.toString();
      requests.push({
        url,
        body: JSON.parse(init?.body as string) as Record<string, unknown>,
        authorization: new Headers(init?.headers).get("authorization"),
      });
      return url.endsWith("/authorize")
        ? Response.json({
            decision: "ALLOW",
            reasons: ["within authority"],
            violatedRules: [],
            amendmentSuggested: false,
            mandateVersionDigest,
          })
        : Response.json({
            status: "EXECUTED",
            evidence: { id: "evidence-1", executionActionId: "action-1" },
          });
    };
    const handlers = createAgentOsControlPlaneHandlers({
      baseUrl: "https://control.mandate.test",
      credential: "t".repeat(32),
      executionId: "execution-1",
      mandateVersionDigest,
      fetch,
      settlement: () => ({ outcome: "SUCCEEDED", usage: { monetarySpentUsd: 0.000001, tokensUsed: 12 } }),
    });
    await expect(handlers.beforeAction(
      { actionId: "action-1", tool: "filesystem", operation: "readFile", inputs: { path: "README.md" } },
      [{ type: "CODE_READ", resources: ["repository://checkout-demo/README.md"], reversible: true, confidence: 1 }],
    )).resolves.toMatchObject({ decision: "ALLOW" });
    await handlers.publishEvidence({
      id: "evidence-1",
      mandateId: "M-1047",
      mandateVersion: 1,
      executionActionId: "action-1",
      type: "trace",
      producer: "agentos",
      createdAt: "2026-09-13T12:00:00.000Z",
    });
    expect(requests.map(({ url }) => url)).toEqual([
      "https://control.mandate.test/v1/executions/execution-1/actions/authorize",
      "https://control.mandate.test/v1/executions/execution-1/actions/action-1/settle",
    ]);
    expect(requests.every(({ authorization }) => authorization === `Bearer ${"t".repeat(32)}`)).toBe(true);
    expect(requests[1]?.body).toMatchObject({
      outcome: "SUCCEEDED",
      usage: { monetarySpentUsd: 0.000001, tokensUsed: 12 },
      evidence: { id: "evidence-1", type: "trace" },
    });
  });

  it("fails closed on malformed control-plane responses", async () => {
    const handlers = createAgentOsControlPlaneHandlers({
      baseUrl: "https://control.mandate.test",
      credential: "t".repeat(32),
      executionId: "execution-1",
      mandateVersionDigest: `sha256:${"a".repeat(64)}`,
      fetch: async () => Response.json({ decision: "allow", reasons: [], violatedRules: [] }),
      settlement: () => ({ outcome: "SUCCEEDED", usage: { monetarySpentUsd: 0, tokensUsed: 0 } }),
    });
    await expect(handlers.beforeAction(
      { actionId: "action-1", tool: "shell", operation: "execute", inputs: { command: "git status" } },
      [{ type: "LOCAL_COMMAND_EXECUTION", resources: [], reversible: false, confidence: 0 }],
    )).rejects.toThrow("invalid authorization result");
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
