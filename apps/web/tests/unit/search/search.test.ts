/**
 * Phase 2 tests: Playlist search.
 *
 * Tests use an in-memory mock DbExecutor that simulates SQLite behavior
 * for the search and playlist lookup queries.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { searchPlaylists } from '../../../src/lib/search/index';
import type { DbExecutor } from '../../../src/lib/db/types';
import type { SearchQuery } from '../../../src/lib/search/types';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface MockTrack {
	id: string;
	name: string;
	name_lower: string;
	artist_name: string;
	artist_lower: string;
	album_name: string;
	duration_ms: number | null;
	popularity: number | null;
	release_date: string | null;
}

interface MockPlaylist {
	id: string;
	name: string;
	owner: string;
	snapshot_id: string;
	image_url: string | null;
	synced_at: number;
}

interface MockLink {
	playlist_id: string;
	track_id: string;
	added_at: number | null;
	position: number | null;
}

function makeTrack(overrides: Partial<MockTrack> & { id: string; name: string; artist_name: string }): MockTrack {
	return {
		name_lower: overrides.name.toLowerCase(),
		artist_lower: overrides.artist_name.toLowerCase(),
		album_name: 'Test Album',
		duration_ms: 200000,
		popularity: 50,
		release_date: '2024-01-01',
		...overrides,
	};
}

function makePlaylist(overrides: Partial<MockPlaylist> & { id: string; name: string }): MockPlaylist {
	return {
		owner: 'test-user',
		snapshot_id: 'snap-1',
		image_url: null,
		synced_at: Date.now(),
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Mock DB executor factory
// ---------------------------------------------------------------------------

function createMockDb(tracks: MockTrack[], playlists: MockPlaylist[], links: MockLink[]): DbExecutor {
	return async (sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> => {
		const normalized = sql.replace(/\s+/g, ' ').trim();

		// Track search by name
		if (normalized.includes('FROM tracks WHERE name_lower LIKE')) {
			const pattern = (params?.[0] as string) ?? '';
			const term = pattern.replace(/%/g, '');
			return tracks.filter((t) => t.name_lower.includes(term)) as unknown as Record<string, unknown>[];
		}

		// Track search by artist
		if (normalized.includes('FROM tracks WHERE artist_lower LIKE')) {
			const pattern = (params?.[0] as string) ?? '';
			const term = pattern.replace(/%/g, '');
			return tracks.filter((t) => t.artist_lower.includes(term)) as unknown as Record<string, unknown>[];
		}

		// Playlists for a track
		if (normalized.includes('FROM playlists p') && normalized.includes('playlist_tracks pt')) {
			const trackId = params?.[0] as string;
			const playlistIds = links
				.filter((l) => l.track_id === trackId)
				.map((l) => l.playlist_id);
			return playlists.filter((p) => playlistIds.includes(p.id)) as unknown as Record<string, unknown>[];
		}

		return [];
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('searchPlaylists — Phase 2 required test cases', () => {
	let tracks: MockTrack[];
	let playlists: MockPlaylist[];
	let links: MockLink[];
	let exec: DbExecutor;

	beforeEach(() => {
		tracks = [
			makeTrack({ id: 't1', name: 'Bohemian Rhapsody', artist_name: 'Queen' }),
			makeTrack({ id: 't2', name: 'We Will Rock You', artist_name: 'Queen' }),
			makeTrack({ id: 't3', name: 'Yesterday', artist_name: 'The Beatles' }),
			makeTrack({ id: 't4', name: 'Rhapsody in Blue', artist_name: 'Gershwin' }),
			makeTrack({ id: 't5', name: 'Stairway to Heaven', artist_name: 'Led Zeppelin' }),
		];

		playlists = [
			makePlaylist({ id: 'p1', name: 'Classic Rock' }),
			makePlaylist({ id: 'p2', name: 'Best of Queen' }),
			makePlaylist({ id: 'p3', name: 'Oldies' }),
		];

		links = [
			// t1 (Bohemian Rhapsody) in Classic Rock and Best of Queen
			{ playlist_id: 'p1', track_id: 't1', added_at: null, position: 0 },
			{ playlist_id: 'p2', track_id: 't1', added_at: null, position: 0 },
			// t2 (We Will Rock You) in Best of Queen and Oldies
			{ playlist_id: 'p2', track_id: 't2', added_at: null, position: 1 },
			{ playlist_id: 'p3', track_id: 't2', added_at: null, position: 0 },
			// t3 (Yesterday) in Classic Rock
			{ playlist_id: 'p1', track_id: 't3', added_at: null, position: 1 },
			// t4 (Rhapsody in Blue) in Oldies
			{ playlist_id: 'p3', track_id: 't4', added_at: null, position: 1 },
			// t5 (Stairway) in Classic Rock
			{ playlist_id: 'p1', track_id: 't5', added_at: null, position: 2 },
		];

		exec = createMockDb(tracks, playlists, links);
	});

	// 1. Partial artist name match
	it('partial artist name match returns all playlists containing any track by that artist', async () => {
		const query: SearchQuery = { query: 'queen', mode: 'artist' };
		const results = await searchPlaylists(query, exec);

		// Queen tracks are in p1 (Classic Rock), p2 (Best of Queen), p3 (Oldies)
		const playlistIds = new Set(results.items.map((i) => i.playlistId));
		expect(playlistIds).toContain('p1'); // Bohemian Rhapsody
		expect(playlistIds).toContain('p2'); // Bohemian Rhapsody + We Will Rock You
		expect(playlistIds).toContain('p3'); // We Will Rock You
	});

	// 2. Case-insensitive track name search
	it('case-insensitive track name search returns correct results', async () => {
		const query: SearchQuery = { query: 'BOHEMIAN', mode: 'track' };
		const results = await searchPlaylists(query, exec);

		expect(results.items.length).toBeGreaterThan(0);
		expect(results.items.every((i) => i.trackName === 'Bohemian Rhapsody')).toBe(true);
	});

	// 3. Combined track + artist search narrows results
	it('combined track + artist search narrows results correctly', async () => {
		// "rhapsody" matches t1 (Queen) and t4 (Gershwin)
		// Artist "queen" matches t1 and t2
		// Intersection: only t1 (Bohemian Rhapsody by Queen)
		const query: SearchQuery = { query: 'rhapsody', mode: 'both', artistQuery: 'queen' };
		const results = await searchPlaylists(query, exec);

		expect(results.items.length).toBe(2); // t1 in p1 and p2
		expect(results.items.every((i) => i.trackName === 'Bohemian Rhapsody')).toBe(true);
	});

	// 4. Track in multiple playlists appears in all matching results
	it('track in multiple playlists appears in all matching results (not deduplicated)', async () => {
		const query: SearchQuery = { query: 'bohemian', mode: 'track' };
		const results = await searchPlaylists(query, exec);

		// Bohemian Rhapsody is in p1 and p2 — should appear twice
		const entries = results.items.filter((i) => i.trackId === 't1');
		expect(entries.length).toBe(2);

		const playlistIds = entries.map((e) => e.playlistId);
		expect(playlistIds).toContain('p1');
		expect(playlistIds).toContain('p2');
	});

	// 7. Empty search input returns no results
	it('empty search input returns no results (not all playlists)', async () => {
		const query: SearchQuery = { query: '', mode: 'track' };
		const results = await searchPlaylists(query, exec);

		expect(results.items).toHaveLength(0);
		expect(results.totalMatches).toBe(0);
	});

	it('whitespace-only search returns no results', async () => {
		const query: SearchQuery = { query: '   ', mode: 'artist' };
		const results = await searchPlaylists(query, exec);

		expect(results.items).toHaveLength(0);
	});
});
