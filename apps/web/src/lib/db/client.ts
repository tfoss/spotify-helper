/**
 * Main-thread client for the wa-sqlite Web Worker.
 *
 * Provides a typed, promise-based interface for communicating with the
 * database worker. All SQL execution is delegated to the worker thread,
 * keeping the main thread free for UI rendering.
 *
 * Usage:
 *   const db = new DbClient();
 *   await db.init();
 *   const rows = await db.exec('SELECT * FROM playlists');
 *   await db.close();
 */

import type {
  WorkerRequest,
  WorkerResponse,
  SqlParam,
  DbExecutor,
} from './types.js';

// ---------------------------------------------------------------------------
// Pending-request bookkeeping
// ---------------------------------------------------------------------------

interface PendingRequest {
  resolve: (rows: Record<string, SqlParam>[]) => void;
  reject: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Client class
// ---------------------------------------------------------------------------

/**
 * A typed client that spawns a Web Worker and provides `init`, `exec`,
 * and `close` methods with promise-based return values.
 */
export class DbClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();

  /**
   * Create a new DbClient.
   *
   * @param workerUrl - URL or path to the worker script. Defaults to a
   *   Vite-compatible `new URL` import which the bundler will resolve.
   */
  constructor(private readonly workerUrl?: URL) {}

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Allocate a unique message ID for request/response correlation.
   */
  private allocateId(): number {
    return this.nextId++;
  }

  /**
   * Post a typed message to the worker and return a promise that resolves
   * when the matching response arrives.
   */
  private send(message: WorkerRequest): Promise<Record<string, SqlParam>[]> {
    if (!this.worker) {
      return Promise.reject(
        new Error('Worker not started. Call init() first.'),
      );
    }

    return new Promise<Record<string, SqlParam>[]>((resolve, reject) => {
      this.pending.set(message.id, { resolve, reject });
      this.worker!.postMessage(message);
    });
  }

  /**
   * Handle an incoming message from the worker.
   */
  private onMessage = (event: MessageEvent<WorkerResponse>): void => {
    const { id } = event.data;
    const pendingReq = this.pending.get(id);
    if (!pendingReq) {
      return; // Orphaned response — ignore.
    }

    this.pending.delete(id);

    if (event.data.type === 'error') {
      pendingReq.reject(new Error(event.data.error));
    } else {
      pendingReq.resolve(event.data.rows);
    }
  };

  /**
   * Handle a worker error (e.g. failed to load the script).
   */
  private onError = (event: ErrorEvent): void => {
    // Reject all outstanding requests.
    const err = new Error(event.message ?? 'Worker error');
    for (const pending of this.pending.values()) {
      pending.reject(err);
    }
    this.pending.clear();
  };

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Spawn the worker, open the database, and run migrations.
   *
   * @param dbName - Optional database filename override.
   */
  async init(dbName?: string): Promise<void> {
    const url =
      this.workerUrl ??
      new URL('./worker.ts', import.meta.url);

    this.worker = new Worker(url, { type: 'module' });
    this.worker.addEventListener('message', this.onMessage);
    this.worker.addEventListener('error', this.onError);

    const id = this.allocateId();
    await this.send({ type: 'init', id, dbName });
  }

  /**
   * Execute a SQL statement with optional bind parameters.
   *
   * @param sql    - SQL string.
   * @param params - Bind parameters.
   * @returns Array of result rows as plain objects.
   */
  async exec(
    sql: string,
    params?: SqlParam[],
  ): Promise<Record<string, SqlParam>[]> {
    const id = this.allocateId();
    return this.send({ type: 'exec', id, sql, params });
  }

  /**
   * Close the database and terminate the worker.
   */
  async close(): Promise<void> {
    if (!this.worker) {
      return;
    }

    const id = this.allocateId();
    await this.send({ type: 'close', id });

    this.worker.removeEventListener('message', this.onMessage);
    this.worker.removeEventListener('error', this.onError);
    this.worker.terminate();
    this.worker = null;
    this.pending.clear();
  }

  /**
   * Return a `DbExecutor` function suitable for passing to query helpers.
   *
   * This allows the query functions in `queries.ts` to remain pure —
   * they accept an executor rather than importing a global client.
   */
  toExecutor(): DbExecutor {
    return (sql: string, params?: SqlParam[]) => this.exec(sql, params);
  }
}
