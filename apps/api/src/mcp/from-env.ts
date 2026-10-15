import type { ControlPlaneRepository } from "../control-plane/repository.js";
import { createMandateMcpHandler } from "./handler.js";
import { createJwtMcpAuthenticator } from "./oauth.js";
import { createCheckoutWorkPreparer } from "./work-preparation.js";

type Env = Record<string, string | undefined>;

const list = (value: string | undefined) => (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);

/** Shared by the Lambda and the dedicated local server so both enforce the same configuration gates. */
export function createMandateMcpHandlerFromEnv(
  repository: ControlPlaneRepository,
  env: Env = process.env,
): ((request: Request) => Promise<Response>) | undefined {
  if (!env.MANDATE_MCP_RESOURCE_URL) return undefined;
  // Work preparation stays unregistered unless an immutable checkout commit is explicitly configured.
  const prepareWork = env.MANDATE_MCP_CHECKOUT_COMMIT_DIGEST
    ? createCheckoutWorkPreparer(repository, {
        subject: { agentId: "agentos-checkout", runtime: "agentos", instanceId: "run-001" },
        repositoryResource: "checkout-demo",
        repositoryCommitDigest: env.MANDATE_MCP_CHECKOUT_COMMIT_DIGEST as `sha256:${string}`,
        testVerifier: "verifier:test-runner",
        reviewVerifier: "verifier:independent-review",
      })
    : undefined;
  const oauthAuthorizationServer = env.MANDATE_MCP_AUTHORIZATION_SERVER_URL;
  const oauthJwksUrl = env.MANDATE_MCP_JWKS_URL;
  const oauthClientIds = list(env.MANDATE_MCP_OAUTH_CLIENT_IDS);
  const oauthConfigured = Boolean(oauthAuthorizationServer && oauthJwksUrl && oauthClientIds.length);
  if (!oauthConfigured && (oauthAuthorizationServer || oauthJwksUrl || oauthClientIds.length)) {
    return () => Promise.resolve(new Response(JSON.stringify({
      error: "oauth_configuration_incomplete",
      message: "Mandate MCP OAuth configuration is incomplete",
    }), {
      status: 503,
      headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" },
    }));
  }
  const authenticateToken = oauthConfigured
    ? createJwtMcpAuthenticator(repository, {
        authorizationServer: oauthAuthorizationServer!,
        jwksUrl: oauthJwksUrl!,
        resource: env.MANDATE_MCP_RESOURCE_URL,
        allowedClientIds: oauthClientIds,
      })
    : undefined;
  return createMandateMcpHandler(repository, {
    resourceUrl: env.MANDATE_MCP_RESOURCE_URL,
    ...(oauthAuthorizationServer ? { authorizationServerUrl: oauthAuthorizationServer } : {}),
    allowedOrigins: list(env.MANDATE_MCP_ALLOWED_ORIGINS),
    ...(prepareWork ? { prepareWork } : {}),
    ...(authenticateToken ? { authenticateToken } : {}),
  });
}
