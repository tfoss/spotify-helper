/**
 * Tests for the fuzzy search module.
 *
 * Covers: levenshteinDistance, tokenScore, fuzzyScore, fuzzyFilterTracks,
 * and integration with searchPlaylists (fuzzy mode).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	levenshteinDistance,
	tokenScore,
	fuzzyScore,
	fuzzyFilterTracks,
	FUZZY_THRESHOLD,
} from '../../../src/lib/search/fuzzy';
import { searchPlaylists } from '../../../src/lib/search/index';
import type { TrackRow } from '../../../src/lib/db/types';
import type { DbExecutor } from '../../../src/lib/db/types';
import type { SearchQuery } from '../../../src/lib/search/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrack(id: string, name: string, artistName: string): TrackRow {
	return {
		id,
		name,
		name_lower: name.toLowerCase(),
		artist_name: artistName,
		artist_lower: artistName.toLowerCase(),
		artist_id: null,
		album_name: 'Test Album',
		duration_ms: 200000,
		popularity: 50,
		release_date: '2024-01-01',
	};
}

// ---------------------------------------------------------------------------
// levenshteinDistance
// ---------------------------------------------------------------------------

describe('levenshteinDistance', () => {
	it('returns 0 for identical strings', () => {
		expect(levenshteinDistance('hello', 'hello')).toBe(0);
	});

	it('returns length of second string when first is empty', () => {
		expect(levenshteinDistance('', 'abc')).toBe(3);
	});

	it('returns length of first string when second is empty', () => {
		expect(levenshteinDistance('abc', '')).toBe(3);
	});

	it('returns 1 for single substitution', () => {
		expect(levenshteinDistance('cat', 'bat')).toBe(1);
	});

	it('returns 1 for single insertion', () => {
		expect(levenshteinDistance('cat', 'cats')).toBe(1);
	});

	it('returns 1 for single deletion', () => {
		expect(levenshteinDistance('cats', 'cat')).toBe(1);
	});

	it('handles typical typo: beatels → beatles', () => {
		// beatels → beatles: one substitution (a→l, l→e, s→s = actually let's compute)
		// beatels (7) vs beatles (7): e-a-t-e-l-s vs e-a-t-l-e-s — 2 transpositions
		const dist = levenshteinDistance('beatels', 'beatles');
		expect(dist).toBeGreaterThan(0);
		expect(dist).toBeLessThanOrEqual(2);
	});

	it('is symmetric', () => {
		expect(levenshteinDistance('abc', 'xyz')).toBe(levenshteinDistance('xyz', 'abc'));
	});
});

// ---------------------------------------------------------------------------
// tokenScore
// ---------------------------------------------------------------------------

describe('tokenScore', () => {
	it('returns 1.0 when query is substring of token', () => {
		expect(tokenScore('beatles', 'beat')).toBe(1.0);
	});

	it('returns 1.0 for exact match', () => {
		expect(tokenScore('queen', 'queen')).toBe(1.0);
	});

	it('returns high score for near-match', () => {
		// 'beatels' vs 'beatles' — small edit distance
		const score = tokenScore('beatles', 'beatels');
		expect(score).toBeGreaterThan(0.7);
	});

	it('returns low score for very different strings', () => {
		const score = tokenScore('zebra', 'queen');
		expect(score).toBeLessThan(0.5);
	});
});

// ---------------------------------------------------------------------------
// fuzzyScore
// ---------------------------------------------------------------------------

describe('fuzzyScore', () => {
	it('returns 1.0 for exact substring match', () => {
		expect(fuzzyScore('The Beatles', 'beatles')).toBe(1.0);
	});

	it('returns 1.0 for case-insensitive substring', () => {
		expect(fuzzyScore('The Beatles', 'BEATLES')).toBe(1.0);
	});

	it('typo "beatels" scores highly against "The Beatles"', () => {
		const score = fuzzyScore('The Beatles', 'beatels');
		expect(score).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
	});

	it('returns 0 for empty query', () => {
		expect(fuzzyScore('The Beatles', '')).toBe(0);
	});

	it('returns 0 for empty text', () => {
		expect(fuzzyScore('', 'beatles')).toBe(0);
	});

	it('scores well for single-token artist names with a typo', () => {
		const score = fuzzyScore('Queen', 'queem');
		expect(score).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
	});
});

// ---------------------------------------------------------------------------
// fuzzyFilterTracks — typo returns correct result
// ---------------------------------------------------------------------------

describe('fuzzyFilterTracks', () => {
	const tracks: TrackRow[] = [
		makeTrack('t1', 'Yesterday', 'The Beatles'),
		makeTrack('t2', 'Bohemian Rhapsody', 'Queen'),
		makeTrack('t3', 'Stairway to Heaven', 'Led Zeppelin'),
		makeTrack('t4', 'Hotel California', 'Eagles'),
	];

	it('typo "beatels" returns The Beatles track', () => {
		const results = fuzzyFilterTracks(tracks, 'beatels');
		const ids = results.map((r) => r.track.id);
		expect(ids).toContain('t1');
	});

	it('typo "queem" returns Queen track', () => {
		const results = fuzzyFilterTracks(tracks, 'queem');
		const ids = results.map((r) => r.track.id);
		expect(ids).toContain('t2');
	});

	it('exact match ranks above fuzzy match', () => {
		// 'queen' exact matches 't2', fuzzy score for others should be lower
		const results = fuzzyFilterTracks(tracks, 'queen');
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].track.id).toBe('t2');
		expect(results[0].score).toBeGreaterThanOrEqual(1.0);
	});

	it('returns results sorted by score descending', () => {
		const results = fuzzyFilterTracks(tracks, 'queen');
		for (let i = 1; i < results.length; i++) {
			expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
		}
	});

	it('empty query returns empty array', () => {
		expect(fuzzyFilterTracks(tracks, '')).toHaveLength(0);
	});

	it('whitespace-only query returns empty array', () => {
		expect(fuzzyFilterTracks(tracks, '   ')).toHaveLength(0);
	});

	it('filters out tracks below threshold', () => {
		// 'xyz' should not match any track name or artist
		const results = fuzzyFilterTracks(tracks, 'xyzqrs');
		expect(results).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Integration: searchPlaylists with fuzzy: true
// ---------------------------------------------------------------------------

describe('searchPlaylists — fuzzy mode', () => {
	const tracks: TrackRow[] = [
		makeTrack('t1', 'Yesterday', 'The Beatles'),
		makeTrack('t2', 'Bohemian Rhapsody', 'Queen'),
		makeTrack('t3', 'Stairway to Heaven', 'Led Zeppelin'),
	];

	const playlists = [
		{ id: 'p1', name: 'Classic Rock', owner: 'user', snapshot_id: 'snap', image_url: null, synced_at: 0 },
		{ id: 'p2', name: 'Beatles Hits', owner: 'user', snapshot_id: 'snap', image_url: null, synced_at: 0 },
	];

	const links = [
		{ playlist_id: 'p2', track_id: 't1' },
		{ playlist_id: 'p1', track_id: 't2' },
		{ playlist_id: 'p1', track_id: 't3' },
	];

	const exec: DbExecutor = async (sql: string, params?: unknown[]) => {
		const norm = sql.replace(/\s+/g, ' ').trim();

		// getAllTracks
		if (norm.includes('SELECT * FROM tracks ORDER BY name_lower')) {
			return tracks as unknown as Record<string, unknown>[];
		}

		// getPlaylistsForTrack
		if (norm.includes('FROM playlists p') && norm.includes('playlist_tracks pt')) {
			const trackId = params?.[0] as string;
			const playlistIds = links.filter((l) => l.track_id === trackId).map((l) => l.playlist_id);
			return playlists.filter((p) => playlistIds.includes(p.id)) as unknown as Record<string, unknown>[];
		}

		return [];
	};

	it('typo "beatels" finds The Beatles track via fuzzy search', async () => {
		const query: SearchQuery = { query: 'beatels', mode: 'unified', fuzzy: true };
		const results = await searchPlaylists(query, exec);

		const trackIds = results.items.map((i) => i.trackId);
		expect(trackIds).toContain('t1');
	});

	it('fuzzy results have matchType "fuzzy"', async () => {
		const query: SearchQuery = { query: 'beatels', mode: 'unified', fuzzy: true };
		const results = await searchPlaylists(query, exec);

		expect(results.items.every((i) => i.matchType === 'fuzzy')).toBe(true);
	});

	it('fuzzy results include fuzzyScore', async () => {
		const query: SearchQuery = { query: 'queen', mode: 'unified', fuzzy: true };
		const results = await searchPlaylists(query, exec);

		expect(results.items.length).toBeGreaterThan(0);
		expect(results.items[0].fuzzyScore).toBeGreaterThan(0);
	});

	it('exact match ranks above fuzzy match in results order', async () => {
		// Both 'queen' (exact) and other tracks might match, but Queen should come first
		const query: SearchQuery = { query: 'queen', mode: 'unified', fuzzy: true };
		const results = await searchPlaylists(query, exec);

		if (results.items.length > 1) {
			// Queen track should appear first (highest score)
			expect(results.items[0].trackId).toBe('t2');
		}
	});

	it('empty query returns no results in fuzzy mode', async () => {
		const query: SearchQuery = { query: '', mode: 'unified', fuzzy: true };
		const results = await searchPlaylists(query, exec);
		expect(results.items).toHaveLength(0);
	});
});
