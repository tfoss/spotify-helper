/**
 * Tests for playlist overlap analytics module.
 *
 * Covers:
 * - countSharedTracks — counts shared tracks between two playlists
 * - getPlaylistTrackCount — counts tracks in a playlist
 * - jaccardSimilarity — computes Jaccard index
 * - buildOverlapMatrix — builds full NxN overlap matrix
 * - similarityToIntensity — maps similarity to CSS intensity
 */

import { describe, it, expect, vi } from 'vitest';
import type { DbExecutor } from '../../../src/lib/db/types';
import {
	countSharedTracks,
	getPlaylistTrackCount,
	jaccardSimilarity,
	buildOverlapMatrix,
	similarityToIntensity,
} from '../../../src/lib/analytics/overlap';

// ---------------------------------------------------------------------------
// countSharedTracks
// ---------------------------------------------------------------------------

describe('countSharedTracks', () => {
	it('returns count of shared tracks from JOIN query', async () => {
		const exec = vi.fn().mockResolvedValue([{ count: 7 }]) as unknown as DbExecutor;

		const result = await countSharedTracks(exec, 'p1', 'p2');

		expect(result).toBe(7);
		const [sql, params] = (exec as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
		expect(sql).toContain('INNER JOIN');
		expect(params).toEqual(['p1', 'p2']);
	});

	it('returns 0 when no shared tracks', async () => {
		const exec = vi.fn().mockResolvedValue([{ count: 0 }]) as unknown as DbExecutor;

		const result = await countSharedTracks(exec, 'p1', 'p2');

		expect(result).toBe(0);
	});

	it('returns 0 when query returns empty', async () => {
		const exec = vi.fn().mockResolvedValue([]) as unknown as DbExecutor;

		const result = await countSharedTracks(exec, 'p1', 'p2');

		expect(result).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// getPlaylistTrackCount
// ---------------------------------------------------------------------------

describe('getPlaylistTrackCount', () => {
	it('returns track count for a playlist', async () => {
		const exec = vi.fn().mockResolvedValue([{ count: 42 }]) as unknown as DbExecutor;

		const result = await getPlaylistTrackCount(exec, 'p1');

		expect(result).toBe(42);
	});

	it('passes playlist_id parameter', async () => {
		const exec = vi.fn().mockResolvedValue([{ count: 0 }]) as unknown as DbExecutor;

		await getPlaylistTrackCount(exec, 'my-playlist');

		const [, params] = (exec as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
		expect(params[0]).toBe('my-playlist');
	});
});

// ---------------------------------------------------------------------------
// jaccardSimilarity
// ---------------------------------------------------------------------------

describe('jaccardSimilarity', () => {
	it('returns 0 when both sets are empty', () => {
		expect(jaccardSimilarity(0, 0, 0)).toBe(0);
	});

	it('returns 1 when sets are identical', () => {
		expect(jaccardSimilarity(10, 10, 10)).toBe(1);
	});

	it('returns 0 when no overlap', () => {
		expect(jaccardSimilarity(0, 10, 5)).toBe(0);
	});

	it('computes correct Jaccard index', () => {
		// A has 10, B has 8, shared 3
		// Union = 10 + 8 - 3 = 15
		// Jaccard = 3/15 = 0.2
		expect(jaccardSimilarity(3, 10, 8)).toBe(0.2);
	});

	it('returns correct value for partial overlap', () => {
		// A has 20, B has 20, shared 10
		// Union = 20 + 20 - 10 = 30
		// Jaccard = 10/30 ≈ 0.333
		expect(jaccardSimilarity(10, 20, 20)).toBeCloseTo(1 / 3);
	});
});

// ---------------------------------------------------------------------------
// buildOverlapMatrix
// ---------------------------------------------------------------------------

describe('buildOverlapMatrix', () => {
	it('builds correct NxN matrix for 2 playlists', async () => {
		let callIndex = 0;
		const responses = [
			// nameSql: playlist names
			[{ id: 'p1', name: 'Playlist A' }, { id: 'p2', name: 'Playlist B' }],
			// getPlaylistTrackCount for p1
			[{ count: 10 }],
			// getPlaylistTrackCount for p2
			[{ count: 8 }],
			// countSharedTracks(p1, p2)
			[{ count: 3 }],
		];

		const exec = vi.fn().mockImplementation(() => {
			return Promise.resolve(responses[callIndex++] ?? []);
		}) as unknown as DbExecutor;

		const result = await buildOverlapMatrix(exec, ['p1', 'p2']);

		expect(result.playlistIds).toEqual(['p1', 'p2']);
		expect(result.playlistNames).toEqual(['Playlist A', 'Playlist B']);
		expect(result.trackCounts).toEqual([10, 8]);
		expect(result.cells).toHaveLength(2);
		expect(result.cells[0]).toHaveLength(2);

		// Diagonal: self-overlap
		expect(result.cells[0][0].sharedCount).toBe(10);
		expect(result.cells[0][0].similarity).toBe(1);
		expect(result.cells[1][1].sharedCount).toBe(8);

		// Off-diagonal: shared tracks
		expect(result.cells[0][1].sharedCount).toBe(3);
		expect(result.cells[0][1].similarity).toBeCloseTo(0.2);

		// Symmetric
		expect(result.cells[1][0]).toBe(result.cells[0][1]);
	});

	it('handles single playlist', async () => {
		const exec = vi.fn()
			.mockResolvedValueOnce([{ id: 'p1', name: 'Solo' }])
			.mockResolvedValueOnce([{ count: 5 }]) as unknown as DbExecutor;

		const result = await buildOverlapMatrix(exec, ['p1']);

		expect(result.cells).toHaveLength(1);
		expect(result.cells[0][0].sharedCount).toBe(5);
		expect(result.cells[0][0].similarity).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// similarityToIntensity
// ---------------------------------------------------------------------------

describe('similarityToIntensity', () => {
	it('maps 0 to 0', () => {
		expect(similarityToIntensity(0)).toBe(0);
	});

	it('maps 1 to 100', () => {
		expect(similarityToIntensity(1)).toBe(100);
	});

	it('maps 0.5 to 50', () => {
		expect(similarityToIntensity(0.5)).toBe(50);
	});

	it('rounds to nearest integer', () => {
		expect(similarityToIntensity(0.333)).toBe(33);
		expect(similarityToIntensity(0.667)).toBe(67);
	});
});
