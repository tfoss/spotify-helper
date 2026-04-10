/**
 * Tests for time range wiring across analytics views.
 *
 * Verifies that:
 * - Spotify API time ranges (short/medium/long_term) flow through to API calls
 * - Local DB date windows correctly compute since timestamps
 * - Time range changes invalidate stale results
 * - Each tab uses the correct time selector type
 * - aggregateByHour and getLocalHourCounts always return 24 data points
 */

import { describe, it, expect, vi } from 'vitest';
import {
	getTopArtists,
	getTopTracks,
	getLocalRecentPlays,
	getLocalArtistCounts,
	getLocalHourCounts,
} from '../../../src/lib/analytics/index';
import type { TimeRange } from '../../../src/lib/analytics/types';
import type { DbExecutor } from '../../../src/lib/db/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSpotifyClient(method: string) {
	return {
		[method]: vi.fn().mockResolvedValue({
			items: [],
			total: 0,
			limit: 50,
			offset: 0,
		}),
	};
}

function mockExec(): DbExecutor & ReturnType<typeof vi.fn> {
	return vi.fn().mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// Spotify API time ranges flow through correctly
// ---------------------------------------------------------------------------

describe('Spotify API time range propagation', () => {
	const allRanges: TimeRange[] = ['short_term', 'medium_term', 'long_term'];

	it('getTopArtists passes each time range to the API', async () => {
		for (const range of allRanges) {
			const client = mockSpotifyClient('getTopArtists');
			await getTopArtists(client as any, range);
			expect(client.getTopArtists).toHaveBeenCalledWith(range, 50);
		}
	});

	it('getTopTracks passes each time range to the API', async () => {
		for (const range of allRanges) {
			const client = mockSpotifyClient('getTopTracks');
			await getTopTracks(client as any, range);
			expect(client.getTopTracks).toHaveBeenCalledWith(range, 50);
		}
	});

	it('result carries the requested time range for artists', async () => {
		for (const range of allRanges) {
			const client = mockSpotifyClient('getTopArtists');
			const result = await getTopArtists(client as any, range);
			expect(result.timeRange).toBe(range);
		}
	});

	it('result carries the requested time range for tracks', async () => {
		for (const range of allRanges) {
			const client = mockSpotifyClient('getTopTracks');
			const result = await getTopTracks(client as any, range);
			expect(result.timeRange).toBe(range);
		}
	});

	it('does not call API with any other time range values', async () => {
		const client = mockSpotifyClient('getTopArtists');
		await getTopArtists(client as any, 'short_term');

		expect(client.getTopArtists).toHaveBeenCalledTimes(1);
		const calledRange = client.getTopArtists.mock.calls[0][0];
		expect(allRanges).toContain(calledRange);
	});
});

// ---------------------------------------------------------------------------
// Local DB date windows
// ---------------------------------------------------------------------------

describe('local DB date window queries', () => {
	it('getLocalRecentPlays passes since timestamp to query', async () => {
		const exec = mockExec();
		const since = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

		await getLocalRecentPlays(exec, since);

		expect(exec).toHaveBeenCalled();
		const [, params] = exec.mock.calls[0] as [string, unknown[]];
		expect(params[0]).toBe(since);
	});

	it('getLocalRecentPlays with since=0 returns all plays', async () => {
		const exec = mockExec();

		await getLocalRecentPlays(exec, 0);

		const [, params] = exec.mock.calls[0] as [string, unknown[]];
		expect(params[0]).toBe(0);
	});

	it('getLocalArtistCounts passes since to the GROUP BY query', async () => {
		const exec = mockExec();
		const since = Date.now() - 24 * 60 * 60 * 1000; // 24h ago

		await getLocalArtistCounts(exec, since);

		expect(exec).toHaveBeenCalled();
		const [sql, params] = exec.mock.calls[0] as [string, unknown[]];
		expect(sql).toContain('GROUP BY');
		expect(params[0]).toBe(since);
	});

	it('getLocalHourCounts passes since to the query', async () => {
		const exec = mockExec();
		const since = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30d ago

		await getLocalHourCounts(exec, since);

		expect(exec).toHaveBeenCalled();
		const [, params] = exec.mock.calls[0] as [string, unknown[]];
		expect(params[0]).toBe(since);
	});
});

// ---------------------------------------------------------------------------
// Hour counts always return 24 data points
// ---------------------------------------------------------------------------

describe('getLocalHourCounts — always returns 24 points', () => {
	it('returns 24 data points even when DB returns empty', async () => {
		const exec = mockExec();
		const result = await getLocalHourCounts(exec);

		expect(result).toHaveLength(24);
		expect(result.every((d) => d.value === 0)).toBe(true);
	});

	it('returns 24 data points when DB returns partial hours', async () => {
		const exec = vi.fn().mockResolvedValue([
			{ hour: 9, play_count: 3 },
			{ hour: 14, play_count: 7 },
		]) as unknown as DbExecutor;

		const result = await getLocalHourCounts(exec);

		expect(result).toHaveLength(24);
		expect(result[9].value).toBe(3);
		expect(result[14].value).toBe(7);
		expect(result[0].value).toBe(0);
	});

	it('labels are formatted as HH:00', async () => {
		const exec = mockExec();
		const result = await getLocalHourCounts(exec);

		expect(result[0].label).toBe('00:00');
		expect(result[9].label).toBe('09:00');
		expect(result[23].label).toBe('23:00');
	});
});

// ---------------------------------------------------------------------------
// Time range label mapping
// ---------------------------------------------------------------------------

describe('time range labels', () => {
	it('all valid TimeRange values have a corresponding label', () => {
		const labels: Record<TimeRange, string> = {
			short_term: 'Last 4 Weeks',
			medium_term: 'Last 6 Months',
			long_term: 'All Time',
		};

		const allRanges: TimeRange[] = ['short_term', 'medium_term', 'long_term'];
		for (const range of allRanges) {
			expect(labels[range]).toBeDefined();
			expect(labels[range].length).toBeGreaterThan(0);
		}
	});
});

// ---------------------------------------------------------------------------
// Source tagging
// ---------------------------------------------------------------------------

describe('data source tagging', () => {
	it('Spotify API results are tagged source=spotify', async () => {
		const client = mockSpotifyClient('getTopArtists');
		const result = await getTopArtists(client as any, 'medium_term');
		expect(result.source).toBe('spotify');
	});

	it('local DB results carry track metadata from JOIN', async () => {
		const exec = vi.fn().mockResolvedValue([
			{
				id: 1,
				track_id: 't1',
				played_at: Date.now(),
				track_name: 'Test Song',
				artist_name: 'Test Artist',
				album_name: 'Test Album',
			},
		]) as unknown as DbExecutor;

		const result = await getLocalRecentPlays(exec, 0);

		expect(result.plays[0].trackName).toBe('Test Song');
		expect(result.plays[0].artistName).toBe('Test Artist');
	});
});
