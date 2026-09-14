import { describe, expect, it, vi } from "vitest";
import type { Mandate } from "../../packages/protocol/src/index.js";
import { createCheckoutWorkPreparer } from "../../apps/api/src/mcp/work-preparation.js";
import type { AuthenticatedIdentity } from "../../apps/api/src/control-plane/repository.js";

const principal: AuthenticatedIdentity = {
  kind: "principal",
  id: "alexa-user-001",
  principalType: "human",
};
const config = {
  subject: { agentId: "agentos-checkout", runtime: "agentos" as const, instanceId: "run-001" },
  repositoryResource: "checkout-demo",
  repositoryCommitDigest: `sha256:${"a".repeat(64)}` as const,
  testVerifier: "verifier:test-runner",
  reviewVerifier: "verifier:independent-review",
  now: () => "2026-09-14T12:00:00.000Z",
};

function repository() {
  return {
    prepareAgentWork: vi.fn(async (
      _identity: AuthenticatedIdentity,
      mandate: Mandate,
      _idempotencyKey: string,
      _requestDigest: string,
    ) => ({
      mandate: { ...mandate, status: "AWAITING_APPROVAL" as const },
      versionDigest: `sha256:${"b".repeat(64)}`,
    })),
  };
}

describe("Alexa work preparation", () => {
  it("resolves an intent into a server-owned zero-budget authority envelope", async () => {
    const repo = repository();
    const prepare = createCheckoutWorkPreparer(repo, config);
    const result = await prepare(principal, {
      outcome: "Restore correct coupon totals in the checkout test suite.",
      requestKey: "alexa-request-001",
    });
    const mandate = repo.prepareAgentWork.mock.calls[0]![1];

    expect(result).toMatchObject({ state: "AWAITING_APPROVAL", summary: expect.stringContaining("Nothing has executed") });
    expect(mandate).toMatchObject({
      id: result.reference,
      principal: { id: "alexa-user-001", type: "human" },
      subject: { agentId: "agentos-checkout", runtime: "agentos", instanceId: "run-001" },
      status: "DRAFT",
      limits: { monetaryBudgetUsd: 0, tokenBudget: 0, maxMutations: 1, maxExternalCalls: 0 },
      assumptions: [{ key: "repositoryCommit", valueHash: config.repositoryCommitDigest, invalidatesOnChange: true }],
    });
    expect(mandate.scope.resources).toEqual([{
      kind: "repository",
      resource: "checkout-demo",
      include: ["services/checkout/**", "tests/checkout/**"],
      exclude: [],
    }]);
    expect(mandate.authority.forbiddenEffects.map(({ type }) => type)).toEqual(expect.arrayContaining([
      "DATABASE_SCHEMA_MUTATION",
      "DEPENDENCY_MODIFICATION",
      "NETWORK_REQUEST",
      "PRODUCTION_DEPLOYMENT",
      "SECRET_WRITE",
    ]));
    expect(repo.prepareAgentWork.mock.calls[0]![2]).toBe("alexa-request-001");
    expect(repo.prepareAgentWork.mock.calls[0]![3]).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it("uses the principal and request key as a stable reference without widening on retries", async () => {
    const repo = repository();
    const prepare = createCheckoutWorkPreparer(repo, config);
    const input = { outcome: "Restore correct coupon totals in the checkout test suite.", requestKey: "retry-001" };
    const first = await prepare(principal, input);
    const second = await prepare(principal, input);
    expect(second.reference).toBe(first.reference);
    expect(repo.prepareAgentWork.mock.calls[1]![3]).toBe(repo.prepareAgentWork.mock.calls[0]![3]);
  });

  it("refuses service identity and unsafe configuration", async () => {
    const prepare = createCheckoutWorkPreparer(repository(), config);
    await expect(prepare(
      { kind: "principal", id: "alexa-service", principalType: "service" },
      { outcome: "Restore correct coupon totals in checkout.", requestKey: "request-002" },
    )).rejects.toThrow("linked customer");
    expect(() => createCheckoutWorkPreparer(repository(), {
      ...config,
      repositoryCommitDigest: "sha256:placeholder" as `sha256:${string}`,
    })).toThrow("not safely configured");
  });
});
