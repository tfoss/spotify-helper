/**
 * Svelte store for playlist sync state.
 * Tracks sync progress, errors, and last sync time.
 */

import { writable, get } from 'svelte/store';
import { syncPlaylists } from '$lib/search/sync';
import type { SyncStats, SyncProgress } from '$lib/search/sync';
import type { SpotifyClient } from '$lib/spotify/client';
import type { DbExecutor } from '$lib/db/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncState {
	isSyncing: boolean;
	progress: SyncProgress | null;
	lastSyncedAt: number | null;
	lastStats: SyncStats | null;
	error: string | null;
}

const LAST_SYNC_KEY = 'spotify_last_synced_at';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

function createSyncStore() {
	const initial: SyncState = {
		isSyncing: false,
		progress: null,
		lastSyncedAt: getStoredLastSyncTime(),
		lastStats: null,
		error: null
	};

	const { subscribe, set, update } = writable<SyncState>(initial);

	/**
	 * Start a full playlist sync.
	 * No-ops if a sync is already in progress.
	 */
	async function startSync(
		spotifyClient: SpotifyClient,
		exec: DbExecutor
	): Promise<SyncStats | null> {
		const current = get({ subscribe });
		if (current.isSyncing) return null;

		update((s) => ({
			...s,
			isSyncing: true,
			progress: { current: 0, total: 0, phase: 'fetching_playlists' as const },
			error: null
		}));

		try {
			const stats = await syncPlaylists(spotifyClient, exec, (progress) => {
				update((s) => ({ ...s, progress }));
			});

			const now = Date.now();
			storeLastSyncTime(now);

			set({
				isSyncing: false,
				progress: null,
				lastSyncedAt: now,
				lastStats: stats,
				error: null
			});

			return stats;
		} catch (err) {
			update((s) => ({
				...s,
				isSyncing: false,
				progress: null,
				error: err instanceof Error ? err.message : 'Sync failed'
			}));
			return null;
		}
	}

	/**
	 * Get the last sync timestamp from localStorage.
	 */
	function getLastSyncTime(): number | null {
		return getStoredLastSyncTime();
	}

	return {
		subscribe,
		startSync,
		getLastSyncTime
	};
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function getStoredLastSyncTime(): number | null {
	try {
		const stored = localStorage.getItem(LAST_SYNC_KEY);
		return stored ? parseInt(stored, 10) : null;
	} catch {
		return null;
	}
}

function storeLastSyncTime(timestamp: number): void {
	try {
		localStorage.setItem(LAST_SYNC_KEY, timestamp.toString());
	} catch {
		// Ignore storage errors
	}
}

export const syncStore = createSyncStore();
