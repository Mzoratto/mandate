import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "../../apps/dashboard/src/proxy.js";

const request = (authorization?: string) => ({
  headers: new Headers(authorization ? { authorization } : {}),
}) as Parameters<typeof proxy>[0];

describe("dashboard viewer authentication", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps the public demo outside the authenticated operator routes", () => {
    expect(config.matcher).toEqual(["/dashboard/:path*", "/simulator/:path*"]);
  });

  it("fails closed when viewer authentication is not configured", () => {
    vi.stubEnv("MANDATE_DASHBOARD_MODE", "");
    vi.stubEnv("MANDATE_DASHBOARD_BASIC_CREDENTIAL", "");

    expect(proxy(request()).status).toBe(503);
  });

  it("challenges invalid credentials", () => {
    vi.stubEnv("MANDATE_DASHBOARD_MODE", "");
    vi.stubEnv("MANDATE_DASHBOARD_BASIC_CREDENTIAL", "operator:correct-horse");

    const result = proxy(request("Basic incorrect"));

    expect(result.status).toBe(401);
    expect(result.headers.get("www-authenticate")).toContain("Mandate Mission Control");
  });

  it("allows the exact credential and keeps the response private", () => {
    vi.stubEnv("MANDATE_DASHBOARD_MODE", "");
    vi.stubEnv("MANDATE_DASHBOARD_BASIC_CREDENTIAL", "operator:correct-horse");
    const authorization = `Basic ${Buffer.from("operator:correct-horse").toString("base64")}`;

    const result = proxy(request(authorization));

    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
  });
});
