import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { mandateStatuses, type MandateStatus } from "@mandate/protocol";
import { z } from "zod";
import {
  ControlPlaneError,
  type AuthenticatedIdentity,
  type ControlPlaneRepository,
} from "../control-plane/repository.js";

const MCP_PROTOCOL_VERSION = "2025-11-25";
const reference = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const action = z.object({
  status: z.string(),
  decision: z.enum(["ALLOW", "DENY", "ESCALATE", "INVALIDATE_APPROVAL"]),
  reasons: z.array(z.string()),
  violatedRules: z.array(z.string()),
  effects: z.array(z.object({ type: z.string() }).passthrough()),
}).passthrough();
const contextSchema = z.object({
  mandate: z.object({
    status: z.enum(mandateStatuses),
    goal: z.object({ statement: z.string() }).passthrough(),
    scope: z.object({
      resources: z.array(z.object({ kind: z.string(), resource: z.string() }).passthrough()),
    }).passthrough(),
    authority: z.object({
      allowedEffects: z.array(z.object({ type: z.string() }).passthrough()),
      forbiddenEffects: z.array(z.object({ type: z.string() }).passthrough()),
    }).passthrough(),
  }).passthrough(),
  versionDigest: digest,
  execution: z.object({
    finishedAt: z.string().nullable(),
    monetarySpentMicroUsd: z.number().int().nonnegative(),
    tokensUsed: z.number().int().nonnegative(),
    actions: z.array(action),
  }).passthrough().nullable(),
  evidence: z.array(z.object({ verified: z.boolean() }).passthrough()),
}).passthrough();

const statusOutput = z.object({
  success: z.literal(true),
  state: z.enum(mandateStatuses),
  summary: z.string(),
  nextStep: z.string(),
  outcome: z.string(),
  authority: z.object({
    resources: z.array(z.string()),
    allowedEffects: z.array(z.string()),
    forbiddenEffects: z.array(z.string()),
  }),
  execution: z.object({
    running: z.boolean(),
    actions: z.number().int().nonnegative(),
    tokensUsed: z.number().int().nonnegative(),
    monetarySpentMicroUsd: z.number().int().nonnegative(),
  }).nullable(),
  verification: z.object({
    records: z.number().int().nonnegative(),
    independentlyVerified: z.number().int().nonnegative(),
  }),
});
const explanationOutput = z.object({
  success: z.literal(true),
  blocked: z.boolean(),
  summary: z.string(),
  decision: z.enum(["DENY", "ESCALATE", "INVALIDATE_APPROVAL"]).nullable(),
  effects: z.array(z.string()),
  reasons: z.array(z.string()),
  nextStep: z.string(),
});

type McpRepository = Pick<ControlPlaneRepository, "authenticate" | "getMandateContext">;

export interface MandateMcpOptions {
  resourceUrl: string;
  authorizationServerUrl?: string;
  allowedOrigins?: string[];
}

function validateOptions(options: MandateMcpOptions): { resource: URL; authorizationServer?: URL; allowedOrigins: Set<string> } {
  const resource = new URL(options.resourceUrl);
  if (resource.protocol !== "https:" || resource.username || resource.password || resource.pathname !== "/mcp" || resource.search || resource.hash) {
    throw new Error("Mandate MCP resource URL must be an HTTPS /mcp URL without credentials or query data");
  }
  const authorizationServer = options.authorizationServerUrl ? new URL(options.authorizationServerUrl) : undefined;
  if (authorizationServer && (authorizationServer.protocol !== "https:" || authorizationServer.username || authorizationServer.password || authorizationServer.search || authorizationServer.hash)) {
    throw new Error("Mandate MCP authorization server URL must be HTTPS without credentials, query data, or a fragment");
  }
  const allowedOrigins = new Set(options.allowedOrigins ?? []);
  for (const origin of allowedOrigins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !["https:", "http:"].includes(parsed.protocol)) {
      throw new Error("Mandate MCP allowed origins must be exact HTTP(S) origins");
    }
  }
  return { resource, ...(authorizationServer ? { authorizationServer } : {}), allowedOrigins };
}

function bearerToken(request: Request): string {
  const match = /^Bearer ([A-Za-z0-9._~-]{32,512})$/.exec(request.headers.get("authorization") ?? "");
  if (!match) throw new ControlPlaneError(401, "UNAUTHENTICATED", "An access token is required");
  return match[1]!;
}

function identityFrom(extra: { authInfo?: { extra?: Record<string, unknown> } }): AuthenticatedIdentity | undefined {
  return extra.authInfo?.extra?.identity as AuthenticatedIdentity | undefined;
}

function customerError(error: unknown) {
  const text = error instanceof ControlPlaneError && error.status === 404
    ? "I couldn't find that work item. Check its reference and try again."
    : error instanceof ControlPlaneError && error.status === 403
      ? "That work item is not available to this account."
      : "Mandate couldn't retrieve that work item right now. Try again in a moment.";
  return { isError: true as const, content: [{ type: "text" as const, text }] };
}

function stateMessage(status: MandateStatus, hasExecution: boolean, latestActionBlocked: boolean): { summary: string; nextStep: string } {
  if (status === "DRAFT" || status === "PROPOSED" || status === "AWAITING_APPROVAL") {
    return {
      summary: "The requested work is waiting for human review. Nothing has executed.",
      nextStep: "Review the exact authority envelope before approving it.",
    };
  }
  if (status === "ACTIVE") {
    if (latestActionBlocked) {
      return {
        summary: "AgentOS stopped before executing its latest proposed action because Mandate blocked it.",
        nextStep: "AgentOS may replan inside the existing authority, or a human may review a separate amendment.",
      };
    }
    return hasExecution
      ? { summary: "AgentOS is working inside the approved authority.", nextStep: "Ask for status again later or review any requested action." }
      : { summary: "The authority is approved, but execution has not started.", nextStep: "Start the approved execution through the trusted operator flow." };
  }
  if (status === "SUSPENDED" || status === "AMENDMENT_PENDING") {
    return {
      summary: "Work is paused because the existing authority is no longer sufficient or valid.",
      nextStep: "Review the blocked action or proposed amendment. Authority cannot expand automatically.",
    };
  }
  if (status === "COMPLETED") {
    return { summary: "The outcome is complete and backed by independent verification.", nextStep: "Review the evidence record or begin a separate task." };
  }
  return {
    summary: `The work is ${status.toLowerCase()} and no further action will execute under this authority.`,
    nextStep: "Create a new bounded request if more work is needed.",
  };
}

function createServer(repository: McpRepository) {
  const server = new McpServer({ name: "mandate", version: "0.1.0" });
  server.registerTool("get_agent_work_status", {
    title: "Get governed agent work status",
    description: "Use when the customer asks whether previously delegated agent work is waiting, running, blocked, or independently verified. This tool is read-only and never starts or approves work.",
    inputSchema: { reference: reference.describe("The Mandate work reference previously returned to the customer") },
    outputSchema: statusOutput.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ reference: mandateId }, extra) => {
    const identity = identityFrom(extra);
    if (!identity || identity.kind !== "principal" || identity.principalType === "service") {
      return { isError: true, content: [{ type: "text", text: "Link a customer account before requesting private work status." }] };
    }
    try {
      const context = contextSchema.parse(await repository.getMandateContext(identity, mandateId));
      const latestAction = context.execution?.actions.at(-1);
      const latestActionBlocked = Boolean(latestAction && latestAction.decision !== "ALLOW");
      const message = stateMessage(context.mandate.status, context.execution !== null, latestActionBlocked);
      const result = {
        success: true as const,
        state: context.mandate.status,
        summary: message.summary,
        nextStep: message.nextStep,
        outcome: context.mandate.goal.statement,
        authority: {
          resources: context.mandate.scope.resources.map(({ resource }) => resource),
          allowedEffects: context.mandate.authority.allowedEffects.map(({ type }) => type),
          forbiddenEffects: context.mandate.authority.forbiddenEffects.map(({ type }) => type),
        },
        execution: context.execution ? {
          running: context.mandate.status === "ACTIVE" && context.execution.finishedAt === null && !latestActionBlocked,
          actions: context.execution.actions.length,
          tokensUsed: context.execution.tokensUsed,
          monetarySpentMicroUsd: context.execution.monetarySpentMicroUsd,
        } : null,
        verification: {
          records: context.evidence.length,
          independentlyVerified: context.evidence.filter(({ verified }) => verified).length,
        },
      };
      return { structuredContent: result, content: [{ type: "text", text: `${result.summary} ${result.nextStep}` }] };
    } catch (error) {
      return customerError(error);
    }
  });

  server.registerTool("explain_blocked_action", {
    title: "Explain a blocked agent action",
    description: "Use when the customer asks why governed agent work stopped or what AgentOS may do next. This tool reads the latest denied or escalated action and cannot change authority.",
    inputSchema: { reference: reference.describe("The Mandate work reference previously returned to the customer") },
    outputSchema: explanationOutput.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ reference: mandateId }, extra) => {
    const identity = identityFrom(extra);
    if (!identity || identity.kind !== "principal" || identity.principalType === "service") {
      return { isError: true, content: [{ type: "text", text: "Link a customer account before requesting private work details." }] };
    }
    try {
      const context = contextSchema.parse(await repository.getMandateContext(identity, mandateId));
      const blocked = [...(context.execution?.actions ?? [])].reverse().find(({ decision }) => decision !== "ALLOW");
      const result = blocked ? {
        success: true as const,
        blocked: true,
        summary: "Mandate stopped the proposed action before execution because it exceeded or could not be proven within the approved authority.",
        decision: blocked.decision as "DENY" | "ESCALATE" | "INVALIDATE_APPROVAL",
        effects: blocked.effects.map(({ type }) => type),
        reasons: blocked.reasons,
        nextStep: "AgentOS may replan inside the existing authority, or a human may review a separate amendment.",
      } : {
        success: true as const,
        blocked: false,
        summary: "No blocked action is recorded for this work item.",
        decision: null,
        effects: [],
        reasons: [],
        nextStep: "Ask for the current work status.",
      };
      return { structuredContent: result, content: [{ type: "text", text: `${result.summary} ${result.nextStep}` }] };
    } catch (error) {
      return customerError(error);
    }
  });
  return server;
}

function httpError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

function withCors(response: Response, origin: string | undefined): Response {
  if (!origin) return response;
  response.headers.set("access-control-allow-origin", origin);
  response.headers.append("vary", "Origin");
  return response;
}

async function parsedBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ControlPlaneError(415, "JSON_REQUIRED", "Content-Type must be application/json");
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 1_048_576) throw new ControlPlaneError(413, "BODY_TOO_LARGE", "Request body exceeds 1 MiB");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > 1_048_576) throw new ControlPlaneError(413, "BODY_TOO_LARGE", "Request body exceeds 1 MiB");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ControlPlaneError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
}

export function createMandateMcpHandler(repository: McpRepository, options: MandateMcpOptions): (request: Request) => Promise<Response> {
  const { resource, authorizationServer, allowedOrigins } = validateOptions(options);
  const protectedResourcePaths = new Set(["/.well-known/oauth-protected-resource/mcp", "/.well-known/oauth-protected-resource"]);
  return async (request) => {
    let corsOrigin: string | undefined;
    try {
      const url = new URL(request.url);
      const host = request.headers.get("host");
      if (host && host !== resource.host) return httpError(421, "host_not_allowed", "Request host is not allowed");
      if (protectedResourcePaths.has(url.pathname)) {
        if (request.method !== "GET") return httpError(405, "method_not_allowed", "Protected resource metadata is read-only");
        if (!authorizationServer) return httpError(503, "oauth_unavailable", "Alexa account linking is not configured");
        return new Response(JSON.stringify({
          resource: resource.href,
          authorization_servers: [authorizationServer.href],
          bearer_methods_supported: ["header"],
          scopes_supported: ["mcp:service", "mcp:tools", "mcp:resources"],
        }), {
          status: 200,
          headers: {
            "cache-control": "public, max-age=300",
            "content-type": "application/json; charset=utf-8",
            "x-content-type-options": "nosniff",
          },
        });
      }
      if (url.pathname !== "/mcp") return httpError(404, "not_found", "Route not found");
      const origin = request.headers.get("origin") ?? undefined;
      if (origin && !allowedOrigins.has(origin)) return httpError(403, "origin_not_allowed", "Request origin is not allowed");
      corsOrigin = origin;
      if (request.method === "OPTIONS") {
        const requestedMethod = request.headers.get("access-control-request-method");
        const requestedHeaders = (request.headers.get("access-control-request-headers") ?? "")
          .split(",")
          .map((header) => header.trim().toLowerCase())
          .filter(Boolean);
        const allowedHeaders = new Set(["authorization", "content-type", "mcp-protocol-version"]);
        if (!origin || requestedMethod !== "POST" || requestedHeaders.some((header) => !allowedHeaders.has(header))) {
          return withCors(httpError(403, "cors_preflight_denied", "CORS preflight is not allowed"), corsOrigin);
        }
        return withCors(new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-headers": [...allowedHeaders].join(", "),
            "access-control-allow-methods": "POST",
            "access-control-max-age": "300",
            "cache-control": "no-store",
          },
        }), corsOrigin);
      }
      if (request.method !== "POST") return withCors(httpError(405, "method_not_allowed", "This stateless MCP endpoint accepts POST requests"), corsOrigin);
      const token = bearerToken(request);
      const identity = await repository.authenticate(token);
      const parsed = await parsedBody(request);
      const messages = Array.isArray(parsed) ? parsed : [parsed];
      const initializeWithWrongVersion = messages.some((message) => {
        if (typeof message !== "object" || message === null || !("method" in message) || message.method !== "initialize") return false;
        if (!("params" in message) || typeof message.params !== "object" || message.params === null || !("protocolVersion" in message.params)) return true;
        return message.params.protocolVersion !== MCP_PROTOCOL_VERSION;
      });
      if (initializeWithWrongVersion) {
        return withCors(httpError(400, "protocol_version_not_supported", `Mandate MCP requires ${MCP_PROTOCOL_VERSION}`), corsOrigin);
      }
      const requiresVersion = messages.some((message) => (
        typeof message !== "object"
        || message === null
        || !("method" in message)
        || message.method !== "initialize"
      ));
      if (requiresVersion && request.headers.get("mcp-protocol-version") !== MCP_PROTOCOL_VERSION) {
        return withCors(httpError(400, "protocol_version_required", `MCP-Protocol-Version must be ${MCP_PROTOCOL_VERSION}`), corsOrigin);
      }
      const server = createServer(repository);
      const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
      await server.connect(transport);
      const response = await transport.handleRequest(request, {
        parsedBody: parsed,
        authInfo: {
          token,
          clientId: identity.id,
          scopes: identity.kind === "principal" && identity.principalType !== "service"
            ? ["mcp:service", "mcp:tools", "mcp:resources"]
            : ["mcp:service"],
          resource,
          extra: { identity },
        },
      });
      response.headers.set("cache-control", "no-store");
      response.headers.set("x-content-type-options", "nosniff");
      return withCors(response, corsOrigin);
    } catch (error) {
      if (error instanceof ControlPlaneError) return withCors(httpError(error.status, error.code.toLowerCase(), error.message), corsOrigin);
      return withCors(httpError(500, "internal_error", "Mandate MCP failed closed"), corsOrigin);
    }
  };
}
