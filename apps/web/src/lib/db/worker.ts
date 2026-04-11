/**
 * Web Worker entry point for wa-sqlite with OPFS VFS.
 *
 * Runs in a dedicated worker thread. The main thread communicates via
 * structured messages defined in `types.ts`. Supported operations:
 *
 *   - `init`  : Open (or create) the database and run pending migrations.
 *   - `exec`  : Execute a SQL statement with optional bind parameters.
 *   - `close` : Close the database connection.
 *
 * Uses wa-sqlite v1.0.0 API where Factory() returns an API object with
 * all sqlite methods as instance methods.
 */

import type {
  WorkerRequest,
  WorkerResponse,
  SqlParam,
} from './types.js';
import { runMigrations } from './migrations.js';
import { DB_NAME } from './schema.js';

// ---------------------------------------------------------------------------
// wa-sqlite imports (resolved at bundle time via the consuming project's
// package manager — we do NOT install packages here).
// ---------------------------------------------------------------------------
// @ts-expect-error — wa-sqlite ships as plain JS; types come from the project
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
// @ts-expect-error — constants (SQLITE_ROW, SQLITE_OPEN_*, etc.)
import * as SQLite from 'wa-sqlite';
// @ts-expect-error — OPFS access-handle pool VFS for persistence
import { AccessHandlePoolVFS } from 'wa-sqlite/src/examples/AccessHandlePoolVFS.js';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** The wa-sqlite API object returned by Factory(). Has all sqlite methods. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite3: any = null;
/** The open database handle (number). */
let db: number | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Execute a single SQL statement and return result rows as plain objects.
 *
 * In wa-sqlite v1.0.0, all sqlite functions are methods on the API object
 * returned by Factory(). Constants (SQLITE_ROW, etc.) remain on the
 * namespace import.
 *
 * @param api      - The wa-sqlite API object (from Factory()).
 * @param dbHandle - The open database handle.
 * @param sql      - SQL string to execute.
 * @param params   - Optional bind parameters.
 * @returns Array of row objects keyed by column name.
 */
function execSql(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api: any,
  dbHandle: number,
  sql: string,
  params: SqlParam[] = [],
): Record<string, SqlParam>[] {
  const rows: Record<string, SqlParam>[] = [];

  for (const stmt of api.statements(dbHandle, sql)) {
    if (params.length > 0) {
      api.bind_collection(stmt, params);
    }

    const columnNames: string[] = api.column_names(stmt);

    while (api.step(stmt) === SQLite.SQLITE_ROW) {
      const row: Record<string, SqlParam> = {};
      const values = api.row(stmt);
      for (let i = 0; i < columnNames.length; i++) {
        row[columnNames[i]] = values[i] as SqlParam;
      }
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Build a `DbExecutor` that delegates to `execSql` with the current
 * module-level handles.
 */
function makeExecutor(): (
  sql: string,
  params?: SqlParam[],
) => Promise<Record<string, SqlParam>[]> {
  return async (sql: string, params?: SqlParam[]) => {
    if (sqlite3 === null || db === null) {
      throw new Error('Database is not initialised. Send an "init" message first.');
    }
    return execSql(sqlite3, db, sql, params);
  };
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

/**
 * Initialise wa-sqlite, register the OPFS VFS, open the database, and
 * run any pending migrations.
 *
 * @param dbName - Optional override for the database filename.
 */
async function handleInit(dbName?: string): Promise<void> {
  const module = await SQLiteESMFactory();
  sqlite3 = SQLite.Factory(module);

  const vfs = new AccessHandlePoolVFS('.wa-sqlite');
  await vfs.isReady;
  sqlite3.vfs_register(vfs, true);

  db = await sqlite3.open_v2(
    dbName ?? DB_NAME,
    SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
    vfs.name,
  );

  // Enable WAL mode for better concurrent read performance.
  execSql(sqlite3, db, 'PRAGMA journal_mode=WAL;');
  // Enforce foreign keys.
  execSql(sqlite3, db, 'PRAGMA foreign_keys=ON;');

  // Run any outstanding schema migrations.
  const executor = makeExecutor();
  await runMigrations(executor);
}

/**
 * Execute a SQL statement and return the result rows.
 */
async function handleExec(
  sql: string,
  params?: SqlParam[],
): Promise<Record<string, SqlParam>[]> {
  const executor = makeExecutor();
  return executor(sql, params);
}

/**
 * Close the open database connection and clean up handles.
 */
function handleClose(): void {
  if (sqlite3 !== null && db !== null) {
    sqlite3.close(db);
  }
  db = null;
  sqlite3 = null;
}

// ---------------------------------------------------------------------------
// Worker message listener
// ---------------------------------------------------------------------------

function sendResponse(response: WorkerResponse): void {
  self.postMessage(response);
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case 'init': {
        await handleInit(msg.dbName);
        sendResponse({ type: 'success', id: msg.id, rows: [] });
        break;
      }

      case 'exec': {
        const rows = await handleExec(msg.sql, msg.params);
        sendResponse({ type: 'success', id: msg.id, rows });
        break;
      }

      case 'close': {
        handleClose();
        sendResponse({ type: 'success', id: msg.id, rows: [] });
        break;
      }

      default: {
        sendResponse({
          type: 'error',
          id: (msg as WorkerRequest).id,
          error: `Unknown message type: ${(msg as WorkerRequest).type}`,
        });
      }
    }
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : String(err);
    sendResponse({ type: 'error', id: msg.id, error: errorMessage });
  }
};
