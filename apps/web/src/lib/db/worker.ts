/**
 * Web Worker entry point for wa-sqlite with OPFS VFS.
 *
 * Runs in a dedicated worker thread. The main thread communicates via
 * structured messages defined in `types.ts`. Supported operations:
 *
 *   - `init`  : Open (or create) the database and run pending migrations.
 *   - `exec`  : Execute a SQL statement with optional bind parameters.
 *   - `close` : Close the database connection.
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
// @ts-expect-error — same as above
import * as SQLite from 'wa-sqlite';
// @ts-expect-error — OPFS access-handle pool VFS for persistence
import { AccessHandlePoolVFS } from 'wa-sqlite/src/examples/AccessHandlePoolVFS.js';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let sqlite3: number | null = null;
let db: number | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Execute a single SQL statement and return result rows as plain objects.
 *
 * @param sqliteApi - The wa-sqlite API handle.
 * @param dbHandle  - The open database handle.
 * @param sql       - SQL string to execute.
 * @param params    - Optional bind parameters.
 * @returns Array of row objects keyed by column name.
 */
function execSql(
  sqliteApi: typeof SQLite,
  dbHandle: number,
  sql: string,
  params: SqlParam[] = [],
): Record<string, SqlParam>[] {
  const rows: Record<string, SqlParam>[] = [];

  for (const stmt of sqliteApi.statements(dbHandle, sql)) {
    if (params.length > 0) {
      sqliteApi.bind_collection(stmt, params);
    }

    const columnNames: string[] = sqliteApi.column_names(stmt);

    while (sqliteApi.step(stmt) === SQLite.SQLITE_ROW) {
      const row: Record<string, SqlParam> = {};
      const values = sqliteApi.row(stmt);
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
    return execSql(SQLite, db, sql, params);
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
  SQLite.register_vfs(sqlite3, vfs);

  db = await SQLite.open_v2(
    sqlite3,
    dbName ?? DB_NAME,
    SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
    vfs.name,
  );

  // Enable WAL mode for better concurrent read performance.
  execSql(SQLite, db, 'PRAGMA journal_mode=WAL;');
  // Enforce foreign keys.
  execSql(SQLite, db, 'PRAGMA foreign_keys=ON;');

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
    SQLite.close(db);
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
