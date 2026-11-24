import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { Pool, type QueryResultRow } from "pg";

type Database = Pool | DatabaseSync;
const shared = globalThis as typeof globalThis & {
  vibeDatabase?: Database;
  vibeDatabaseReady?: Promise<void>;
};

export const dataDirectory = () => resolve(process.env.VIBEBOARD_DATA_DIR || ".vibeboard");

export function getDatabase(): Database {
  if (shared.vibeDatabase) return shared.vibeDatabase;

  if (process.env.DATABASE_URL) {
    return (shared.vibeDatabase = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    }));
  }

  mkdirSync(dataDirectory(), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(resolve(dataDirectory(), "workspace.sqlite"));
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  return (shared.vibeDatabase = db);
}

const tables = `
  CREATE TABLE IF NOT EXISTS workspaces (
    user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL,
    username TEXT UNIQUE,
    visibility TEXT NOT NULL DEFAULT 'private'
  );
  CREATE TABLE IF NOT EXISTS billing_customers (
    user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS billing_subscriptions (
    subscription_id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES billing_customers(customer_id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    event_time BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS billing_customer_idx ON billing_subscriptions(customer_id);
  CREATE TABLE IF NOT EXISTS service_limits (
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    bucket BIGINT NOT NULL,
    uses INTEGER NOT NULL,
    PRIMARY KEY (user_id, service)
  );
`;

async function initialize(migrateAuth: () => Promise<void>) {
  const db = getDatabase();
  if (db instanceof DatabaseSync) {
    db.exec("BEGIN IMMEDIATE");
    try {
      await migrateAuth();
      db.exec(tables);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return;
  }

  const lock = await db.connect();
  try {
    await lock.query("BEGIN");
    await lock.query("SELECT pg_advisory_xact_lock(1272617304)");
    await migrateAuth();
    await lock.query(tables);
    await lock.query("COMMIT");
  } catch (error) {
    await lock.query("ROLLBACK");
    throw error;
  } finally {
    lock.release();
  }
}

export function prepareDatabase(migrateAuth: () => Promise<void>) {
  shared.vibeDatabaseReady ??= initialize(migrateAuth).catch((error) => {
    delete shared.vibeDatabaseReady;
    throw error;
  });
  return shared.vibeDatabaseReady;
}

export async function query<Row extends QueryResultRow>(sql: string, values: SQLInputValue[] = []) {
  const db = getDatabase();
  if (db instanceof DatabaseSync) {
    // Our statements use PostgreSQL-style positional parameters in both backends.
    const bound: SQLInputValue[] = [];
    const statement = sql.replace(/\$(\d+)/g, (_, index: string) => {
      bound.push(values[Number(index) - 1]);
      return "?";
    });
    return db.prepare(statement).all(...bound) as Row[];
  }
  return (await db.query<Row>(sql, values)).rows;
}

export async function consumeServiceQuota(userId: string, service: string, limit: number): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 3_600_000);
  const rows = await query<{ uses: number }>(`
    INSERT INTO service_limits (user_id, service, bucket, uses) VALUES ($1, $2, $3, 1)
    ON CONFLICT (user_id, service) DO UPDATE SET
      bucket = excluded.bucket,
      uses = CASE WHEN service_limits.bucket = excluded.bucket THEN service_limits.uses + 1 ELSE 1 END
    WHERE service_limits.bucket < excluded.bucket OR
      (service_limits.bucket = excluded.bucket AND service_limits.uses < $4)
    RETURNING uses
  `, [userId, service, bucket, limit]);
  return rows.length > 0;
}
