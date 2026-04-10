/**
 * Era heatmap analytics — track release year histograms.
 *
 * Provides functions to aggregate tracks by release year from the local
 * SQLite database. Supports per-playlist and all-playlists views.
 */

import type { DbExecutor } from '$lib/db/types';
import type { ChartDataPoint } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Summary of a playlist for the era selector. */
export interface PlaylistSummary {
	id: string;
	name: string;
	trackCount: number;
}

/** Result of an era aggregation query. */
export interface EraResult {
	/** Chart data points — one per release year with a track count. */
	data: ChartDataPoint[];
	/** Total number of tracks included in the aggregation. */
	totalTracks: number;
	/** Scope label for display (playlist name or "All Playlists"). */
	scopeLabel: string;
}

// ---------------------------------------------------------------------------
// DB queries
// ---------------------------------------------------------------------------

/**
 * Get all playlists with their track counts.
 *
 * @param exec - Database executor.
 * @returns Array of playlist summaries sorted by name.
 */
export async function getPlaylistSummaries(
	exec: DbExecutor,
): Promise<PlaylistSummary[]> {
	const sql = `
		SELECT p.id, p.name, COUNT(pt.track_id) AS track_count
		FROM playlists p
		LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
		GROUP BY p.id, p.name
		ORDER BY p.name;`;

	const rows = await exec(sql);
	return rows.map((r) => ({
		id: r.id as string,
		name: r.name as string,
		trackCount: r.track_count as number,
	}));
}

/**
 * Aggregate tracks by release year across all playlists.
 *
 * @param exec - Database executor.
 * @returns Era result with chart data points sorted by year.
 */
export async function getEraDataAllPlaylists(
	exec: DbExecutor,
): Promise<EraResult> {
	const sql = `
		SELECT SUBSTR(t.release_date, 1, 4) AS year, COUNT(*) AS count
		FROM tracks t
		INNER JOIN playlist_tracks pt ON pt.track_id = t.id
		WHERE t.release_date IS NOT NULL AND t.release_date != ''
		GROUP BY year
		ORDER BY year;`;

	const rows = await exec(sql);

	const data: ChartDataPoint[] = rows.map((r) => ({
		label: r.year as string,
		value: r.count as number,
	}));

	const totalTracks = data.reduce((sum, d) => sum + d.value, 0);

	return {
		data,
		totalTracks,
		scopeLabel: 'All Playlists',
	};
}

/**
 * Aggregate tracks by release year for a specific playlist.
 *
 * @param exec       - Database executor.
 * @param playlistId - ID of the playlist to scope to.
 * @returns Era result with chart data points sorted by year.
 */
export async function getEraDataForPlaylist(
	exec: DbExecutor,
	playlistId: string,
): Promise<EraResult> {
	const dataSql = `
		SELECT SUBSTR(t.release_date, 1, 4) AS year, COUNT(*) AS count
		FROM tracks t
		INNER JOIN playlist_tracks pt ON pt.track_id = t.id
		WHERE pt.playlist_id = ?
		  AND t.release_date IS NOT NULL AND t.release_date != ''
		GROUP BY year
		ORDER BY year;`;

	const nameSql = `SELECT name FROM playlists WHERE id = ?;`;

	const [dataRows, nameRows] = await Promise.all([
		exec(dataSql, [playlistId]),
		exec(nameSql, [playlistId]),
	]);

	const data: ChartDataPoint[] = dataRows.map((r) => ({
		label: r.year as string,
		value: r.count as number,
	}));

	const totalTracks = data.reduce((sum, d) => sum + d.value, 0);
	const playlistName = (nameRows[0]?.name as string) ?? 'Unknown Playlist';

	return {
		data,
		totalTracks,
		scopeLabel: playlistName,
	};
}

/**
 * Compute era summary statistics from chart data points.
 *
 * @param data - Chart data points with year labels and track counts.
 * @returns Summary with oldest/newest year and decade distribution.
 */
export function computeEraSummary(data: ChartDataPoint[]): {
	oldestYear: string | null;
	newestYear: string | null;
	peakDecade: string | null;
	decadeDistribution: ChartDataPoint[];
} {
	if (data.length === 0) {
		return { oldestYear: null, newestYear: null, peakDecade: null, decadeDistribution: [] };
	}

	const oldestYear = data[0].label;
	const newestYear = data[data.length - 1].label;

	const decades = new Map<string, number>();
	for (const point of data) {
		const decade = point.label.substring(0, 3) + '0s';
		const current = decades.get(decade) ?? 0;
		decades.set(decade, current + point.value);
	}

	const decadeDistribution = Array.from(decades.entries())
		.map(([label, value]) => ({ label, value }))
		.sort((a, b) => a.label.localeCompare(b.label));

	let peakDecade: string | null = null;
	let maxCount = 0;
	for (const d of decadeDistribution) {
		if (d.value > maxCount) {
			maxCount = d.value;
			peakDecade = d.label;
		}
	}

	return { oldestYear, newestYear, peakDecade, decadeDistribution };
}
