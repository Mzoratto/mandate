import pg from "pg";

const [authorizationServerInput, subject, principalId] = process.argv.slice(2);
if (!process.env.DATABASE_URL || !authorizationServerInput || !subject || !principalId) {
  throw new Error("Usage: DATABASE_URL=... pnpm --filter @mandate/api oauth:link-subject -- <authorization-server> <subject> <principal-id>");
}
const authorizationServerUrl = new URL(authorizationServerInput);
if (
  authorizationServerUrl.protocol !== "https:"
  || authorizationServerUrl.username
  || authorizationServerUrl.password
  || authorizationServerUrl.search
  || authorizationServerUrl.hash
  || subject.length > 512
  || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u.test(principalId)
) {
  throw new Error("OAuth subject mapping input or authorization-server URL is invalid");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const principal = await client.query("SELECT id, type FROM principals WHERE id = $1 FOR UPDATE", [principalId]);
  if (!principal.rows[0]) throw new Error("Mandate principal does not exist");
  await client.query(
    `INSERT INTO oauth_subjects (authorization_server, subject, principal_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (authorization_server, subject) DO NOTHING`,
    [authorizationServerInput, subject, principalId],
  );
  const mapping = await client.query(
    "SELECT principal_id FROM oauth_subjects WHERE authorization_server = $1 AND subject = $2",
    [authorizationServerInput, subject],
  );
  if (mapping.rows[0]?.principal_id !== principalId) {
    throw new Error("OAuth subject is already linked to a different principal");
  }
  await client.query("COMMIT");
  console.log(JSON.stringify({ linked: true, authorizationServer: authorizationServerInput, principalId }));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
