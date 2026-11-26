import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

let cachedPool: Pool | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Returns true when DATABASE_URL is configured in the environment.
 */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Returns a lazily initialized Postgres pool using DATABASE_URL.
 */
export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required.');
  }
  if (!cachedPool) {
    cachedPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return cachedPool;
}

function resolveMigrationsDir(): string {
  return path.resolve(process.cwd(), 'migrations');
}

/**
 * Applies pending timestamped SQL migrations from `migrations/` using a direct (unpooled) connection when available.
 */
export async function initDb(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required.');
  }

  const migrationPool = new Pool({
    connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  });

  try {
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = resolveMigrationsDir();
    if (!fs.existsSync(migrationsDir)) {
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const appliedRes = await migrationPool.query('SELECT filename FROM schema_migrations');
    const applied = new Set(appliedRes.rows.map((r) => String(r.filename)));

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const client = await migrationPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  } finally {
    await migrationPool.end();
  }
}

/**
 * Ensures database migrations are initialized once per process, resetting on failure so cold starts can retry.
 */
export function ensureDbInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initDb().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}
