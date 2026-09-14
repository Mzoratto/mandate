import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDashboardSource, parseLiveMandate } from "../../apps/dashboard/src/lib/mandate/live.js";

const context = {
  mandate: {
    id: "M-live-1",
    status: "COMPLETED",
    goal: { statement: "Repair checkout." },
    principal: { id: "principal-1" },
    subject: { agentId: "agent-1", runtime: "agentos" },
    authority: {
      allowedEffects: [{ type: "CODE_MODIFICATION" }],
      forbiddenEffects: [{ type: "PRODUCTION_DEPLOYMENT" }],
    },
    scope: {
      resources: [{ include: ["services/checkout/**"] }],
      environments: ["local"],
    },
    limits: { monetaryBudgetUsd: 5 },
    approvedAt: "2026-09-13T00:00:00.000Z",
    completedAt: "2026-09-13T00:01:00.000Z",
  },
  versionDigest: `sha256:${"a".repeat(64)}`,
  execution: {
    id: "execution-1",
    startedAt: "2026-09-13T00:00:10.000Z",
    finishedAt: "2026-09-13T00:01:00.000Z",
    tokensUsed: 0,
    monetarySpentMicroUsd: 0,
    mutationActions: 1,
    actions: [{
      id: "action-1",
      status: "EXECUTED",
      decision: "ALLOW",
      tool: "filesystem",
      operation: "applyChanges",
      proposedAt: "2026-09-13T00:00:20.000Z",
      executedAt: "2026-09-13T00:00:30.000Z",
      effects: [{ type: "CODE_MODIFICATION", resources: ["repository://checkout-demo/services/checkout/total.js"] }],
    }],
  },
  evidence: [{
    id: "evidence-1",
    requirementId: "test-report",
    type: "test-report",
    producer: "verifier:test-runner",
    verified: true,
    verifiedBy: "verifier:test-runner",
    createdAt: "2026-09-13T00:00:40.000Z",
  }],
  events: [{ type: "MANDATE_COMPLETED", actor: "verifier:test-runner", timestamp: "2026-09-13T00:01:00.000Z" }],
  requestId: "request-1",
};

describe("dashboard live record boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("minimizes a validated control-plane context for the client", () => {
    expect(parseLiveMandate(context)).toMatchObject({
      id: "M-live-1",
      status: "COMPLETED",
      principalId: "principal-1",
      allowedEffects: ["CODE_MODIFICATION"],
      includePaths: ["services/checkout/**"],
      execution: {
        id: "execution-1",
        actions: [{ id: "action-1", effectTypes: ["CODE_MODIFICATION"] }],
      },
      evidence: [{ id: "evidence-1", verified: true }],
    });
  });

  it("rejects malformed nested action resources", () => {
    const malformed = structuredClone(context) as Record<string, any>;
    malformed.execution.actions[0].effects[0].resources = [42];
    expect(() => parseLiveMandate(malformed)).toThrow("text expected");
  });

  it("rejects unknown lifecycle states instead of rendering them as in-scope", () => {
    const malformed = structuredClone(context) as Record<string, any>;
    malformed.mandate.status = "UNKNOWN";
    expect(() => parseLiveMandate(malformed)).toThrow("mandate status expected");
  });

  it("loads a live record without exposing the server credential", async () => {
    vi.stubEnv("MANDATE_CONTROL_PLANE_URL", "https://control.example/base");
    vi.stubEnv("MANDATE_DASHBOARD_CREDENTIAL", "server-secret");
    vi.stubEnv("MANDATE_DASHBOARD_MANDATE_ID", "M-live-1");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(context), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const source = await fetchDashboardSource();

    expect(source).toMatchObject({ kind: "live", mandate: { id: "M-live-1" } });
    expect(JSON.stringify(source)).not.toContain("server-secret");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://control.example/v1/mandates/M-live-1"),
      expect.objectContaining({ headers: { authorization: "Bearer server-secret" }, cache: "no-store", redirect: "error" }),
    );
  });

  it("fails closed before buffering an oversized response", async () => {
    vi.stubEnv("MANDATE_CONTROL_PLANE_URL", "https://control.example");
    vi.stubEnv("MANDATE_DASHBOARD_CREDENTIAL", "server-secret");
    vi.stubEnv("MANDATE_DASHBOARD_MANDATE_ID", "M-live-1");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x".repeat(1_048_577), { status: 200 })));

    await expect(fetchDashboardSource()).resolves.toEqual({ kind: "unavailable" });
  });
});
