import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAgentWorkStatus,
  parseAgentWorkStatus,
  parsePreparedWork,
  prepareAgentWork,
} from "../../apps/dashboard/src/lib/mandate/mcp-client.js";

const prepared = {
  reference: "M-alexa-0123456789abcdef012345",
  state: "AWAITING_APPROVAL",
  summary: "I prepared a bounded checkout repair mandate. Nothing has executed.",
  nextStep: "Review the exact authority envelope before approving it.",
};

const status = {
  success: true,
  state: "AWAITING_APPROVAL",
  summary: "The requested work is waiting for human review. Nothing has executed.",
  nextStep: "Review the exact authority envelope before approving it.",
  outcome: "Restore correct coupon totals in the checkout test suite.",
  authority: {
    resources: ["checkout-demo"],
    allowedEffects: ["CODE_READ", "CODE_MODIFICATION"],
    forbiddenEffects: ["PRODUCTION_DEPLOYMENT"],
  },
  execution: null,
  verification: { records: 0, independentlyVerified: 0 },
};

function mcpResponse(structuredContent: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: "response-1", result: { structuredContent } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("dashboard simulated Alexa MCP client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("validates bounded preparation and status outputs", () => {
    expect(parsePreparedWork(prepared)).toEqual(prepared);
    expect(parseAgentWorkStatus(status)).toMatchObject({
      state: "AWAITING_APPROVAL",
      authority: { resources: ["checkout-demo"] },
      execution: null,
      verification: { records: 0, independentlyVerified: 0 },
    });
  });

  it("rejects malformed or impossible MCP output", () => {
    expect(() => parsePreparedWork({ ...prepared, state: "ACTIVE" })).toThrow("prepared work expected");
    expect(() => parseAgentWorkStatus({ ...status, verification: { records: 0, independentlyVerified: 1 } })).toThrow("verification count expected");
  });

  it("calls the real MCP tool server-side without returning the credential", async () => {
    vi.stubEnv("MANDATE_CONTROL_PLANE_URL", "https://control.example/base");
    vi.stubEnv("MANDATE_DASHBOARD_CREDENTIAL", "server-only-secret");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => mcpResponse(prepared));
    vi.stubGlobal("fetch", fetchMock);

    const result = await prepareAgentWork("Restore correct coupon totals in checkout.", "sim-request-001");

    expect(result.reference).toBe(prepared.reference);
    expect(JSON.stringify(result)).not.toContain("server-only-secret");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toEqual(new URL("https://control.example/mcp"));
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      redirect: "error",
      headers: {
        authorization: "Bearer server-only-secret",
        "mcp-protocol-version": "2025-11-25",
      },
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      method: "tools/call",
      params: {
        name: "prepare_agent_work",
        arguments: { outcome: "Restore correct coupon totals in checkout.", requestKey: "sim-request-001" },
      },
    });
  });

  it("reads status through the same authenticated MCP boundary", async () => {
    vi.stubEnv("MANDATE_CONTROL_PLANE_URL", "https://control.example/");
    vi.stubEnv("MANDATE_DASHBOARD_CREDENTIAL", "server-only-secret");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => mcpResponse(status));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAgentWorkStatus(prepared.reference)).resolves.toMatchObject({ state: "AWAITING_APPROVAL" });
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toMatchObject({
      params: { name: "get_agent_work_status", arguments: { reference: prepared.reference } },
    });
  });

  it("fails closed when the server credential is unavailable", async () => {
    vi.stubEnv("MANDATE_CONTROL_PLANE_URL", "https://control.example/");
    vi.stubEnv("MANDATE_DASHBOARD_CREDENTIAL", "");
    await expect(getAgentWorkStatus(prepared.reference)).rejects.toThrow("MCP client is unavailable");
  });
});
