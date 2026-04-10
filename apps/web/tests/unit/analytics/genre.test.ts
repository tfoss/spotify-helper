/**
 * Unit tests for genre distribution analytics.
 *
 * Tests cover:
 * - aggregateGenres: counting, sorting, normalization, deduplication
 * - extractArtistIds: extraction and deduplication
 * - Edge cases: empty inputs, artists with no genres
 */

import { describe, it, expect } from 'vitest';
import { aggregateGenres, extractArtistIds } from '../../../src/lib/analytics/genre';
import type { SpotifyFullArtist } from '../../../src/lib/spotify/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArtist(overrides: Partial<SpotifyFullArtist> & { genres: string[] }): SpotifyFullArtist {
	return {
		id: 'artist-1',
		name: 'Test Artist',
		images: [],
		popularity: 50,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// aggregateGenres
// ---------------------------------------------------------------------------

describe('aggregateGenres', () => {
	it('counts genres across multiple artists', () => {
		const artists = [
			makeArtist({ id: 'a1', genres: ['rock', 'indie'] }),
			makeArtist({ id: 'a2', genres: ['rock', 'pop'] }),
			makeArtist({ id: 'a3', genres: ['indie', 'alternative'] }),
		];

		const result = aggregateGenres(artists);

		const rockEntry = result.find((g) => g.label === 'rock');
		expect(rockEntry?.value).toBe(2);

		const indieEntry = result.find((g) => g.label === 'indie');
		expect(indieEntry?.value).toBe(2);

		const popEntry = result.find((g) => g.label === 'pop');
		expect(popEntry?.value).toBe(1);

		const altEntry = result.find((g) => g.label === 'alternative');
		expect(altEntry?.value).toBe(1);
	});

	it('sorts results descending by count', () => {
		const artists = [
			makeArtist({ id: 'a1', genres: ['pop'] }),
			makeArtist({ id: 'a2', genres: ['rock', 'pop'] }),
			makeArtist({ id: 'a3', genres: ['rock', 'pop', 'indie'] }),
		];

		const result = aggregateGenres(artists);

		expect(result[0].label).toBe('pop');
		expect(result[0].value).toBe(3);
		expect(result[1].label).toBe('rock');
		expect(result[1].value).toBe(2);
		expect(result[2].label).toBe('indie');
		expect(result[2].value).toBe(1);
	});

	it('normalizes genre names to lowercase', () => {
		const artists = [
			makeArtist({ id: 'a1', genres: ['Rock'] }),
			makeArtist({ id: 'a2', genres: ['ROCK'] }),
			makeArtist({ id: 'a3', genres: ['rock'] }),
		];

		const result = aggregateGenres(artists);

		expect(result).toHaveLength(1);
		expect(result[0].label).toBe('rock');
		expect(result[0].value).toBe(3);
	});

	it('trims whitespace from genre names', () => {
		const artists = [
			makeArtist({ id: 'a1', genres: ['  indie  '] }),
			makeArtist({ id: 'a2', genres: ['indie'] }),
		];

		const result = aggregateGenres(artists);
		expect(result).toHaveLength(1);
		expect(result[0].label).toBe('indie');
		expect(result[0].value).toBe(2);
	});

	it('skips empty genre strings', () => {
		const artists = [
			makeArtist({ id: 'a1', genres: ['rock', '', '  '] }),
		];

		const result = aggregateGenres(artists);
		expect(result).toHaveLength(1);
		expect(result[0].label).toBe('rock');
	});

	it('returns empty array for empty input', () => {
		expect(aggregateGenres([])).toEqual([]);
	});

	it('returns empty array when all artists have no genres', () => {
		const artists = [
			makeArtist({ id: 'a1', genres: [] }),
			makeArtist({ id: 'a2', genres: [] }),
		];

		expect(aggregateGenres(artists)).toEqual([]);
	});

	it('handles single artist with single genre', () => {
		const artists = [makeArtist({ id: 'a1', genres: ['jazz'] })];

		const result = aggregateGenres(artists);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({ label: 'jazz', value: 1 });
	});

	it('handles artists with many genres', () => {
		const genres = Array.from({ length: 20 }, (_, i) => `genre-${i}`);
		const artists = [makeArtist({ id: 'a1', genres })];

		const result = aggregateGenres(artists);
		expect(result).toHaveLength(20);
	});

	it('all results have label (string) and value (number)', () => {
		const artists = [
			makeArtist({ id: 'a1', genres: ['rock', 'pop'] }),
			makeArtist({ id: 'a2', genres: ['pop', 'electronic'] }),
		];

		const result = aggregateGenres(artists);
		for (const point of result) {
			expect(typeof point.label).toBe('string');
			expect(typeof point.value).toBe('number');
			expect(point.value).toBeGreaterThan(0);
		}
	});
});

// ---------------------------------------------------------------------------
// extractArtistIds
// ---------------------------------------------------------------------------

describe('extractArtistIds', () => {
	it('extracts unique artist IDs from tracks', () => {
		const tracks = [
			{ artists: [{ id: 'a1' }, { id: 'a2' }] },
			{ artists: [{ id: 'a2' }, { id: 'a3' }] },
			{ artists: [{ id: 'a1' }] },
		];

		const ids = extractArtistIds(tracks);
		expect(ids).toHaveLength(3);
		expect(new Set(ids)).toEqual(new Set(['a1', 'a2', 'a3']));
	});

	it('deduplicates artist IDs', () => {
		const tracks = [
			{ artists: [{ id: 'a1' }] },
			{ artists: [{ id: 'a1' }] },
			{ artists: [{ id: 'a1' }] },
		];

		const ids = extractArtistIds(tracks);
		expect(ids).toHaveLength(1);
		expect(ids[0]).toBe('a1');
	});

	it('returns empty array for empty tracks', () => {
		expect(extractArtistIds([])).toEqual([]);
	});

	it('handles tracks with no artists', () => {
		const tracks = [{ artists: [] }];
		expect(extractArtistIds(tracks)).toEqual([]);
	});

	it('handles tracks with many artists (collaborations)', () => {
		const tracks = [
			{ artists: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }, { id: 'a4' }] },
		];

		const ids = extractArtistIds(tracks);
		expect(ids).toHaveLength(4);
	});
});
