import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export function createDatabase(connectionString = process.env.DATABASE_URL, maxConnections = 10) {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  if (!Number.isSafeInteger(maxConnections) || maxConnections < 1) throw new Error("maxConnections must be positive");
  const pool = new Pool({ connectionString, max: maxConnections });
  return { pool, db: drizzle(pool, { schema }), close: () => pool.end() };
}
