/**
 * Playlist overlap analytics.
 *
 * Computes track commonality between playlists using the local
 * playlist_tracks junction table. Produces an NxN overlap matrix
 * suitable for heatmap visualization.
 */

import type { DbExecutor } from '$lib/db/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single cell in the overlap matrix. */
export interface OverlapCell {
	playlistA: string;
	playlistB: string;
	sharedCount: number;
	/** Jaccard similarity: |A∩B| / |A∪B| */
	similarity: number;
}

/** Full overlap matrix result. */
export interface OverlapMatrix {
	/** Playlist IDs in matrix order. */
	playlistIds: string[];
	/** Playlist names in matrix order. */
	playlistNames: string[];
	/** Track counts per playlist (diagonal values). */
	trackCounts: number[];
	/** NxN matrix of overlap cells. */
	cells: OverlapCell[][];
}

// ---------------------------------------------------------------------------
// DB queries
// ---------------------------------------------------------------------------

/**
 * Count shared tracks between two playlists.
 *
 * @param exec - Database executor.
 * @param playlistA - First playlist ID.
 * @param playlistB - Second playlist ID.
 * @returns Number of tracks present in both playlists.
 */
export async function countSharedTracks(
	exec: DbExecutor,
	playlistA: string,
	playlistB: string,
): Promise<number> {
	const sql = `
		SELECT COUNT(*) AS count
		FROM playlist_tracks a
		INNER JOIN playlist_tracks b
			ON a.track_id = b.track_id
		WHERE a.playlist_id = ? AND b.playlist_id = ?;`;

	const rows = await exec(sql, [playlistA, playlistB]);
	return (rows[0]?.count as number) ?? 0;
}

/**
 * Get track count for a playlist.
 *
 * @param exec       - Database executor.
 * @param playlistId - Playlist ID.
 * @returns Number of tracks in the playlist.
 */
export async function getPlaylistTrackCount(
	exec: DbExecutor,
	playlistId: string,
): Promise<number> {
	const sql = `SELECT COUNT(*) AS count FROM playlist_tracks WHERE playlist_id = ?;`;
	const rows = await exec(sql, [playlistId]);
	return (rows[0]?.count as number) ?? 0;
}

// ---------------------------------------------------------------------------
// Matrix computation
// ---------------------------------------------------------------------------

/**
 * Compute the Jaccard similarity between two sets.
 *
 * @param intersection - Size of the intersection (shared tracks).
 * @param sizeA        - Size of set A.
 * @param sizeB        - Size of set B.
 * @returns Jaccard index between 0 and 1.
 */
export function jaccardSimilarity(
	intersection: number,
	sizeA: number,
	sizeB: number,
): number {
	const union = sizeA + sizeB - intersection;
	if (union === 0) return 0;
	return intersection / union;
}

/**
 * Build the full overlap matrix for a set of playlists.
 *
 * @param exec        - Database executor.
 * @param playlistIds - Array of playlist IDs to include.
 * @returns Overlap matrix with shared counts and Jaccard similarity.
 */
export async function buildOverlapMatrix(
	exec: DbExecutor,
	playlistIds: string[],
): Promise<OverlapMatrix> {
	// Get playlist names
	const nameSql = `SELECT id, name FROM playlists WHERE id IN (${playlistIds.map(() => '?').join(',')})`;
	const nameRows = await exec(nameSql, playlistIds);
	const nameMap = new Map(nameRows.map((r) => [r.id as string, r.name as string]));

	const playlistNames = playlistIds.map((id) => nameMap.get(id) ?? 'Unknown');

	// Get track counts for each playlist
	const trackCounts: number[] = [];
	for (const id of playlistIds) {
		trackCounts.push(await getPlaylistTrackCount(exec, id));
	}

	// Build NxN matrix
	const n = playlistIds.length;
	const cells: OverlapCell[][] = [];

	for (let i = 0; i < n; i++) {
		const row: OverlapCell[] = [];
		for (let j = 0; j < n; j++) {
			if (i === j) {
				row.push({
					playlistA: playlistIds[i],
					playlistB: playlistIds[j],
					sharedCount: trackCounts[i],
					similarity: 1,
				});
			} else if (j < i) {
				// Mirror the already-computed cell
				row.push(cells[j][i]);
			} else {
				const sharedCount = await countSharedTracks(exec, playlistIds[i], playlistIds[j]);
				const similarity = jaccardSimilarity(sharedCount, trackCounts[i], trackCounts[j]);
				row.push({
					playlistA: playlistIds[i],
					playlistB: playlistIds[j],
					sharedCount,
					similarity,
				});
			}
		}
		cells.push(row);
	}

	return {
		playlistIds,
		playlistNames,
		trackCounts,
		cells,
	};
}

/**
 * Get a color intensity (0-100) from a similarity value.
 *
 * @param similarity - Jaccard similarity between 0 and 1.
 * @returns Percentage intensity for CSS background.
 */
export function similarityToIntensity(similarity: number): number {
	return Math.round(similarity * 100);
}
