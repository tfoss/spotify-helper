/**
 * Tests for recent_plays persistence and local analytics queries.
 *
 * Tests cover:
 * - persistRecentPlays upserts tracks and inserts play events
 * - getLocalRecentPlays returns enriched results from JOIN queries
 * - getLocalArtistCounts aggregates by artist from DB
 * - getLocalHourCounts returns 24 data points with zeros for empty hours
 * - New DB query functions (countPlaysByArtist, countPlaysByHour, getRecentPlaysWithTracks)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbExecutor } from '../../../src/lib/db/types';
import type { RecentPlay } from '../../../src/lib/analytics/types';
import {
	persistRecentPlays,
	getLocalRecentPlays,
	getLocalArtistCounts,
	getLocalHourCounts,
} from '../../../src/lib/analytics/index';
import {
	getRecentPlaysWithTracks,
	countPlaysByArtist,
	countPlaysByHour,
} from '../../../src/lib/db/queries';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockExec(): DbExecutor & ReturnType<typeof vi.fn> {
	return vi.fn().mockResolvedValue([]);
}

function makePlay(overrides: Partial<RecentPlay> = {}): RecentPlay {
	return {
		trackId: 't1',
		trackName: 'Test Song',
		artistName: 'Test Artist',
		albumName: 'Test Album',
		playedAt: new Date('2024-06-15T14:30:00Z'),
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// persistRecentPlays
// ---------------------------------------------------------------------------

describe('persistRecentPlays', () => {
	let exec: DbExecutor & ReturnType<typeof vi.fn>;

	beforeEach(() => {
		exec = makeMockExec();
	});

	it('upserts a track and inserts a play event for each play', async () => {
		const plays = [makePlay()];

		const count = await persistRecentPlays(plays, exec);

		expect(count).toBe(1);
		// Should have called exec twice: once for upsert track, once for add recent play
		expect(exec).toHaveBeenCalledTimes(2);

		const firstCall = exec.mock.calls[0] as [string, unknown[]];
		expect(firstCall[0]).toContain('INSERT INTO tracks');

		const secondCall = exec.mock.calls[1] as [string, unknown[]];
		expect(secondCall[0]).toContain('INSERT INTO recent_plays');
	});

	it('handles multiple plays', async () => {
		const plays = [
			makePlay({ trackId: 't1', trackName: 'Song A' }),
			makePlay({ trackId: 't2', trackName: 'Song B' }),
			makePlay({ trackId: 't3', trackName: 'Song C' }),
		];

		const count = await persistRecentPlays(plays, exec);

		expect(count).toBe(3);
		// 2 calls per play (upsert track + add play)
		expect(exec).toHaveBeenCalledTimes(6);
	});

	it('returns 0 for empty plays array', async () => {
		const count = await persistRecentPlays([], exec);
		expect(count).toBe(0);
		expect(exec).not.toHaveBeenCalled();
	});

	it('passes correct track data to upsert', async () => {
		const play = makePlay({
			trackId: 'abc123',
			trackName: 'My Song',
			artistName: 'My Artist',
			albumName: 'My Album',
		});

		await persistRecentPlays([play], exec);

		const upsertCall = exec.mock.calls[0] as [string, unknown[]];
		const params = upsertCall[1];
		expect(params[0]).toBe('abc123'); // id
		expect(params[1]).toBe('My Song'); // name
	});

	it('passes correct played_at timestamp', async () => {
		const playedAt = new Date('2024-06-15T14:30:00Z');
		const play = makePlay({ playedAt });

		await persistRecentPlays([play], exec);

		const addPlayCall = exec.mock.calls[1] as [string, unknown[]];
		const params = addPlayCall[1];
		expect(params[1]).toBe(playedAt.getTime());
	});
});

// ---------------------------------------------------------------------------
// getLocalRecentPlays
// ---------------------------------------------------------------------------

describe('getLocalRecentPlays', () => {
	it('transforms DB rows into RecentActivityResult', async () => {
		const exec = vi.fn().mockResolvedValue([
			{
				id: 1,
				track_id: 't1',
				played_at: 1718458200000,
				track_name: 'Song A',
				artist_name: 'Artist A',
				album_name: 'Album A',
			},
			{
				id: 2,
				track_id: 't2',
				played_at: 1718458300000,
				track_name: 'Song B',
				artist_name: 'Artist B',
				album_name: 'Album B',
			},
		]) as unknown as DbExecutor;

		const result = await getLocalRecentPlays(exec, 0);

		expect(result.plays).toHaveLength(2);
		expect(result.totalCount).toBe(2);
		expect(result.plays[0].trackName).toBe('Song A');
		expect(result.plays[0].artistName).toBe('Artist A');
		expect(result.plays[0].albumName).toBe('Album A');
		expect(result.plays[0].playedAt).toBeInstanceOf(Date);
	});

	it('returns empty result when DB has no plays', async () => {
		const exec = vi.fn().mockResolvedValue([]) as unknown as DbExecutor;

		const result = await getLocalRecentPlays(exec, 0);

		expect(result.plays).toHaveLength(0);
		expect(result.totalCount).toBe(0);
	});

	it('passes since parameter to the query', async () => {
		const exec = vi.fn().mockResolvedValue([]) as unknown as DbExecutor;

		await getLocalRecentPlays(exec, 1000);

		const [sql, params] = exec.mock.calls[0] as [string, unknown[]];
		expect(sql).toContain('played_at');
		expect(params[0]).toBe(1000);
	});
});

// ---------------------------------------------------------------------------
// getLocalArtistCounts
// ---------------------------------------------------------------------------

describe('getLocalArtistCounts', () => {
	it('transforms DB aggregation into ChartDataPoints', async () => {
		const exec = vi.fn().mockResolvedValue([
			{ artist_name: 'Artist A', play_count: 10 },
			{ artist_name: 'Artist B', play_count: 5 },
		]) as unknown as DbExecutor;

		const result = await getLocalArtistCounts(exec);

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ label: 'Artist A', value: 10 });
		expect(result[1]).toEqual({ label: 'Artist B', value: 5 });
	});

	it('returns empty array when no plays exist', async () => {
		const exec = vi.fn().mockResolvedValue([]) as unknown as DbExecutor;

		const result = await getLocalArtistCounts(exec);

		expect(result).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// getLocalHourCounts
// ---------------------------------------------------------------------------

describe('getLocalHourCounts', () => {
	it('returns 24 data points', async () => {
		const exec = vi.fn().mockResolvedValue([]) as unknown as DbExecutor;

		const result = await getLocalHourCounts(exec);

		expect(result).toHaveLength(24);
	});

	it('fills in zeros for hours with no plays', async () => {
		const exec = vi.fn().mockResolvedValue([
			{ hour: 14, play_count: 5 },
		]) as unknown as DbExecutor;

		const result = await getLocalHourCounts(exec);

		expect(result[14].value).toBe(5);
		expect(result[0].value).toBe(0);
		expect(result[23].value).toBe(0);
	});

	it('formats hour labels correctly', async () => {
		const exec = vi.fn().mockResolvedValue([]) as unknown as DbExecutor;

		const result = await getLocalHourCounts(exec);

		expect(result[0].label).toBe('00:00');
		expect(result[9].label).toBe('09:00');
		expect(result[14].label).toBe('14:00');
		expect(result[23].label).toBe('23:00');
	});
});

// ---------------------------------------------------------------------------
// DB query functions
// ---------------------------------------------------------------------------

describe('getRecentPlaysWithTracks', () => {
	it('builds correct JOIN query', async () => {
		const exec = vi.fn().mockResolvedValue([]) as unknown as DbExecutor;

		await getRecentPlaysWithTracks(exec, 500, 50);

		const [sql, params] = exec.mock.calls[0] as [string, unknown[]];
		expect(sql).toContain('INNER JOIN tracks');
		expect(sql).toContain('played_at');
		expect(params[0]).toBe(500);
		expect(params[1]).toBe(50);
	});
});

describe('countPlaysByArtist', () => {
	it('builds correct GROUP BY query', async () => {
		const exec = vi.fn().mockResolvedValue([]) as unknown as DbExecutor;

		await countPlaysByArtist(exec, 1000);

		const [sql, params] = exec.mock.calls[0] as [string, unknown[]];
		expect(sql).toContain('GROUP BY t.artist_name');
		expect(sql).toContain('COUNT(*)');
		expect(params[0]).toBe(1000);
	});
});

describe('countPlaysByHour', () => {
	it('builds correct hour extraction query', async () => {
		const exec = vi.fn().mockResolvedValue([]) as unknown as DbExecutor;

		await countPlaysByHour(exec, 2000);

		const [sql, params] = exec.mock.calls[0] as [string, unknown[]];
		expect(sql).toContain('strftime');
		expect(sql).toContain('GROUP BY hour');
		expect(params[0]).toBe(2000);
	});
});
