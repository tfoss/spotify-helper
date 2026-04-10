/**
 * Tests for genre distribution analytics module.
 *
 * Covers:
 * - upsertArtistGenres — inserts genre tags for artists
 * - getGenreDistributionAll — aggregates genres across all playlists
 * - getGenreDistributionForPlaylist — aggregates genres for a specific playlist
 * - normalizeGenre — capitalizes genre names
 * - collapseSmallGenres — groups small genres into "Other"
 * - Schema migration v2 — artist_genres table exists in migrations
 */

import { describe, it, expect, vi } from 'vitest';
import type { DbExecutor } from '../../../src/lib/db/types';
import {
	upsertArtistGenres,
	getGenreDistributionAll,
	getGenreDistributionForPlaylist,
	normalizeGenre,
	collapseSmallGenres,
} from '../../../src/lib/analytics/genre';
import type { ChartDataPoint } from '../../../src/lib/analytics/types';
import { MIGRATIONS } from '../../../src/lib/db/migrations';
import { SCHEMA_VERSION } from '../../../src/lib/db/schema';

// ---------------------------------------------------------------------------
// upsertArtistGenres
// ---------------------------------------------------------------------------

describe('upsertArtistGenres', () => {
	it('inserts each genre for the artist', async () => {
		const exec = vi.fn().mockResolvedValue([]) as unknown as DbExecutor;

		await upsertArtistGenres(exec, 'artist-1', ['pop', 'indie', 'rock']);

		expect(exec).toHaveBeenCalledTimes(3);

		const calls = (exec as ReturnType<typeof vi.fn>).mock.calls;
		expect(calls[0][0]).toContain('INSERT OR IGNORE INTO artist_genres');
		expect(calls[0][1]).toEqual(['artist-1', 'pop']);
		expect(calls[1][1]).toEqual(['artist-1', 'indie']);
		expect(calls[2][1]).toEqual(['artist-1', 'rock']);
	});

	it('handles empty genres array', async () => {
		const exec = vi.fn().mockResolvedValue([]) as unknown as DbExecutor;

		await upsertArtistGenres(exec, 'artist-1', []);

		expect(exec).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// getGenreDistributionAll
// ---------------------------------------------------------------------------

describe('getGenreDistributionAll', () => {
	it('returns genre data sorted by count', async () => {
		const exec = vi.fn()
			.mockResolvedValueOnce([
				{ genre: 'pop', count: 25 },
				{ genre: 'rock', count: 15 },
				{ genre: 'indie', count: 10 },
			])
			.mockResolvedValueOnce([{ total: 100 }]) as unknown as DbExecutor;

		const result = await getGenreDistributionAll(exec);

		expect(result.data).toHaveLength(3);
		expect(result.data[0]).toEqual({ label: 'pop', value: 25 });
		expect(result.data[1]).toEqual({ label: 'rock', value: 15 });
		expect(result.totalTagged).toBe(50);
		expect(result.totalTracks).toBe(100);
		expect(result.scopeLabel).toBe('All Playlists');
	});

	it('returns empty data when no genres exist', async () => {
		const exec = vi.fn()
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ total: 0 }]) as unknown as DbExecutor;

		const result = await getGenreDistributionAll(exec);

		expect(result.data).toEqual([]);
		expect(result.totalTagged).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// getGenreDistributionForPlaylist
// ---------------------------------------------------------------------------

describe('getGenreDistributionForPlaylist', () => {
	it('scopes query to a specific playlist', async () => {
		const exec = vi.fn()
			.mockResolvedValueOnce([{ genre: 'electronic', count: 8 }])
			.mockResolvedValueOnce([{ total: 20 }])
			.mockResolvedValueOnce([{ name: 'My EDM Mix' }]) as unknown as DbExecutor;

		const result = await getGenreDistributionForPlaylist(exec, 'playlist-xyz');

		expect(result.data[0]).toEqual({ label: 'electronic', value: 8 });
		expect(result.totalTracks).toBe(20);
		expect(result.scopeLabel).toBe('My EDM Mix');

		// Verify playlist_id parameter was passed
		const [, params] = (exec as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
		expect(params[0]).toBe('playlist-xyz');
	});

	it('falls back to "Unknown Playlist" if name not found', async () => {
		const exec = vi.fn()
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ total: 0 }])
			.mockResolvedValueOnce([]) as unknown as DbExecutor;

		const result = await getGenreDistributionForPlaylist(exec, 'nonexistent');

		expect(result.scopeLabel).toBe('Unknown Playlist');
	});
});

// ---------------------------------------------------------------------------
// normalizeGenre
// ---------------------------------------------------------------------------

describe('normalizeGenre', () => {
	it('capitalizes first letter of each word', () => {
		expect(normalizeGenre('indie pop')).toBe('Indie Pop');
		expect(normalizeGenre('hip hop')).toBe('Hip Hop');
	});

	it('handles single word genres', () => {
		expect(normalizeGenre('rock')).toBe('Rock');
		expect(normalizeGenre('pop')).toBe('Pop');
	});

	it('trims whitespace', () => {
		expect(normalizeGenre('  indie  ')).toBe('Indie');
	});

	it('lowercases before capitalizing', () => {
		expect(normalizeGenre('ELECTRONIC')).toBe('Electronic');
		expect(normalizeGenre('Alt ROCK')).toBe('Alt Rock');
	});
});

// ---------------------------------------------------------------------------
// collapseSmallGenres
// ---------------------------------------------------------------------------

describe('collapseSmallGenres', () => {
	it('returns data unchanged when fewer than topN', () => {
		const data: ChartDataPoint[] = [
			{ label: 'pop', value: 10 },
			{ label: 'rock', value: 5 },
		];

		const result = collapseSmallGenres(data, 8);

		expect(result).toEqual(data);
	});

	it('collapses genres beyond topN into Other', () => {
		const data: ChartDataPoint[] = [
			{ label: 'pop', value: 20 },
			{ label: 'rock', value: 15 },
			{ label: 'indie', value: 10 },
			{ label: 'jazz', value: 3 },
			{ label: 'blues', value: 2 },
		];

		const result = collapseSmallGenres(data, 3);

		expect(result).toHaveLength(4);
		expect(result[0].label).toBe('pop');
		expect(result[1].label).toBe('rock');
		expect(result[2].label).toBe('indie');
		expect(result[3]).toEqual({ label: 'Other', value: 5 });
	});

	it('returns exact topN when data length equals topN', () => {
		const data: ChartDataPoint[] = [
			{ label: 'a', value: 3 },
			{ label: 'b', value: 2 },
			{ label: 'c', value: 1 },
		];

		const result = collapseSmallGenres(data, 3);

		expect(result).toEqual(data);
	});

	it('defaults to topN=8', () => {
		const data: ChartDataPoint[] = Array.from({ length: 12 }, (_, i) => ({
			label: `genre-${i}`,
			value: 12 - i,
		}));

		const result = collapseSmallGenres(data);

		expect(result).toHaveLength(9); // 8 + Other
		expect(result[8].label).toBe('Other');
	});
});

// ---------------------------------------------------------------------------
// Schema migration v2
// ---------------------------------------------------------------------------

describe('artist_genres schema migration', () => {
	it('SCHEMA_VERSION is at least 2', () => {
		expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(2);
	});

	it('MIGRATIONS includes a v2 migration for artist_genres', () => {
		const v2 = MIGRATIONS.find((m) => m.version === 2);
		expect(v2).toBeDefined();
		expect(v2!.label).toContain('genre');
	});

	it('v2 migration creates artist_genres table', () => {
		const v2 = MIGRATIONS.find((m) => m.version === 2);
		const hasCreateTable = v2!.statements.some((s) =>
			s.includes('CREATE TABLE IF NOT EXISTS artist_genres'),
		);
		expect(hasCreateTable).toBe(true);
	});

	it('v2 migration creates genre index', () => {
		const v2 = MIGRATIONS.find((m) => m.version === 2);
		const hasIndex = v2!.statements.some((s) =>
			s.includes('CREATE INDEX IF NOT EXISTS idx_artist_genres_genre'),
		);
		expect(hasIndex).toBe(true);
	});
});
