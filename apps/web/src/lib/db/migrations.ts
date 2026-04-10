/**
 * Idempotent migration system for the wa-sqlite database.
 *
 * Tracks applied schema versions in a `_migrations` table and runs
 * outstanding migrations in order, skipping any that have already been
 * applied.
 */

import { SCHEMA_V1_STATEMENTS, SCHEMA_V2_STATEMENTS } from './schema.js';
import type { DbExecutor } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single migration definition. */
export interface Migration {
  /** Monotonically increasing version identifier. */
  version: number;
  /** Human-readable label for logging / debugging. */
  label: string;
  /** SQL statements to execute for this migration. */
  statements: readonly string[];
}

// ---------------------------------------------------------------------------
// Migration registry
// ---------------------------------------------------------------------------

/** All known migrations, ordered by version. */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    label: 'Initial schema — playlists, tracks, playlist_tracks, recent_plays',
    statements: SCHEMA_V1_STATEMENTS,
  },
  {
    version: 2,
    label: 'Artist genres — genre tags per artist for genre distribution',
    statements: SCHEMA_V2_STATEMENTS,
  },
] as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** DDL for the migrations-tracking table itself. */
const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS _migrations (
  version    INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);`;

/**
 * Ensure the `_migrations` table exists.
 *
 * @param exec - Database executor function.
 */
async function ensureMigrationsTable(exec: DbExecutor): Promise<void> {
  await exec(CREATE_MIGRATIONS_TABLE);
}

/**
 * Return the set of already-applied migration versions.
 *
 * @param exec - Database executor function.
 * @returns Set of version numbers that have been applied.
 */
async function getAppliedVersions(exec: DbExecutor): Promise<Set<number>> {
  const rows = await exec('SELECT version FROM _migrations ORDER BY version');
  return new Set(rows.map((r) => Number(r.version)));
}

/**
 * Record a migration as applied.
 *
 * @param exec    - Database executor function.
 * @param version - The migration version that was applied.
 */
async function recordMigration(
  exec: DbExecutor,
  version: number,
): Promise<void> {
  await exec('INSERT INTO _migrations (version, applied_at) VALUES (?, ?)', [
    version,
    Date.now(),
  ]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all pending migrations against the database.
 *
 * Migrations are executed in version order. Already-applied versions are
 * skipped. Each migration's statements are run sequentially.
 *
 * @param exec - Database executor function (e.g. the worker client's `exec`).
 * @returns The number of migrations that were applied during this call.
 */
export async function runMigrations(exec: DbExecutor): Promise<number> {
  await ensureMigrationsTable(exec);

  const applied = await getAppliedVersions(exec);
  let count = 0;

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) {
      continue;
    }

    for (const sql of migration.statements) {
      await exec(sql);
    }

    await recordMigration(exec, migration.version);
    count += 1;
  }

  return count;
}
