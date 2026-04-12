/**
 * Analytics transform functions.
 *
 * Pure transforms that compose Spotify client + local DB data into
 * typed internal results. UI consumes these, never raw Spotify shapes.
 */

import type { SpotifyClient } from '$lib/spotify/client';
import type { DbExecutor } from '$lib/db/types';
import {
	getRecentPlays,
	getRecentPlaysWithTracks,
	countPlaysByArtist,
	countPlaysByHour,
	addRecentPlay,
	upsertTrack,
} from '$lib/db/queries';
import type {
	TimeRange,
	TopItem,
	TopArtistsResult,
	TopTracksResult,
	RecentPlay,
	RecentActivityResult,
	ChartDataPoint,
} from './types';

// ---------------------------------------------------------------------------
// Spotify → internal transforms
// ---------------------------------------------------------------------------

/**
 * Fetch top artists from Spotify and transform into internal type.
 */
export async function getTopArtists(
	client: SpotifyClient,
	timeRange: TimeRange,
	limit = 50,
): Promise<TopArtistsResult> {
	const response = await client.getTopArtists(timeRange, limit);

	const items: TopItem[] = response.items.map((artist, index) => ({
		rank: index + 1,
		id: artist.id,
		name: artist.name,
		imageUrl: artist.images?.[0]?.url,
		popularity: artist.popularity,
		spotifyUrl: `https://open.spotify.com/artist/${artist.id}`,
	}));

	return { timeRange, items, source: 'spotify' };
}

/**
 * Fetch top tracks from Spotify and transform into internal type.
 */
export async function getTopTracks(
	client: SpotifyClient,
	timeRange: TimeRange,
	limit = 50,
): Promise<TopTracksResult> {
	const response = await client.getTopTracks(timeRange, limit);

	const items: TopItem[] = response.items.map((track, index) => ({
		rank: index + 1,
		id: track.id,
		name: track.name,
		popularity: track.popularity,
		spotifyUrl: `https://open.spotify.com/track/${track.id}`,
	}));

	return { timeRange, items, source: 'spotify' };
}

/**
 * Fetch recently played tracks from Spotify and transform.
 */
export async function getRecentlyPlayed(
	client: SpotifyClient,
	limit = 50,
): Promise<RecentActivityResult> {
	const response = await client.getRecentlyPlayed(limit);

	const plays: RecentPlay[] = response.items.map((item) => ({
		trackId: item.track.id,
		trackName: item.track.name,
		artistName: item.track.artists.map((a) => a.name).join(', '),
		albumName: item.track.album.name,
		playedAt: new Date(item.played_at),
	}));

	return { plays, totalCount: plays.length };
}

/**
 * Fetch recent plays from the local DB with full track metadata.
 */
export async function getLocalRecentPlays(
	dbExecutor: DbExecutor,
	since: number,
	limit = 100,
): Promise<RecentActivityResult> {
	const rows = await getRecentPlaysWithTracks(dbExecutor, since, limit);

	const plays: RecentPlay[] = rows.map((row) => ({
		trackId: row.track_id,
		trackName: row.track_name,
		artistName: row.artist_name,
		albumName: row.album_name,
		playedAt: new Date(row.played_at),
	}));

	return { plays, totalCount: plays.length };
}

/**
 * Persist Spotify recent plays into the local database.
 *
 * For each play, upserts the track metadata and inserts the play event.
 * Skips plays that are already stored (based on track_id + played_at).
 *
 * @param plays      - Recent plays from the Spotify API.
 * @param dbExecutor - Database executor.
 * @returns Number of new plays persisted.
 */
export async function persistRecentPlays(
	plays: RecentPlay[],
	dbExecutor: DbExecutor,
): Promise<number> {
	let persisted = 0;

	for (const play of plays) {
		await upsertTrack(dbExecutor, {
			id: play.trackId,
			name: play.trackName,
			artist_name: play.artistName,
			album_name: play.albumName,
			duration_ms: null,
			popularity: null,
			release_date: null,
		});

		await addRecentPlay(dbExecutor, play.trackId, play.playedAt.getTime());
		persisted++;
	}

	return persisted;
}

/**
 * Get local play counts by artist for chart display.
 *
 * @param dbExecutor - Database executor.
 * @param since      - Only count plays after this Unix timestamp (ms).
 * @returns Chart data points sorted by play count descending.
 */
export async function getLocalArtistCounts(
	dbExecutor: DbExecutor,
	since: number = 0,
): Promise<ChartDataPoint[]> {
	const rows = await countPlaysByArtist(dbExecutor, since);
	return rows.map((r) => ({ label: r.artist_name, value: r.play_count }));
}

/**
 * Get local play counts by hour for chart display.
 *
 * Returns 24 data points (one per hour), filling in zeros for hours
 * with no plays.
 *
 * @param dbExecutor - Database executor.
 * @param since      - Only count plays after this Unix timestamp (ms).
 * @returns 24 chart data points, one per hour.
 */
export async function getLocalHourCounts(
	dbExecutor: DbExecutor,
	since: number = 0,
): Promise<ChartDataPoint[]> {
	const rows = await countPlaysByHour(dbExecutor, since);
	const hourMap = new Map(rows.map((r) => [r.hour, r.play_count]));

	return Array.from({ length: 24 }, (_, hour) => ({
		label: `${hour.toString().padStart(2, '0')}:00`,
		value: hourMap.get(hour) ?? 0,
	}));
}

// ---------------------------------------------------------------------------
// Aggregation helpers (pure transforms)
// ---------------------------------------------------------------------------

/**
 * Group recent plays by artist and count occurrences.
 * Returns sorted by play count descending.
 */
export function aggregateByArtist(plays: RecentPlay[]): ChartDataPoint[] {
	const counts = new Map<string, number>();

	for (const play of plays) {
		const current = counts.get(play.artistName) ?? 0;
		counts.set(play.artistName, current + 1);
	}

	return Array.from(counts.entries())
		.map(([label, value]) => ({ label, value }))
		.sort((a, b) => b.value - a.value);
}

/**
 * Group recent plays by hour of day (0–23).
 * Returns 24 data points, one per hour.
 */
export function aggregateByHour(plays: RecentPlay[]): ChartDataPoint[] {
	const hours = new Array(24).fill(0) as number[];

	for (const play of plays) {
		const hour = play.playedAt.getHours();
		hours[hour]++;
	}

	return hours.map((value, hour) => ({
		label: `${hour.toString().padStart(2, '0')}:00`,
		value,
	}));
}

/**
 * Group tracks by release year from their release_date in the DB.
 * Queries the DB to get release dates for the given track IDs.
 */
export async function aggregateByReleaseYear(
	trackIds: string[],
	dbExecutor: DbExecutor,
): Promise<ChartDataPoint[]> {
	if (trackIds.length === 0) return [];

	const placeholders = trackIds.map(() => '?').join(',');
	const rows = await dbExecutor(
		`SELECT release_date FROM tracks WHERE id IN (${placeholders})`,
		trackIds,
	);

	const yearCounts = new Map<string, number>();

	for (const row of rows) {
		const releaseDate = row.release_date as string | null;
		if (!releaseDate) continue;

		const year = releaseDate.substring(0, 4);
		const current = yearCounts.get(year) ?? 0;
		yearCounts.set(year, current + 1);
	}

	return Array.from(yearCounts.entries())
		.map(([label, value]) => ({ label, value }))
		.sort((a, b) => a.label.localeCompare(b.label));
}
