import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const migrationsDirectory = fileURLToPath(new URL("../migrations/", import.meta.url));
const migrationNames = (await readdir(migrationsDirectory))
  .filter((name) => name.endsWith(".sql"))
  .sort();

const client = new Client({ connectionString });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS mandate_schema_migrations (
      name text PRIMARY KEY,
      digest text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const name of migrationNames) {
    const sql = await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8");
    const digest = createHash("sha256").update(sql).digest("hex");

    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('mandate_schema_migrations'))");
      const applied = await client.query(
        "SELECT digest FROM mandate_schema_migrations WHERE name = $1",
        [name],
      );

      if (applied.rowCount) {
        if (applied.rows[0].digest !== digest) {
          throw new Error(`Applied migration changed: ${name}`);
        }
      } else {
        await client.query(sql);
        await client.query(
          "INSERT INTO mandate_schema_migrations (name, digest) VALUES ($1, $2)",
          [name, digest],
        );
        console.log(`Applied ${name}`);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
