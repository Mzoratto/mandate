import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const requiredTables = [
  "agents",
  "authorization_decisions",
  "control_plane_credentials",
  "criterion_results",
  "delegations",
  "evidence",
  "execution_actions",
  "execution_effects",
  "executions",
  "mandate_amendments",
  "mandate_approvals",
  "mandate_assumption_state",
  "mandate_events",
  "mandate_schema_migrations",
  "mandate_versions",
  "mandates",
  "principals",
];

const requiredColumns = {
  authorization_decisions: ["amendment_suggested"],
  control_plane_credentials: ["token_hash", "principal_id", "agent_id", "expires_at", "revoked_at"],
  evidence: ["execution_action_id"],
  execution_actions: ["request_digest", "settlement_digest"],
  mandate_assumption_state: ["key", "value_hash", "invalidates_on_change", "source"],
  mandate_events: ["sequence"],
};

const client = new Client({ connectionString });
await client.connect();

try {
  const result = await client.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [requiredTables],
  );
  const present = new Set(result.rows.map(({ table_name }) => table_name));
  const missing = requiredTables.filter((table) => !present.has(table));
  if (missing.length) throw new Error(`Missing tables: ${missing.join(", ")}`);

  const columns = await client.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [Object.keys(requiredColumns)],
  );
  const presentColumns = new Set(columns.rows.map(({ table_name, column_name }) => `${table_name}.${column_name}`));
  const missingColumns = Object.entries(requiredColumns).flatMap(([table, names]) =>
    names.filter((name) => !presentColumns.has(`${table}.${name}`)).map((name) => `${table}.${name}`),
  );
  if (missingColumns.length) throw new Error(`Missing columns: ${missingColumns.join(", ")}`);
  console.log(`Verified ${requiredTables.length} Mandate tables and authenticated control-plane columns`);
} finally {
  await client.end();
}
