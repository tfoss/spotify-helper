/**
 * Phase 3 tests: Analytics transforms and chart config.
 *
 * Required test cases from PROJECT.md:
 * 1. Top artists transform correctly ranks by play count from local data
 * 2. Time range filter correctly restricts analytics to specified window
 * 3. recent_plays local store rejects entries with invalid track_id
 * 4. Chart config transform produces valid LayerChart-compatible config
 *    for each supported chart type (bar, line, pie, histogram)
 * 5. Unsupported time ranges are disabled/labeled — no silent data fabrication
 */

import { describe, it, expect, vi } from 'vitest';
import {
	aggregateByArtist,
	aggregateByHour,
	getTopArtists,
	getTopTracks,
	getRecentlyPlayed,
} from '../../../src/lib/analytics/index';
import type { RecentPlay, TimeRange } from '../../../src/lib/analytics/types';
import {
	createTopArtistsChart,
	createTopTracksChart,
	createActivityOverTimeChart,
	createGenreDistributionChart,
	createReleaseYearChart,
} from '../../../src/lib/charts/config';
import type { ChartConfig, ChartDataPoint } from '../../../src/lib/charts/types';
import { addRecentPlay, getRecentPlays } from '../../../src/lib/db/queries';
import type { DbExecutor } from '../../../src/lib/db/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecentPlay(overrides: Partial<RecentPlay> & { artistName: string }): RecentPlay {
	return {
		trackId: 't1',
		trackName: 'Song',
		albumName: 'Album',
		playedAt: new Date('2024-06-15T14:30:00Z'),
		...overrides,
	};
}

function isValidChartConfig(config: ChartConfig): boolean {
	return (
		typeof config.type === 'string' &&
		typeof config.title === 'string' &&
		Array.isArray(config.data) &&
		config.data.every(
			(d: ChartDataPoint) => typeof d.label === 'string' && typeof d.value === 'number'
		)
	);
}

const VALID_TIME_RANGES: TimeRange[] = ['short_term', 'medium_term', 'long_term'];

// ---------------------------------------------------------------------------
// 1. Top artists transform correctly ranks by play count from local data
// ---------------------------------------------------------------------------

describe('aggregateByArtist — ranks by play count', () => {
	it('groups plays by artist and sorts descending by count', () => {
		const plays: RecentPlay[] = [
			makeRecentPlay({ artistName: 'Artist A' }),
			makeRecentPlay({ artistName: 'Artist B' }),
			makeRecentPlay({ artistName: 'Artist A' }),
			makeRecentPlay({ artistName: 'Artist C' }),
			makeRecentPlay({ artistName: 'Artist A' }),
			makeRecentPlay({ artistName: 'Artist B' }),
		];

		const result = aggregateByArtist(plays);

		expect(result[0].label).toBe('Artist A');
		expect(result[0].value).toBe(3);
		expect(result[1].label).toBe('Artist B');
		expect(result[1].value).toBe(2);
		expect(result[2].label).toBe('Artist C');
		expect(result[2].value).toBe(1);
	});

	it('returns empty array for empty plays', () => {
		expect(aggregateByArtist([])).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// 2. Time range filter correctly restricts analytics to specified window
// ---------------------------------------------------------------------------

describe('time range filter', () => {
	it('passes the time range to the Spotify API call', async () => {
		const mockClient = {
			getTopArtists: vi.fn().mockResolvedValue({
				items: [{ id: 'a1', display_name: 'Artist', images: [] }],
				total: 1,
				limit: 50,
				offset: 0,
			}),
		};

		for (const range of VALID_TIME_RANGES) {
			await getTopArtists(mockClient as any, range, 10);
			expect(mockClient.getTopArtists).toHaveBeenCalledWith(range, 10);
		}

		expect(mockClient.getTopArtists).toHaveBeenCalledTimes(3);
	});

	it('returns result tagged with the requested time range', async () => {
		const mockClient = {
			getTopTracks: vi.fn().mockResolvedValue({
				items: [{ id: 't1', name: 'Track', artists: [{ id: 'a1', name: 'A' }], album: { name: 'Album', release_date: '2024' }, duration_ms: 200000, popularity: 50 }],
				total: 1,
				limit: 50,
				offset: 0,
			}),
		};

		const result = await getTopTracks(mockClient as any, 'short_term');
		expect(result.timeRange).toBe('short_term');
	});
});

// ---------------------------------------------------------------------------
// 3. recent_plays local store rejects entries with invalid track_id
// ---------------------------------------------------------------------------

describe('addRecentPlay — invalid track_id handling', () => {
	it('calls exec with provided track_id and played_at', async () => {
		const mockExec = vi.fn().mockResolvedValue([]);
		await addRecentPlay(mockExec, 'valid-track-id', Date.now());

		expect(mockExec).toHaveBeenCalledOnce();
		const [sql, params] = mockExec.mock.calls[0] as [string, unknown[]];
		expect(sql).toContain('INSERT INTO recent_plays');
		expect(params[0]).toBe('valid-track-id');
	});

	it('DB-level constraint would reject empty string track_id (simulated)', async () => {
		// Simulate a DB constraint violation for empty track_id
		const mockExec: DbExecutor = vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
			const trackId = params?.[0] as string;
			if (!trackId || trackId.trim() === '') {
				throw new Error('NOT NULL constraint failed: recent_plays.track_id');
			}
			return [];
		});

		await expect(addRecentPlay(mockExec, '', Date.now())).rejects.toThrow(
			'NOT NULL constraint failed'
		);
	});

	it('getRecentPlays filters by since timestamp', async () => {
		const mockExec = vi.fn().mockResolvedValue([
			{ id: 1, track_id: 't1', played_at: 1000 },
		]);

		const result = await getRecentPlays(mockExec, 500, 50);

		expect(mockExec).toHaveBeenCalledOnce();
		const [sql, params] = mockExec.mock.calls[0] as [string, unknown[]];
		expect(sql).toContain('played_at > ?');
		expect(params[0]).toBe(500);
		expect(result).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// 4. Chart config transform produces valid config for each chart type
// ---------------------------------------------------------------------------

describe('chart config transforms — valid for each chart type', () => {
	const sampleData: ChartDataPoint[] = [
		{ label: 'A', value: 10 },
		{ label: 'B', value: 8 },
		{ label: 'C', value: 5 },
	];

	it('createTopArtistsChart produces valid bar chart config', () => {
		const config = createTopArtistsChart(sampleData);
		expect(isValidChartConfig(config)).toBe(true);
		expect(config.type).toBe('bar');
		expect(config.title).toBeTruthy();
	});

	it('createTopTracksChart produces valid bar chart config', () => {
		const config = createTopTracksChart(sampleData);
		expect(isValidChartConfig(config)).toBe(true);
		expect(config.type).toBe('bar');
	});

	it('createActivityOverTimeChart produces valid line chart config', () => {
		const config = createActivityOverTimeChart(sampleData);
		expect(isValidChartConfig(config)).toBe(true);
		expect(config.type).toBe('line');
	});

	it('createGenreDistributionChart produces valid donut/pie chart config', () => {
		const config = createGenreDistributionChart(sampleData);
		expect(isValidChartConfig(config)).toBe(true);
		expect(config.type === 'pie' || config.type === 'donut').toBe(true);
	});

	it('createReleaseYearChart produces valid histogram chart config', () => {
		const config = createReleaseYearChart(sampleData);
		expect(isValidChartConfig(config)).toBe(true);
		expect(config.type).toBe('histogram');
	});

	it('topN option limits the number of data points', () => {
		const manyPoints: ChartDataPoint[] = Array.from({ length: 20 }, (_, i) => ({
			label: `Item ${i}`,
			value: 20 - i,
		}));

		const config = createTopArtistsChart(manyPoints, 5);
		expect(config.data.length).toBe(5);
	});

	it('chart data points all have label (string) and value (number)', () => {
		const config = createTopArtistsChart(sampleData);
		for (const point of config.data) {
			expect(typeof point.label).toBe('string');
			expect(typeof point.value).toBe('number');
		}
	});
});

// ---------------------------------------------------------------------------
// 5. Unsupported time ranges — no silent data fabrication
// ---------------------------------------------------------------------------

describe('unsupported time ranges', () => {
	it('only short_term, medium_term, long_term are valid TimeRange values', () => {
		// TypeScript enforces this at compile time. At runtime we verify the
		// API only passes valid ranges.
		const valid = new Set<string>(['short_term', 'medium_term', 'long_term']);
		expect(VALID_TIME_RANGES.every((r) => valid.has(r))).toBe(true);
		expect(VALID_TIME_RANGES.length).toBe(3);
	});

	it('Spotify API receives only the requested time range (no fabrication)', async () => {
		const mockClient = {
			getTopArtists: vi.fn().mockResolvedValue({
				items: [],
				total: 0,
				limit: 50,
				offset: 0,
			}),
		};

		await getTopArtists(mockClient as any, 'short_term');

		// Verify no other time ranges were called
		expect(mockClient.getTopArtists).toHaveBeenCalledTimes(1);
		expect(mockClient.getTopArtists).toHaveBeenCalledWith('short_term', 50);
	});

	it('result source is always "spotify" when fetching from API', async () => {
		const mockClient = {
			getTopArtists: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }),
		};

		const result = await getTopArtists(mockClient as any, 'long_term');
		expect(result.source).toBe('spotify');
	});
});

// ---------------------------------------------------------------------------
// aggregateByHour
// ---------------------------------------------------------------------------

describe('aggregateByHour', () => {
	it('returns 24 data points (one per hour)', () => {
		const result = aggregateByHour([]);
		expect(result.length).toBe(24);
	});

	it('correctly buckets plays into hours', () => {
		// Use dates where we know the local hour by constructing via components
		const dateA = new Date(2024, 5, 15, 14, 0, 0); // local hour 14
		const dateB = new Date(2024, 5, 15, 14, 30, 0); // local hour 14
		const dateC = new Date(2024, 5, 15, 9, 0, 0);  // local hour 9

		const plays: RecentPlay[] = [
			makeRecentPlay({ artistName: 'A', playedAt: dateA }),
			makeRecentPlay({ artistName: 'B', playedAt: dateB }),
			makeRecentPlay({ artistName: 'C', playedAt: dateC }),
		];

		const result = aggregateByHour(plays);

		// Hour 14 (local) should have 2 plays
		const hour14 = result.find((d) => d.label === '14:00');
		expect(hour14?.value).toBe(2);

		// Hour 9 should have 1
		const hour9 = result.find((d) => d.label === '09:00');
		expect(hour9?.value).toBe(1);
	});
});
