import { describe, expect, it, vi } from "vitest";
import { createMandateMcpHandler } from "../../apps/api/src/mcp/handler.js";
import type { AuthenticatedIdentity } from "../../apps/api/src/control-plane/repository.js";

const token = `mandate_${"a".repeat(32)}`;
const principal: AuthenticatedIdentity = { kind: "principal", id: "alexa-user-001", principalType: "human" };
const context = {
  mandate: {
    status: "COMPLETED",
    goal: { statement: "Restore the checkout test suite." },
    scope: { resources: [{ kind: "repository", resource: "checkout-demo" }] },
    authority: {
      allowedEffects: [{ type: "CODE_MODIFICATION" }, { type: "TEST_MODIFICATION" }],
      forbiddenEffects: [{ type: "DATABASE_SCHEMA_MUTATION" }, { type: "PRODUCTION_DEPLOYMENT" }],
    },
  },
  versionDigest: `sha256:${"b".repeat(64)}`,
  execution: {
    finishedAt: "2026-09-14T00:00:00.000Z",
    monetarySpentMicroUsd: 0,
    tokensUsed: 0,
    actions: [{
      status: "EXECUTED",
      decision: "ALLOW",
      reasons: ["Within authority"],
      violatedRules: [],
      effects: [{ type: "CODE_MODIFICATION" }],
    }],
  },
  evidence: [{ verified: true }, { verified: true }, { verified: false }],
};

function repository(identity: AuthenticatedIdentity = principal, record: Record<string, unknown> = context) {
  return {
    authenticate: vi.fn(async () => identity),
    getMandateContext: vi.fn(async () => record),
  };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://mandate.example/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      host: "mandate.example",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "mandate-test", version: "1.0.0" },
  },
};

function handler(repo = repository(), allowedOrigins: string[] = [], authorizationServerUrl?: string) {
  return createMandateMcpHandler(repo, {
    resourceUrl: "https://mandate.example/mcp",
    allowedOrigins,
    ...(authorizationServerUrl ? { authorizationServerUrl } : {}),
  });
}

async function json(response: Response) {
  return JSON.parse(await response.text()) as Record<string, any>;
}

describe("Alexa-compatible Mandate MCP transport", () => {
  it("negotiates MCP 2025-11-25 over stateless Streamable HTTP", async () => {
    const response = await handler()(request(initialize));
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.result.protocolVersion).toBe("2025-11-25");
    expect(body.result.serverInfo.name).toBe("mandate");
  });

  it("rejects an initialization protocol other than Alexa's required version", async () => {
    const incompatible = structuredClone(initialize);
    incompatible.params.protocolVersion = "2025-06-18";
    const response = await handler()(request(incompatible));
    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toEqual({
      error: "protocol_version_not_supported",
      message: "Mandate MCP requires 2025-11-25",
    });
  });

  it("requires the exact Alexa MCP version after initialization", async () => {
    const response = await handler()(request({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }));
    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toEqual({
      error: "protocol_version_required",
      message: "MCP-Protocol-Version must be 2025-11-25",
    });
  });

  it("advertises only read-only customer intents", async () => {
    const response = await handler()(request({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, {
      "mcp-protocol-version": "2025-11-25",
    }));
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "get_agent_work_status",
      "explain_blocked_action",
    ]);
    expect(body.result.tools.every((tool: { annotations?: { readOnlyHint?: boolean } }) => tool.annotations?.readOnlyHint)).toBe(true);
  });

  it("returns a minimized independently verified work status", async () => {
    const repo = repository();
    const response = await handler(repo)(request({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_agent_work_status", arguments: { reference: "M-checkout-live-003" } },
    }, { "mcp-protocol-version": "2025-11-25" }));
    const body = await json(response);
    expect(body.result.structuredContent).toMatchObject({
      success: true,
      state: "COMPLETED",
      authority: { resources: ["checkout-demo"] },
      execution: { running: false, actions: 1, tokensUsed: 0 },
      verification: { records: 3, independentlyVerified: 2 },
    });
    expect(body.result.content[0].text).not.toContain("M-checkout-live-003");
    expect(repo.getMandateContext).toHaveBeenCalledWith(principal, "M-checkout-live-003");
  });

  it("reports an active execution with a latest denied action as blocked, not running", async () => {
    const blocked = structuredClone(context) as Record<string, any>;
    blocked.mandate.status = "ACTIVE";
    blocked.execution.finishedAt = null;
    blocked.execution.actions.push({
      status: "DENY",
      decision: "DENY",
      reasons: ["Production deployment is forbidden"],
      violatedRules: ["forbid-wins"],
      effects: [{ type: "PRODUCTION_DEPLOYMENT" }],
    });
    const response = await handler(repository(principal, blocked))(request({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "get_agent_work_status", arguments: { reference: "M-checkout-live-003" } },
    }, { "mcp-protocol-version": "2025-11-25" }));
    const status = (await json(response)).result.structuredContent;
    expect(status.execution.running).toBe(false);
    expect(status.summary).toContain("stopped");
  });

  it("does not report a suspended unfinished execution as running", async () => {
    const suspended = structuredClone(context);
    suspended.mandate.status = "SUSPENDED";
    const response = await handler(repository(principal, suspended))(request({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "get_agent_work_status", arguments: { reference: "M-checkout-live-003" } },
    }, { "mcp-protocol-version": "2025-11-25" }));
    expect((await json(response)).result.structuredContent.execution.running).toBe(false);
  });

  it("does not treat a service credential as customer authority", async () => {
    const repo = repository({ kind: "principal", id: "alexa-service", principalType: "service" });
    const response = await handler(repo)(request({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "get_agent_work_status", arguments: { reference: "M-checkout-live-003" } },
    }, { "mcp-protocol-version": "2025-11-25" }));
    const body = await json(response);
    expect(body.result.isError).toBe(true);
    expect(repo.getMandateContext).not.toHaveBeenCalled();
  });

  it("publishes Alexa protected-resource metadata only when OAuth is configured", async () => {
    const metadataRequest = new Request("https://mandate.example/.well-known/oauth-protected-resource/mcp", { headers: { host: "mandate.example" } });
    expect((await handler()(metadataRequest)).status).toBe(503);
    const response = await handler(repository(), [], "https://auth.mandate.example")(metadataRequest);
    expect(response.status).toBe(200);
    await expect(json(response)).resolves.toEqual({
      resource: "https://mandate.example/mcp",
      authorization_servers: ["https://auth.mandate.example/"],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp:service", "mcp:tools", "mcp:resources"],
    });
  });

  it("fails closed for missing credentials without a WWW-Authenticate header", async () => {
    const unauthenticated = request(initialize);
    unauthenticated.headers.delete("authorization");
    const response = await handler()(unauthenticated);
    expect(response.status).toBe(401);
    expect(response.headers.has("www-authenticate")).toBe(false);
  });

  it("supports bounded CORS preflight and responses for an allowed browser origin", async () => {
    const origin = "https://alexa.amazon.com";
    const mcp = handler(repository(), [origin]);
    const preflight = await mcp(new Request("https://mandate.example/mcp", {
      method: "OPTIONS",
      headers: {
        host: "mandate.example",
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization, content-type, mcp-protocol-version",
      },
    }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(origin);
    const response = await mcp(request(initialize, { origin }));
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(response.headers.get("vary")).toContain("Origin");
  });

  it("rejects untrusted origins and hosts before authentication", async () => {
    const repo = repository();
    const blockedOrigin = await handler(repo, ["https://alexa.amazon.com"])(request(initialize, { origin: "https://evil.example" }));
    expect(blockedOrigin.status).toBe(403);
    const blockedHost = await handler(repo)(request(initialize, { host: "evil.example" }));
    expect(blockedHost.status).toBe(421);
    expect(repo.authenticate).not.toHaveBeenCalled();
  });

  it("rejects unsupported methods and oversized payloads", async () => {
    const get = new Request("https://mandate.example/mcp", { method: "GET", headers: { host: "mandate.example" } });
    expect((await handler()(get)).status).toBe(405);
    const oversized = request(initialize, { "content-length": "1048577" });
    expect((await handler()(oversized)).status).toBe(413);
  });
});
