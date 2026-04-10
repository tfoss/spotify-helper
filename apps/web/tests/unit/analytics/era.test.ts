/**
 * Tests for the era heatmap analytics module.
 *
 * Covers:
 * - getPlaylistSummaries — fetches playlists with track counts
 * - getEraDataAllPlaylists — aggregates release years across all playlists
 * - getEraDataForPlaylist — aggregates release years for a specific playlist
 * - computeEraSummary — derives oldest/newest year, peak decade, decade distribution
 */

import { describe, it, expect, vi } from 'vitest';
import type { DbExecutor } from '../../../src/lib/db/types';
import {
	getPlaylistSummaries,
	getEraDataAllPlaylists,
	getEraDataForPlaylist,
	computeEraSummary,
} from '../../../src/lib/analytics/era';
import type { ChartDataPoint } from '../../../src/lib/analytics/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockExec(returnValue: Record<string, unknown>[] = []): DbExecutor & ReturnType<typeof vi.fn> {
	return vi.fn().mockResolvedValue(returnValue);
}

// ---------------------------------------------------------------------------
// getPlaylistSummaries
// ---------------------------------------------------------------------------

describe('getPlaylistSummaries', () => {
	it('returns playlist summaries sorted by name', async () => {
		const exec = mockExec([
			{ id: 'p1', name: 'Chill Vibes', track_count: 25 },
			{ id: 'p2', name: 'Workout Mix', track_count: 40 },
		]);

		const result = await getPlaylistSummaries(exec);

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ id: 'p1', name: 'Chill Vibes', trackCount: 25 });
		expect(result[1]).toEqual({ id: 'p2', name: 'Workout Mix', trackCount: 40 });
	});

	it('builds correct SQL with JOIN and GROUP BY', async () => {
		const exec = mockExec();

		await getPlaylistSummaries(exec);

		const [sql] = exec.mock.calls[0] as [string];
		expect(sql).toContain('LEFT JOIN playlist_tracks');
		expect(sql).toContain('GROUP BY');
		expect(sql).toContain('ORDER BY p.name');
	});

	it('returns empty array when no playlists exist', async () => {
		const exec = mockExec();

		const result = await getPlaylistSummaries(exec);

		expect(result).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// getEraDataAllPlaylists
// ---------------------------------------------------------------------------

describe('getEraDataAllPlaylists', () => {
	it('returns chart data grouped by release year', async () => {
		const exec = mockExec([
			{ year: '2019', count: 5 },
			{ year: '2020', count: 12 },
			{ year: '2021', count: 8 },
		]);

		const result = await getEraDataAllPlaylists(exec);

		expect(result.data).toHaveLength(3);
		expect(result.data[0]).toEqual({ label: '2019', value: 5 });
		expect(result.data[1]).toEqual({ label: '2020', value: 12 });
		expect(result.totalTracks).toBe(25);
		expect(result.scopeLabel).toBe('All Playlists');
	});

	it('filters out NULL and empty release dates via SQL', async () => {
		const exec = mockExec();

		await getEraDataAllPlaylists(exec);

		const [sql] = exec.mock.calls[0] as [string];
		expect(sql).toContain("release_date IS NOT NULL");
		expect(sql).toContain("release_date != ''");
	});

	it('returns empty data when no tracks have release dates', async () => {
		const exec = mockExec();

		const result = await getEraDataAllPlaylists(exec);

		expect(result.data).toEqual([]);
		expect(result.totalTracks).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// getEraDataForPlaylist
// ---------------------------------------------------------------------------

describe('getEraDataForPlaylist', () => {
	it('scopes query to a specific playlist', async () => {
		const exec = vi.fn()
			.mockResolvedValueOnce([{ year: '2022', count: 10 }]) // data query
			.mockResolvedValueOnce([{ name: 'My Playlist' }]) as unknown as DbExecutor; // name query

		const result = await getEraDataForPlaylist(exec, 'playlist-abc');

		expect(result.data).toHaveLength(1);
		expect(result.data[0]).toEqual({ label: '2022', value: 10 });
		expect(result.totalTracks).toBe(10);
		expect(result.scopeLabel).toBe('My Playlist');

		// Verify playlist_id parameter was passed
		const [, params] = (exec as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
		expect(params[0]).toBe('playlist-abc');
	});

	it('falls back to "Unknown Playlist" if name not found', async () => {
		const exec = vi.fn()
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]) as unknown as DbExecutor;

		const result = await getEraDataForPlaylist(exec, 'nonexistent');

		expect(result.scopeLabel).toBe('Unknown Playlist');
	});
});

// ---------------------------------------------------------------------------
// computeEraSummary
// ---------------------------------------------------------------------------

describe('computeEraSummary', () => {
	it('computes oldest and newest year', () => {
		const data: ChartDataPoint[] = [
			{ label: '1995', value: 3 },
			{ label: '2005', value: 7 },
			{ label: '2020', value: 15 },
		];

		const summary = computeEraSummary(data);

		expect(summary.oldestYear).toBe('1995');
		expect(summary.newestYear).toBe('2020');
	});

	it('identifies peak decade', () => {
		const data: ChartDataPoint[] = [
			{ label: '1998', value: 2 },
			{ label: '2001', value: 5 },
			{ label: '2003', value: 8 },
			{ label: '2015', value: 3 },
		];

		const summary = computeEraSummary(data);

		expect(summary.peakDecade).toBe('2000s');
	});

	it('computes decade distribution', () => {
		const data: ChartDataPoint[] = [
			{ label: '1985', value: 1 },
			{ label: '1989', value: 2 },
			{ label: '2010', value: 5 },
			{ label: '2015', value: 3 },
		];

		const summary = computeEraSummary(data);

		expect(summary.decadeDistribution).toEqual([
			{ label: '1980s', value: 3 },
			{ label: '2010s', value: 8 },
		]);
	});

	it('returns nulls for empty data', () => {
		const summary = computeEraSummary([]);

		expect(summary.oldestYear).toBeNull();
		expect(summary.newestYear).toBeNull();
		expect(summary.peakDecade).toBeNull();
		expect(summary.decadeDistribution).toEqual([]);
	});

	it('handles single year', () => {
		const data: ChartDataPoint[] = [{ label: '2023', value: 10 }];

		const summary = computeEraSummary(data);

		expect(summary.oldestYear).toBe('2023');
		expect(summary.newestYear).toBe('2023');
		expect(summary.peakDecade).toBe('2020s');
		expect(summary.decadeDistribution).toHaveLength(1);
	});

	it('decade labels are formatted as NNN0s', () => {
		const data: ChartDataPoint[] = [
			{ label: '1972', value: 1 },
			{ label: '2003', value: 1 },
		];

		const summary = computeEraSummary(data);

		for (const d of summary.decadeDistribution) {
			expect(d.label).toMatch(/^\d{3}0s$/);
		}
	});
});
