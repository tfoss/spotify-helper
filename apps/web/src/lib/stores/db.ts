/**
 * Svelte store for the wa-sqlite database client.
 *
 * Manages the DbClient lifecycle (init, close) and exposes a reactive
 * executor that other stores and components can use to query the database.
 *
 * Usage:
 *   import { dbStore } from '$lib/stores/db';
 *
 *   // Initialize once at app startup (e.g. in +layout.svelte):
 *   await dbStore.initialize();
 *
 *   // Get the executor for queries:
 *   const state = get(dbStore);
 *   if (state.executor) {
 *     const rows = await state.executor('SELECT * FROM tracks');
 *   }
 */

import { writable, get } from 'svelte/store';
import { DbClient } from '$lib/db/client';
import type { DbExecutor } from '$lib/db/types';

export interface DbState {
	/** Whether the database has been initialized and is ready for queries. */
	isReady: boolean;
	/** The executor function, or null if not yet initialized. */
	executor: DbExecutor | null;
	/** Error message if initialization failed. */
	error: string | null;
	/** Whether initialization is currently in progress. */
	isInitializing: boolean;
}

const initialState: DbState = {
	isReady: false,
	executor: null,
	error: null,
	isInitializing: false,
};

function createDbStore() {
	const { subscribe, set, update } = writable<DbState>(initialState);

	let client: DbClient | null = null;

	/**
	 * Initialize the database client.
	 *
	 * Spawns the wa-sqlite Web Worker, opens the database, and runs
	 * any pending migrations. Safe to call multiple times — subsequent
	 * calls are no-ops if already initialized.
	 */
	async function initialize(): Promise<void> {
		const current = get({ subscribe });
		if (current.isReady || current.isInitializing) {
			return;
		}

		update((s) => ({ ...s, isInitializing: true, error: null }));

		try {
			console.debug('[DB] Initializing wa-sqlite...');
			client = new DbClient();
			await client.init();

			const executor = client.toExecutor();

			// Log table row counts for debugging
			try {
				const counts = await Promise.all([
					executor('SELECT COUNT(*) AS n FROM playlists'),
					executor('SELECT COUNT(*) AS n FROM tracks'),
					executor('SELECT COUNT(*) AS n FROM recent_plays'),
				]);
				console.debug(
					'[DB] Initialized — playlists: %d, tracks: %d, recent_plays: %d',
					counts[0][0]?.n ?? 0,
					counts[1][0]?.n ?? 0,
					counts[2][0]?.n ?? 0,
				);
			} catch {
				console.debug('[DB] Initialized (could not read table counts)');
			}

			set({
				isReady: true,
				executor,
				error: null,
				isInitializing: false,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to initialize database';
			set({
				isReady: false,
				executor: null,
				error: message,
				isInitializing: false,
			});
		}
	}

	/**
	 * Close the database and reset the store to its initial state.
	 */
	async function close(): Promise<void> {
		if (client) {
			await client.close();
			client = null;
		}
		set(initialState);
	}

	return {
		subscribe,
		initialize,
		close,
	};
}

export const dbStore = createDbStore();
