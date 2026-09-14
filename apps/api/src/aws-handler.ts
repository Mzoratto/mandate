import { randomUUID } from "node:crypto";
import { createControlPlaneHandler } from "./control-plane/handler.js";
import { ControlPlaneRepository } from "./control-plane/repository.js";
import { createDatabase } from "./db/client.js";
import { createMandateMcpHandler } from "./mcp/handler.js";
import { createJwtMcpAuthenticator } from "./mcp/oauth.js";
import { createCheckoutWorkPreparer } from "./mcp/work-preparation.js";

interface FunctionUrlEvent {
  rawPath?: unknown;
  rawQueryString?: unknown;
  headers?: unknown;
  body?: unknown;
  isBase64Encoded?: unknown;
  requestContext?: {
    http?: { method?: unknown };
  };
}

interface LambdaContext {
  awsRequestId?: string;
}

let application: ((request: Request) => Promise<Response>) | undefined;

function app() {
  if (!application) {
    const database = createDatabase(process.env.DATABASE_URL, 2);
    const repository = new ControlPlaneRepository(database.pool);
    const controlPlane = createControlPlaneHandler(repository);
    const prepareWork = process.env.MANDATE_MCP_CHECKOUT_COMMIT_DIGEST
      ? createCheckoutWorkPreparer(repository, {
          subject: { agentId: "agentos-checkout", runtime: "agentos", instanceId: "run-001" },
          repositoryResource: "checkout-demo",
          repositoryCommitDigest: process.env.MANDATE_MCP_CHECKOUT_COMMIT_DIGEST as `sha256:${string}`,
          testVerifier: "verifier:test-runner",
          reviewVerifier: "verifier:independent-review",
        })
      : undefined;
    const oauthAuthorizationServer = process.env.MANDATE_MCP_AUTHORIZATION_SERVER_URL;
    const oauthJwksUrl = process.env.MANDATE_MCP_JWKS_URL;
    const oauthClientIds = (process.env.MANDATE_MCP_OAUTH_CLIENT_IDS ?? "")
      .split(",")
      .map((clientId) => clientId.trim())
      .filter(Boolean);
    const oauthPartiallyConfigured = Boolean(oauthAuthorizationServer || oauthJwksUrl || oauthClientIds.length)
      && !(oauthAuthorizationServer && oauthJwksUrl && oauthClientIds.length);
    const authenticateToken = oauthAuthorizationServer && oauthJwksUrl && oauthClientIds.length
      ? createJwtMcpAuthenticator(repository, {
          authorizationServer: oauthAuthorizationServer,
          jwksUrl: oauthJwksUrl,
          resource: process.env.MANDATE_MCP_RESOURCE_URL ?? "",
          allowedClientIds: oauthClientIds,
        })
      : undefined;
    const mcp = process.env.MANDATE_MCP_RESOURCE_URL
      ? oauthPartiallyConfigured
        ? () => Promise.resolve(new Response(JSON.stringify({
            error: "oauth_configuration_incomplete",
            message: "Mandate MCP OAuth configuration is incomplete",
          }), {
            status: 503,
            headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" },
          }))
        : createMandateMcpHandler(repository, {
          resourceUrl: process.env.MANDATE_MCP_RESOURCE_URL,
          ...(oauthAuthorizationServer ? { authorizationServerUrl: oauthAuthorizationServer } : {}),
          allowedOrigins: (process.env.MANDATE_MCP_ALLOWED_ORIGINS ?? "")
            .split(",")
            .map((origin) => origin.trim())
            .filter(Boolean),
          ...(prepareWork ? { prepareWork } : {}),
          ...(authenticateToken ? { authenticateToken } : {}),
        })
      : undefined;
    application = (request) => [
      "/mcp",
      "/.well-known/oauth-protected-resource/mcp",
      "/.well-known/oauth-protected-resource",
    ].includes(new URL(request.url).pathname)
      ? mcp
        ? mcp(request)
        : Promise.resolve(new Response(JSON.stringify({ error: "mcp_unavailable", message: "Mandate MCP is not configured" }), {
            status: 503,
            headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" },
          }))
      : controlPlane(request);
  }
  return application;
}

function invalidEvent(): never {
  throw new Error("Invalid Lambda Function URL event");
}

export function functionUrlRequest(event: FunctionUrlEvent): Request {
  const method = event.requestContext?.http?.method;
  const path = event.rawPath;
  const query = event.rawQueryString ?? "";
  if (
    typeof method !== "string"
    || typeof path !== "string"
    || !path.startsWith("/")
    || path.includes("\r")
    || path.includes("\n")
    || typeof query !== "string"
    || query.includes("#")
    || !event.headers
    || typeof event.headers !== "object"
    || Array.isArray(event.headers)
  ) invalidEvent();

  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers)) {
    if (typeof value === "string") headers.set(name, value);
  }
  const body = typeof event.body === "string"
    ? event.isBase64Encoded === true ? Buffer.from(event.body, "base64") : event.body
    : undefined;
  return new Request(`https://mandate.aws${path}${query ? `?${query}` : ""}`, {
    method,
    headers,
    ...(["GET", "HEAD"].includes(method.toUpperCase()) || body === undefined ? {} : { body }),
  });
}

export async function handler(event: FunctionUrlEvent, context: LambdaContext = {}) {
  try {
    const response = await app()(functionUrlRequest(event));
    if (!response.headers.has("x-request-id")) response.headers.set("x-request-id", randomUUID());
    const requestId = response.headers.get("x-request-id");
    console.info(JSON.stringify({
      component: "mandate-control-plane",
      awsRequestId: context.awsRequestId ?? null,
      requestId,
      status: response.status,
    }));
    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers),
      isBase64Encoded: false,
      body: await response.text(),
    };
  } catch {
    const requestId = randomUUID();
    console.error(JSON.stringify({
      component: "mandate-control-plane",
      awsRequestId: context.awsRequestId ?? null,
      requestId,
      status: 500,
      error: "lambda-adapter-failure",
    }));
    return {
      statusCode: 500,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
        "x-request-id": requestId,
      },
      isBase64Encoded: false,
      body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Request failed closed" }, requestId }),
    };
  }
}
