import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import { ControlPlaneError, type AuthenticatedIdentity, type ControlPlaneRepository } from "../control-plane/repository.js";

export interface McpAuthentication {
  identity: AuthenticatedIdentity;
  scopes: string[];
}

export interface JwtMcpAuthenticationConfig {
  authorizationServer: string;
  jwksUrl: string;
  resource: string;
  allowedClientIds: string[];
  algorithms?: string[];
  maxTokenLifetimeSeconds?: number;
}

function secureUrl(value: string, label: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must be an HTTPS URL without credentials, query data, or a fragment`);
  }
  return url;
}

export function createJwtMcpAuthenticator(
  repository: Pick<ControlPlaneRepository, "resolveOAuthSubject">,
  config: JwtMcpAuthenticationConfig,
  dependencies: { keyResolver?: JWTVerifyGetKey } = {},
): (token: string) => Promise<McpAuthentication> {
  secureUrl(config.authorizationServer, "OAuth authorization server");
  const authorizationServer = config.authorizationServer;
  const jwksUrl = secureUrl(config.jwksUrl, "OAuth JWKS endpoint");
  const resource = config.resource;
  secureUrl(resource, "OAuth resource");
  if (new URL(resource).pathname !== "/mcp") throw new Error("OAuth resource must identify the /mcp endpoint");
  const allowedClientIds = new Set(config.allowedClientIds);
  if (!allowedClientIds.size || [...allowedClientIds].some((clientId) => !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(clientId))) {
    throw new Error("OAuth allowed client IDs are invalid");
  }
  const algorithms = config.algorithms ?? ["RS256", "ES256"];
  if (!algorithms.length || algorithms.some((algorithm) => !["RS256", "ES256"].includes(algorithm))) {
    throw new Error("OAuth JWT algorithms must be an explicit RS256/ES256 allowlist");
  }
  const maxTokenLifetimeSeconds = config.maxTokenLifetimeSeconds ?? 3600;
  if (!Number.isSafeInteger(maxTokenLifetimeSeconds) || maxTokenLifetimeSeconds < 60 || maxTokenLifetimeSeconds > 3600) {
    throw new Error("OAuth token lifetime bound is invalid");
  }
  const keyResolver = dependencies.keyResolver ?? createRemoteJWKSet(jwksUrl, {
    cooldownDuration: 30_000,
    timeoutDuration: 5_000,
  });

  return async (token) => {
    try {
      const verified = await jwtVerify(token, keyResolver, {
        algorithms,
        issuer: authorizationServer,
        audience: resource,
        clockTolerance: 5,
      });
      const claims = verified.payload;
      if (
        typeof claims.sub !== "string"
        || !claims.sub
        || typeof claims.iat !== "number"
        || typeof claims.exp !== "number"
        || claims.iat > Math.floor(Date.now() / 1000) + 5
        || claims.exp <= claims.iat
        || claims.exp - claims.iat > maxTokenLifetimeSeconds
        || (claims.token_use !== undefined && claims.token_use !== "access")
      ) {
        throw new Error("OAuth access token claims are invalid");
      }
      const clientId = typeof claims.client_id === "string"
        ? claims.client_id
        : typeof claims.azp === "string" ? claims.azp : undefined;
      if (!clientId || !allowedClientIds.has(clientId)) throw new Error("OAuth access token client is not allowed");
      if (typeof claims.scope !== "string") throw new Error("OAuth access token scope is unavailable");
      const scopes = [...new Set(claims.scope.split(/\s+/u).filter(Boolean))];
      const identity = await repository.resolveOAuthSubject(authorizationServer, claims.sub);
      if (identity.principalType === "service") {
        if (scopes.length !== 1 || scopes[0] !== "mcp:service") {
          throw new Error("OAuth service token has customer authority");
        }
      } else if (scopes.includes("mcp:service") || !scopes.includes("mcp:tools") || !scopes.includes("mcp:resources")) {
        throw new Error("OAuth customer token scope is invalid");
      }
      return { identity, scopes };
    } catch (error) {
      if (error instanceof ControlPlaneError) throw error;
      throw new ControlPlaneError(401, "UNAUTHENTICATED", "OAuth access token is invalid");
    }
  };
}
