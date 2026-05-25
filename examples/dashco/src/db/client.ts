/**
 * Database client.
 *
 * Default backend is PGLite — a real Postgres engine compiled to WASM, so
 * tests and `make day-one` run with no external service. To use a real
 * Postgres in production, swap the import in this file (drizzle-orm/postgres-js)
 * and pass a connection string. The schema, queries, and SQL are unchanged.
 *
 * Per the no-mocks rule: PGLite is not a mock. It is real Postgres.
 */

import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema.js";

export type Db = PgliteDatabase<typeof schema>;

export interface CreateDbOptions {
  /** Filesystem path for persistent storage. Omit for in-memory (tests). */
  dataDir?: string;
}

export interface DbHandle {
  db: Db;
  /** Underlying PGLite for raw migrations and shutdown. */
  pg: PGlite;
  close: () => Promise<void>;
}

export async function createDb(opts: CreateDbOptions = {}): Promise<DbHandle> {
  const pg = opts.dataDir ? new PGlite(opts.dataDir) : new PGlite();
  const db = drizzle(pg, { schema });
  await runMigrations(pg);
  return {
    db,
    pg,
    close: async () => {
      await pg.close();
    },
  };
}

/**
 * Idempotent CREATE TABLE / CREATE INDEX. Re-running is a no-op. Real
 * migrations would use drizzle-kit; this scaffold keeps it to one inline
 * statement so there's nothing extra to set up.
 */
async function runMigrations(pg: PGlite): Promise<void> {
  await pg.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      email TEXT,
      received_at TIMESTAMPTZ NOT NULL,
      classifier_rule TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tickets_received_at_idx ON tickets(received_at);
    CREATE INDEX IF NOT EXISTS tickets_category_idx ON tickets(category);
  `);
}
