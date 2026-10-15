import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ControlPlaneRepository } from "../../apps/api/src/control-plane/repository.js";
import { createMandateMcpHandlerFromEnv } from "../../apps/api/src/mcp/from-env.js";
import { createMcpNodeListener, loopbackResource } from "../../apps/api/src/mcp/server.js";

const token = `mandate_${"a".repeat(32)}`;
const repository = {
  authenticate: vi.fn(async () => ({ kind: "principal", id: "agentos-operator", principalType: "human" })),
} as unknown as ControlPlaneRepository;
let server: Server | undefined;

afterEach(() => new Promise<void>((resolve) => server ? server.close(() => resolve()) : resolve()));

// Plain HTTP stands in for TLS here: the listener under test is transport-agnostic.
async function serve(env: Record<string, string> = {}) {
  let listener: ReturnType<typeof createMcpNodeListener> = () => undefined;
  server = createServer((request, response) => listener(request, response));
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const resource = loopbackResource(`https://127.0.0.1:${port}/mcp`);
  listener = createMcpNodeListener(createMandateMcpHandlerFromEnv(repository, { MANDATE_MCP_RESOURCE_URL: resource.href, ...env })!, resource);
  return (path: string, body: unknown, headers: Record<string, string> = {}) => fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "mcp-protocol-version": "2025-11-25",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const listTools = { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };

describe("dedicated Mandate MCP server", () => {
  it("accepts only literal loopback HTTPS resource URLs", () => {
    for (const url of ["https://mandate.example:3001/mcp", "https://localhost:3001/mcp", "http://127.0.0.1:3001/mcp", "https://127.0.0.1/mcp", undefined]) {
      expect(() => loopbackResource(url)).toThrow();
    }
    expect(loopbackResource("https://[::1]:3001/mcp").port).toBe("3001");
  });

  it("serves MCP over a real socket with work preparation off by default", async () => {
    const post = await serve();
    const initialized = await post("/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "agentos", version: "1.0.0" } },
    });
    expect(initialized.status).toBe(200);
    expect((await initialized.json()).result.protocolVersion).toBe("2025-11-25");
    const tools = (await (await post("/mcp", listTools)).json()).result.tools.map(({ name }: { name: string }) => name);
    expect(tools.sort()).toEqual(["explain_blocked_action", "get_agent_work_status"]);
  });

  it("registers work preparation only when explicitly enabled", async () => {
    const post = await serve({ MANDATE_MCP_CHECKOUT_COMMIT_DIGEST: `sha256:${"c".repeat(64)}` });
    const tools = (await (await post("/mcp", listTools)).json()).result.tools.map(({ name }: { name: string }) => name);
    expect(tools).toContain("prepare_agent_work");
  });

  it("exposes no control-plane routes and caps request bodies", async () => {
    const post = await serve();
    expect((await post("/v1/mandates", {})).status).toBe(404);
    expect((await post("/mcp", "x".repeat(1_048_577))).status).toBe(413);
  });
});
