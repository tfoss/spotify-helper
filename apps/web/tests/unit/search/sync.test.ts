/**
 * Phase 2 tests: Sync engine — snapshot_id skip and pagination.
 */

import { describe, it, expect, vi } from 'vitest';
import { shouldSyncPlaylist, transformSpotifyTrack, syncPlaylists } from '../../../src/lib/search/sync';
import type { SpotifyPlaylist, SpotifyPlaylistTrack, SpotifyTrack, SpotifyPaginated } from '../../../src/lib/spotify/types';
import type { SpotifyClient } from '../../../src/lib/spotify/client';
import type { DbExecutor } from '../../../src/lib/db/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpotifyPlaylist(id: string, snapshotId: string): SpotifyPlaylist {
	return {
		id,
		name: `Playlist ${id}`,
		owner: { display_name: 'test-user' },
		snapshot_id: snapshotId,
		images: [],
		tracks: { total: 2 },
	};
}

function makeSpotifyTrack(id: string, name: string, artist: string): SpotifyTrack {
	return {
		id,
		name,
		artists: [{ id: `artist-${artist}`, name: artist }],
		album: { name: 'Test Album', release_date: '2024-01-01' },
		duration_ms: 200000,
		popularity: 50,
	};
}

function makePlaylistTrack(track: SpotifyTrack): SpotifyPlaylistTrack {
	return {
		added_at: '2024-01-01T00:00:00Z',
		track,
	};
}

function createMockExec(): { exec: DbExecutor; calls: { sql: string; params: unknown[] }[] } {
	const calls: { sql: string; params: unknown[] }[] = [];
	const exec: DbExecutor = async (sql: string, params?: unknown[]) => {
		calls.push({ sql, params: params ?? [] });

		// Return empty playlists for snapshot lookup
		if (sql.includes('SELECT id, snapshot_id FROM playlists')) {
			return [];
		}
		return [];
	};
	return { exec, calls };
}

function createMockExecWithSnapshots(snapshots: Record<string, string>): {
	exec: DbExecutor;
	calls: { sql: string; params: unknown[] }[];
} {
	const calls: { sql: string; params: unknown[] }[] = [];
	const exec: DbExecutor = async (sql: string, params?: unknown[]) => {
		calls.push({ sql, params: params ?? [] });

		if (sql.includes('SELECT id, snapshot_id FROM playlists')) {
			return Object.entries(snapshots).map(([id, snapshot_id]) => ({
				id,
				snapshot_id,
			}));
		}
		return [];
	};
	return { exec, calls };
}

// ---------------------------------------------------------------------------
// shouldSyncPlaylist
// ---------------------------------------------------------------------------

describe('shouldSyncPlaylist', () => {
	it('returns true when existing snapshot is null (new playlist)', () => {
		const playlist = makeSpotifyPlaylist('p1', 'snap-abc');
		expect(shouldSyncPlaylist(playlist, null)).toBe(true);
	});

	it('returns true when snapshot IDs differ (changed playlist)', () => {
		const playlist = makeSpotifyPlaylist('p1', 'snap-new');
		expect(shouldSyncPlaylist(playlist, 'snap-old')).toBe(true);
	});

	it('returns false when snapshot IDs match (unchanged playlist)', () => {
		const playlist = makeSpotifyPlaylist('p1', 'snap-same');
		expect(shouldSyncPlaylist(playlist, 'snap-same')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// transformSpotifyTrack
// ---------------------------------------------------------------------------

describe('transformSpotifyTrack', () => {
	it('joins multiple artists with comma-space', () => {
		const track: SpotifyTrack = {
			id: 't1',
			name: 'Song',
			artists: [
				{ id: 'a1', name: 'Artist A' },
				{ id: 'a2', name: 'Artist B' },
			],
			album: { name: 'Album', release_date: '2024-06-15' },
			duration_ms: 180000,
			popularity: 75,
		};
		const result = transformSpotifyTrack(track);
		expect(result.artist_name).toBe('Artist A, Artist B');
	});
});

// ---------------------------------------------------------------------------
// snapshot_id sync skip
// ---------------------------------------------------------------------------

describe('syncPlaylists — snapshot_id sync skip', () => {
	it('skips playlists with unchanged snapshot_id (no track refetch)', async () => {
		const { exec, calls } = createMockExecWithSnapshots({
			'p1': 'snap-unchanged',
		});

		const mockClient = {
			getAllUserPlaylists: vi.fn().mockResolvedValue([
				makeSpotifyPlaylist('p1', 'snap-unchanged'),
			]),
			getAllPlaylistTracks: vi.fn(),
		} as unknown as SpotifyClient;

		const stats = await syncPlaylists(mockClient, exec);

		expect(stats.playlistsSkipped).toBe(1);
		expect(stats.playlistsSynced).toBe(0);
		// getAllPlaylistTracks should NOT have been called
		expect((mockClient as any).getAllPlaylistTracks).not.toHaveBeenCalled();
	});

	it('syncs playlists with changed snapshot_id', async () => {
		const { exec } = createMockExecWithSnapshots({
			'p1': 'snap-old',
		});

		const track = makeSpotifyTrack('t1', 'Song', 'Artist');

		const mockClient = {
			getAllUserPlaylists: vi.fn().mockResolvedValue([
				makeSpotifyPlaylist('p1', 'snap-new'),
			]),
			getAllPlaylistTracks: vi.fn().mockResolvedValue([
				makePlaylistTrack(track),
			]),
			getArtistsByIds: vi.fn().mockResolvedValue({ artists: [] }),
		} as unknown as SpotifyClient;

		const stats = await syncPlaylists(mockClient, exec);

		expect(stats.playlistsSkipped).toBe(0);
		expect(stats.playlistsSynced).toBe(1);
		expect(stats.tracksUpserted).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Pagination: >50 playlists fully indexed
// ---------------------------------------------------------------------------

describe('syncPlaylists — pagination', () => {
	it('library with >50 playlists is fully indexed', async () => {
		// Create 55 playlists
		const manyPlaylists: SpotifyPlaylist[] = [];
		for (let i = 0; i < 55; i++) {
			manyPlaylists.push(makeSpotifyPlaylist(`p${i}`, `snap-${i}`));
		}

		const { exec } = createMockExec();

		const mockClient = {
			// getAllUserPlaylists already handles pagination internally,
			// so we just return all 55 playlists
			getAllUserPlaylists: vi.fn().mockResolvedValue(manyPlaylists),
			getAllPlaylistTracks: vi.fn().mockResolvedValue([
				makePlaylistTrack(makeSpotifyTrack('t1', 'Song', 'Artist')),
			]),
			getArtistsByIds: vi.fn().mockResolvedValue({ artists: [] }),
		} as unknown as SpotifyClient;

		const stats = await syncPlaylists(mockClient, exec);

		expect(stats.playlistsTotal).toBe(55);
		expect(stats.playlistsSynced).toBe(55);
		expect(stats.tracksUpserted).toBe(55); // 1 track per playlist
		// getAllPlaylistTracks called for each playlist
		expect((mockClient as any).getAllPlaylistTracks).toHaveBeenCalledTimes(55);
	});
});
