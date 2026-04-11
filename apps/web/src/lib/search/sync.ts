/**
 * Playlist sync engine.
 *
 * Orchestrates syncing Spotify playlists into the local SQLite database.
 * Uses snapshot_id comparison to skip unchanged playlists (incremental sync).
 */

import type { SpotifyClient } from '$lib/spotify/client';
import type { SpotifyPlaylist, SpotifyPlaylistTrack, SpotifyTrack } from '$lib/spotify/types';
import type { DbExecutor, PlaylistRow } from '$lib/db/types';
import { upsertPlaylist, upsertTrack, linkPlaylistTrack } from '$lib/db/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncStats {
	playlistsTotal: number;
	playlistsSynced: number;
	playlistsSkipped: number;
	tracksUpserted: number;
}

export interface SyncProgress {
	current: number;
	total: number;
	phase: 'fetching_playlists' | 'syncing_playlists';
}

export type OnProgress = (progress: SyncProgress) => void;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether a playlist needs syncing by comparing snapshot IDs.
 *
 * @param playlist           - The Spotify playlist object.
 * @param existingSnapshotId - The snapshot_id stored in the local DB (null if new).
 * @returns true if the playlist should be re-synced.
 */
export function shouldSyncPlaylist(
	playlist: SpotifyPlaylist,
	existingSnapshotId: string | null
): boolean {
	if (existingSnapshotId === null) return true;
	return playlist.snapshot_id !== existingSnapshotId;
}

/**
 * Transform a Spotify API track into the shape expected by upsertTrack.
 * Joins multiple artist names with ", ".
 */
export function transformSpotifyTrack(spotifyTrack: SpotifyTrack): {
	id: string;
	name: string;
	artist_name: string;
	album_name: string;
	duration_ms: number;
	popularity: number;
	release_date: string | null;
} {
	return {
		id: spotifyTrack.id,
		name: spotifyTrack.name,
		artist_name: spotifyTrack.artists.map((a) => a.name).join(', '),
		album_name: spotifyTrack.album.name,
		duration_ms: spotifyTrack.duration_ms,
		popularity: spotifyTrack.popularity,
		release_date: spotifyTrack.album.release_date ?? null
	};
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all existing playlists from the local DB and return a map of
 * playlist ID → snapshot_id for fast comparison.
 */
async function getExistingSnapshots(exec: DbExecutor): Promise<Map<string, string>> {
	const rows = await exec('SELECT id, snapshot_id FROM playlists');
	const map = new Map<string, string>();
	for (const row of rows) {
		map.set(row.id as string, row.snapshot_id as string);
	}
	return map;
}

/**
 * Remove playlist_track links for a playlist before re-syncing.
 * This ensures deleted tracks are properly cleaned up.
 */
async function clearPlaylistTracks(exec: DbExecutor, playlistId: string): Promise<void> {
	await exec('DELETE FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
}

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------

/**
 * Sync all user playlists from Spotify into the local database.
 *
 * 1. Fetches all user playlists via the Spotify client (handles pagination).
 * 2. Compares each playlist's snapshot_id with the local DB.
 * 3. Skips playlists whose snapshot_id is unchanged.
 * 4. For new/changed playlists: fetches tracks, upserts everything.
 *
 * @param spotifyClient - An authenticated SpotifyClient instance.
 * @param exec          - Database executor for SQLite operations.
 * @param onProgress    - Optional callback for progress updates.
 * @returns Sync statistics.
 */
export async function syncPlaylists(
	spotifyClient: SpotifyClient,
	exec: DbExecutor,
	onProgress?: OnProgress
): Promise<SyncStats> {
	// Phase 1: Fetch all playlists from Spotify
	console.debug('[Sync] Starting playlist sync...');
	onProgress?.({ current: 0, total: 0, phase: 'fetching_playlists' });
	const spotifyPlaylists = await spotifyClient.getAllUserPlaylists();
	console.debug('[Sync] Fetched %d playlists from Spotify API', spotifyPlaylists.length);

	// Get existing snapshot IDs from local DB
	const existingSnapshots = await getExistingSnapshots(exec);

	const stats: SyncStats = {
		playlistsTotal: spotifyPlaylists.length,
		playlistsSynced: 0,
		playlistsSkipped: 0,
		tracksUpserted: 0
	};

	// Phase 2: Sync each playlist
	for (let i = 0; i < spotifyPlaylists.length; i++) {
		const playlist = spotifyPlaylists[i];

		onProgress?.({
			current: i + 1,
			total: spotifyPlaylists.length,
			phase: 'syncing_playlists'
		});

		const existingSnapshotId = existingSnapshots.get(playlist.id) ?? null;

		if (!shouldSyncPlaylist(playlist, existingSnapshotId)) {
			console.debug('[Sync] Playlist "%s" (id: %s) — snapshot unchanged, skipping', playlist.name, playlist.id);
			stats.playlistsSkipped++;
			continue;
		}

		// Upsert the playlist record
		const playlistRow: PlaylistRow = {
			id: playlist.id,
			name: playlist.name,
			owner: playlist.owner.display_name ?? '',
			snapshot_id: playlist.snapshot_id,
			image_url: playlist.images?.length > 0 ? playlist.images[0].url : null,
			synced_at: Date.now()
		};
		await upsertPlaylist(exec, playlistRow);

		// Clear existing links for this playlist, then re-insert
		await clearPlaylistTracks(exec, playlist.id);

		// Fetch all tracks for this playlist
		const spotifyTracks = await spotifyClient.getAllPlaylistTracks(playlist.id);
		console.debug('[Sync] Playlist "%s" (id: %s) — syncing %d tracks', playlist.name, playlist.id, spotifyTracks.length);

		for (let j = 0; j < spotifyTracks.length; j++) {
			const playlistTrack = spotifyTracks[j];
			if (!playlistTrack.track || !playlistTrack.track.id) continue;

			const trackData = transformSpotifyTrack(playlistTrack.track);
			await upsertTrack(exec, trackData);

			const addedAt = playlistTrack.added_at
				? new Date(playlistTrack.added_at).getTime()
				: null;
			await linkPlaylistTrack(exec, playlist.id, playlistTrack.track.id, addedAt, j);

			stats.tracksUpserted++;
		}

		stats.playlistsSynced++;
	}

	console.debug(
		'[Sync] Complete: %d playlists (%d synced, %d skipped), %d tracks indexed',
		stats.playlistsTotal, stats.playlistsSynced, stats.playlistsSkipped, stats.tracksUpserted,
	);
	return stats;
}
