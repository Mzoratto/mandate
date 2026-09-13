import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const { Client } = pg;
const [kind, identityId, expiresAt] = process.argv.slice(2);
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
if (!(["principal", "agent"].includes(kind) && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(identityId ?? ""))) {
  throw new Error("Usage: create-credential.mjs <principal|agent> <identity-id> [expires-at]");
}
if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || new Date(expiresAt).toISOString() !== expiresAt)) {
  throw new Error("expires-at must be an ISO UTC timestamp");
}

const token = `mandate_${randomBytes(32).toString("base64url")}`;
const tokenHash = `sha256:${createHash("sha256").update(token).digest("hex")}`;
const credentialId = `credential-${randomUUID()}`;
const client = new Client({ connectionString });
await client.connect();
try {
  await client.query(
    `INSERT INTO control_plane_credentials
      (id, token_hash, principal_id, agent_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      credentialId,
      tokenHash,
      kind === "principal" ? identityId : null,
      kind === "agent" ? identityId : null,
      expiresAt ?? null,
    ],
  );
  process.stdout.write(`${JSON.stringify({ credentialId, kind, identityId, token, expiresAt: expiresAt ?? null })}\n`);
} finally {
  await client.end();
}
