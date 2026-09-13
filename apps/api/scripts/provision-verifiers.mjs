import pg from "pg";
import { hashCredential } from "../src/control-plane/repository.ts";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const verifiers = [
  { id: "verifier:test-runner", credentialId: "credential-verifier-test-runner", token: required("MANDATE_TEST_VERIFIER_TOKEN") },
  { id: "verifier:independent-review", credentialId: "credential-verifier-independent-review", token: required("MANDATE_REVIEW_VERIFIER_TOKEN") },
];
const pool = new pg.Pool({ connectionString: required("DATABASE_URL"), max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const verifier of verifiers) {
    await client.query(
      `INSERT INTO principals (id, type)
       VALUES ($1, 'service')
       ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type`,
      [verifier.id],
    );
    await client.query(
      `INSERT INTO control_plane_credentials (id, token_hash, principal_id, revoked_at)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT (id) DO UPDATE
         SET token_hash = EXCLUDED.token_hash,
             principal_id = EXCLUDED.principal_id,
             agent_id = NULL,
             revoked_at = NULL`,
      [verifier.credentialId, hashCredential(verifier.token), verifier.id],
    );
  }
  await client.query("COMMIT");
  console.log(JSON.stringify({ verifiers: verifiers.map(({ id }) => id) }));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
