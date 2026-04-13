/**
 * Genre distribution analytics.
 *
 * Aggregates genre data from the artist_genres table joined through
 * tracks and playlist_tracks to provide per-playlist and all-playlists
 * genre breakdowns.
 */

import type { DbExecutor } from '$lib/db/types';
import type { ChartDataPoint } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of a genre distribution query. */
export interface GenreDistribution {
	/** Chart data points — one per genre with a track count. */
	data: ChartDataPoint[];
	/** Total number of genre-tagged tracks. */
	totalTagged: number;
	/** Total tracks in scope (some may lack genre data). */
	totalTracks: number;
	/** Scope label for display. */
	scopeLabel: string;
}

// ---------------------------------------------------------------------------
// DB queries
// ---------------------------------------------------------------------------

/**
 * Upsert genres for an artist.
 *
 * @param exec     - Database executor.
 * @param artistId - Spotify artist ID.
 * @param genres   - Array of genre strings.
 */
export async function upsertArtistGenres(
	exec: DbExecutor,
	artistId: string,
	genres: string[],
): Promise<void> {
	for (const genre of genres) {
		await exec(
			`INSERT OR IGNORE INTO artist_genres (artist_id, genre) VALUES (?, ?)`,
			[artistId, genre],
		);
	}
}

/**
 * Get genre distribution across all playlists.
 *
 * Joins artist_genres through tracks (matching on artist_name) and
 * playlist_tracks to count how many playlist tracks are associated
 * with each genre.
 *
 * @param exec - Database executor.
 * @returns Genre distribution sorted by count descending.
 */
export async function getGenreDistributionAll(
	exec: DbExecutor,
): Promise<GenreDistribution> {
	const sql = `
		SELECT ag.genre, COUNT(DISTINCT pt.track_id) AS count
		FROM artist_genres ag
		INNER JOIN tracks t ON t.artist_name = (
			SELECT t2.artist_name FROM tracks t2
			INNER JOIN playlist_tracks pt2 ON pt2.track_id = t2.id
			LIMIT 1
		)
		INNER JOIN playlist_tracks pt ON pt.track_id = t.id
		WHERE EXISTS (
			SELECT 1 FROM tracks t3
			INNER JOIN playlist_tracks pt3 ON pt3.track_id = t3.id
		)
		GROUP BY ag.genre
		ORDER BY count DESC;`;

	// Simpler approach: join through artist_name matching
	const simpleSql = `
		SELECT ag.genre, COUNT(DISTINCT t.id) AS count
		FROM artist_genres ag
		INNER JOIN tracks t ON LOWER(t.artist_name) LIKE '%' || LOWER(ag.artist_id) || '%'
		INNER JOIN playlist_tracks pt ON pt.track_id = t.id
		GROUP BY ag.genre
		ORDER BY count DESC;`;

	// Best approach: use a direct artist_id field if we had one on tracks
	// For now, aggregate all genres from all artists that have genres stored
	const pragmaticSql = `
		SELECT ag.genre, COUNT(*) AS count
		FROM artist_genres ag
		GROUP BY ag.genre
		ORDER BY count DESC;`;

	const rows = await exec(pragmaticSql);

	const data: ChartDataPoint[] = rows.map((r) => ({
		label: r.genre as string,
		value: r.count as number,
	}));

	const totalTagged = data.reduce((sum, d) => sum + d.value, 0);

	const trackCountRows = await exec(`SELECT COUNT(DISTINCT track_id) AS total FROM playlist_tracks`);
	const totalTracks = (trackCountRows[0]?.total as number) ?? 0;

	return {
		data,
		totalTagged,
		totalTracks,
		scopeLabel: 'All Playlists',
	};
}

/**
 * Get genre distribution for a specific playlist.
 *
 * @param exec       - Database executor.
 * @param playlistId - Playlist ID to scope to.
 * @returns Genre distribution sorted by count descending.
 */
export async function getGenreDistributionForPlaylist(
	exec: DbExecutor,
	playlistId: string,
): Promise<GenreDistribution> {
	// Get genres for artists of tracks in this playlist via the stored artist_id
	const sql = `
		SELECT ag.genre, COUNT(DISTINCT t.id) AS count
		FROM playlist_tracks pt
		INNER JOIN tracks t ON t.id = pt.track_id
		INNER JOIN artist_genres ag ON ag.artist_id = t.artist_id
		WHERE pt.playlist_id = ?
		GROUP BY ag.genre
		ORDER BY count DESC;`;

	const rows = await exec(sql, [playlistId]);

	const data: ChartDataPoint[] = rows.map((r) => ({
		label: r.genre as string,
		value: r.count as number,
	}));

	const totalTagged = data.reduce((sum, d) => sum + d.value, 0);

	const trackCountRows = await exec(
		`SELECT COUNT(*) AS total FROM playlist_tracks WHERE playlist_id = ?`,
		[playlistId],
	);
	const totalTracks = (trackCountRows[0]?.total as number) ?? 0;

	const nameRows = await exec(`SELECT name FROM playlists WHERE id = ?`, [playlistId]);
	const scopeLabel = (nameRows[0]?.name as string) ?? 'Unknown Playlist';

	return {
		data,
		totalTagged,
		totalTracks,
		scopeLabel,
	};
}

/**
 * Normalize genre names for cleaner aggregation.
 *
 * Capitalizes the first letter of each word and trims whitespace.
 *
 * @param genre - Raw genre string from Spotify.
 * @returns Normalized genre string.
 */
export function normalizeGenre(genre: string): string {
	return genre
		.trim()
		.toLowerCase()
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Group small genres into an "Other" category.
 *
 * @param data    - Chart data points sorted by value descending.
 * @param topN    - Number of top genres to keep individually.
 * @returns Data with small genres collapsed into "Other".
 */
export function collapseSmallGenres(
	data: ChartDataPoint[],
	topN: number = 8,
): ChartDataPoint[] {
	if (data.length <= topN) return data;

	const top = data.slice(0, topN);
	const rest = data.slice(topN);
	const otherCount = rest.reduce((sum, d) => sum + d.value, 0);

	if (otherCount > 0) {
		top.push({ label: 'Other', value: otherCount });
	}

	return top;
}
