/**
 * Tests for getOrphanedTracks query helper.
 *
 * Uses an in-memory mock DbExecutor that simulates the LEFT JOIN used to
 * find tracks with no row in playlist_tracks.
 */

import { describe, it, expect } from 'vitest';
import { getOrphanedTracks } from '../../../src/lib/db/queries';
import type { DbExecutor } from '../../../src/lib/db/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface MockTrack {
	id: string;
	name: string;
	name_lower: string;
	artist_name: string;
	album_name: string;
}

interface MockLink {
	playlist_id: string;
	track_id: string;
}

function makeTrack(id: string, name: string, artist_name = 'Test Artist'): MockTrack {
	return { id, name, name_lower: name.toLowerCase(), artist_name, album_name: 'Test Album' };
}

// ---------------------------------------------------------------------------
// Mock executor factory
// ---------------------------------------------------------------------------

/**
 * Creates a mock DbExecutor that simulates the orphaned-tracks LEFT JOIN query.
 *
 * Tracks that have NO matching row in `links` are considered orphaned.
 */
function createMockExecutor(tracks: MockTrack[], links: MockLink[]): DbExecutor {
	return async (sql: string): Promise<Record<string, unknown>[]> => {
		const normalized = sql.replace(/\s+/g, ' ').trim();

		// Match the orphaned-tracks query (LEFT JOIN + WHERE pt.track_id IS NULL)
		if (
			normalized.includes('FROM tracks t') &&
			normalized.includes('LEFT JOIN playlist_tracks pt') &&
			normalized.includes('pt.track_id IS NULL')
		) {
			const linkedIds = new Set(links.map((l) => l.track_id));
			return tracks
				.filter((t) => !linkedIds.has(t.id))
				.sort((a, b) => a.name_lower.localeCompare(b.name_lower)) as unknown as Record<
				string,
				unknown
			>[];
		}

		return [];
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getOrphanedTracks', () => {
	it('returns tracks that have no row in playlist_tracks', async () => {
		const tracks = [
			makeTrack('t1', 'Orphan Song'),
			makeTrack('t2', 'Playlist Song'),
		];
		const links: MockLink[] = [{ playlist_id: 'p1', track_id: 't2' }];

		const exec = createMockExecutor(tracks, links);
		const result = await getOrphanedTracks(exec);

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('t1');
		expect(result[0].name).toBe('Orphan Song');
	});

	it('does not return tracks that are in at least one playlist', async () => {
		const tracks = [makeTrack('t1', 'Included Track')];
		const links: MockLink[] = [{ playlist_id: 'p1', track_id: 't1' }];

		const exec = createMockExecutor(tracks, links);
		const result = await getOrphanedTracks(exec);

		expect(result).toHaveLength(0);
	});

	it('returns all tracks when none are linked to any playlist', async () => {
		const tracks = [
			makeTrack('t1', 'Alpha'),
			makeTrack('t2', 'Beta'),
			makeTrack('t3', 'Gamma'),
		];
		const links: MockLink[] = [];

		const exec = createMockExecutor(tracks, links);
		const result = await getOrphanedTracks(exec);

		expect(result).toHaveLength(3);
		const ids = result.map((r) => r.id);
		expect(ids).toContain('t1');
		expect(ids).toContain('t2');
		expect(ids).toContain('t3');
	});

	it('returns empty array when all tracks are in playlists', async () => {
		const tracks = [
			makeTrack('t1', 'Track One'),
			makeTrack('t2', 'Track Two'),
		];
		const links: MockLink[] = [
			{ playlist_id: 'p1', track_id: 't1' },
			{ playlist_id: 'p2', track_id: 't2' },
		];

		const exec = createMockExecutor(tracks, links);
		const result = await getOrphanedTracks(exec);

		expect(result).toHaveLength(0);
	});

	it('returns empty array when there are no tracks at all', async () => {
		const exec = createMockExecutor([], []);
		const result = await getOrphanedTracks(exec);

		expect(result).toHaveLength(0);
	});

	it('a track in multiple playlists is not orphaned', async () => {
		const tracks = [makeTrack('t1', 'Multi-playlist Track')];
		const links: MockLink[] = [
			{ playlist_id: 'p1', track_id: 't1' },
			{ playlist_id: 'p2', track_id: 't1' },
			{ playlist_id: 'p3', track_id: 't1' },
		];

		const exec = createMockExecutor(tracks, links);
		const result = await getOrphanedTracks(exec);

		expect(result).toHaveLength(0);
	});

	it('orphaned results include name, artist_name, and album_name fields', async () => {
		const tracks = [
			{
				id: 't1',
				name: 'My Song',
				name_lower: 'my song',
				artist_name: 'My Artist',
				album_name: 'My Album',
			},
		];

		const exec = createMockExecutor(tracks, []);
		const result = await getOrphanedTracks(exec);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			id: 't1',
			name: 'My Song',
			artist_name: 'My Artist',
			album_name: 'My Album',
		});
	});
});
