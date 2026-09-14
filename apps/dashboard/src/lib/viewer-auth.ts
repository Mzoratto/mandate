import { createHash, timingSafeEqual } from "node:crypto";

export function configuredViewerAuthorization(): string | undefined {
  const configured = process.env.MANDATE_DASHBOARD_BASIC_CREDENTIAL;
  if (!configured || !configured.includes(":")) return undefined;
  return `Basic ${Buffer.from(configured, "utf8").toString("base64")}`;
}

export function viewerAuthorizationMatches(authorization: string | null): boolean {
  const expectedAuthorization = configuredViewerAuthorization();
  if (!expectedAuthorization) return false;
  const supplied = createHash("sha256").update(authorization ?? "").digest();
  const expected = createHash("sha256").update(expectedAuthorization).digest();
  return timingSafeEqual(supplied, expected);
}
