import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AuthenticatedIdentity } from "../../apps/api/src/control-plane/repository.js";
import { createJwtMcpAuthenticator } from "../../apps/api/src/mcp/oauth.js";

const issuer = "https://auth.example";
const resource = "https://mandate.example/mcp";
const now = Math.floor(Date.now() / 1000);
let privateKey: CryptoKey;
let keyResolver: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  keyResolver = createLocalJWKSet({ keys: [{ ...jwk, kid: "test-key", alg: "RS256", use: "sig" }] });
});

async function token(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    scope: "mcp:tools mcp:resources",
    client_id: "alexa-user-client",
    token_use: "access",
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key", typ: "at+jwt" })
    .setIssuer(issuer)
    .setSubject("amazon-user-123")
    .setAudience(resource)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);
}

function authenticator(identity: AuthenticatedIdentity) {
  if (identity.kind !== "principal") throw new Error("test identity must be a principal");
  const repository = { resolveOAuthSubject: vi.fn(async () => identity) };
  return {
    repository,
    authenticate: createJwtMcpAuthenticator(repository, {
      authorizationServer: issuer,
      jwksUrl: "https://auth.example/.well-known/jwks.json",
      resource,
      allowedClientIds: ["alexa-service-client", "alexa-user-client"],
    }, { keyResolver }),
  };
}

describe("Alexa OAuth access-token validation", () => {
  it("accepts a resource-bound customer token and resolves its server-side principal", async () => {
    const { authenticate, repository } = authenticator({ kind: "principal", id: "principal-1", principalType: "human" });
    await expect(authenticate(await token())).resolves.toEqual({
      identity: { kind: "principal", id: "principal-1", principalType: "human" },
      scopes: ["mcp:tools", "mcp:resources"],
    });
    expect(repository.resolveOAuthSubject).toHaveBeenCalledWith(issuer, "amazon-user-123");
  });

  it("accepts only the service scope for a service principal", async () => {
    const { authenticate } = authenticator({ kind: "principal", id: "alexa-service", principalType: "service" });
    await expect(authenticate(await token({ scope: "mcp:service", client_id: "alexa-service-client" }))).resolves.toMatchObject({
      scopes: ["mcp:service"],
    });
    await expect(authenticate(await token({ scope: "mcp:service mcp:tools", client_id: "alexa-service-client" })))
      .rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
  });

  it("rejects the wrong RFC 8707 resource and unregistered clients", async () => {
    const { authenticate } = authenticator({ kind: "principal", id: "principal-1", principalType: "human" });
    const wrongAudience = await new SignJWT({ scope: "mcp:tools mcp:resources", client_id: "alexa-user-client" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer)
      .setSubject("amazon-user-123")
      .setAudience("https://other.example/mcp")
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);
    await expect(authenticate(wrongAudience)).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    await expect(authenticate(await token({ client_id: "unknown-client" })))
      .rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
  });

  it("rejects customer tokens with service authority or lifetimes over one hour", async () => {
    const { authenticate } = authenticator({ kind: "principal", id: "principal-1", principalType: "human" });
    await expect(authenticate(await token({ scope: "mcp:service mcp:tools mcp:resources" })))
      .rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    const longLived = await new SignJWT({ scope: "mcp:tools mcp:resources", client_id: "alexa-user-client" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer)
      .setSubject("amazon-user-123")
      .setAudience(resource)
      .setIssuedAt(now)
      .setExpirationTime(now + 3601)
      .sign(privateKey);
    await expect(authenticate(longLived)).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
  });
});
