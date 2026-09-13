import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const requiredTables = [
  "agents",
  "authorization_decisions",
  "criterion_results",
  "delegations",
  "evidence",
  "execution_actions",
  "execution_effects",
  "executions",
  "mandate_amendments",
  "mandate_approvals",
  "mandate_events",
  "mandate_schema_migrations",
  "mandate_versions",
  "mandates",
  "principals",
];

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
  console.log(`Verified ${requiredTables.length} Mandate tables`);
} finally {
  await client.end();
}
