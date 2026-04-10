/**
 * Genre distribution analytics.
 *
 * Spotify tracks don't carry genre info — genres live on artist objects.
 * This module fetches artist genres from the Spotify API and aggregates
 * them into chart-ready data.
 */

import type { SpotifyClient } from '$lib/spotify/client';
import type { SpotifyFullArtist } from '$lib/spotify/types';
import type { ChartDataPoint } from './types';

export interface GenreResult {
	genres: ChartDataPoint[];
	artistCount: number;
	source: 'spotify';
}

/**
 * Aggregate genres from a list of full artist objects.
 * Each artist may have multiple genres; each genre gets counted once per artist.
 *
 * @param artists - Full artist objects with genres.
 * @returns Chart data sorted descending by frequency.
 */
export function aggregateGenres(artists: SpotifyFullArtist[]): ChartDataPoint[] {
	const genreCounts = new Map<string, number>();

	for (const artist of artists) {
		for (const genre of artist.genres) {
			const normalized = genre.toLowerCase().trim();
			if (normalized) {
				genreCounts.set(normalized, (genreCounts.get(normalized) ?? 0) + 1);
			}
		}
	}

	return Array.from(genreCounts.entries())
		.map(([label, value]) => ({ label, value }))
		.sort((a, b) => b.value - a.value);
}

/**
 * Extract unique artist IDs from playlist tracks.
 *
 * @param tracks - Array of objects with artists array (each having an id).
 * @returns Deduplicated artist IDs.
 */
export function extractArtistIds(
	tracks: Array<{ artists: Array<{ id: string }> }>,
): string[] {
	const ids = new Set<string>();
	for (const track of tracks) {
		for (const artist of track.artists) {
			ids.add(artist.id);
		}
	}
	return Array.from(ids);
}

/**
 * Fetch genre distribution for a specific playlist.
 *
 * Steps:
 * 1. Get all tracks in the playlist
 * 2. Extract unique artist IDs
 * 3. Batch-fetch full artist objects (which include genres)
 * 4. Aggregate genres
 *
 * @param client     - Spotify API client.
 * @param playlistId - Playlist to analyze.
 * @returns Genre distribution result.
 */
export async function getPlaylistGenres(
	client: SpotifyClient,
	playlistId: string,
): Promise<GenreResult> {
	const playlistTracks = await client.getAllPlaylistTracks(playlistId);
	const tracks = playlistTracks.map((pt) => pt.track);
	const artistIds = extractArtistIds(tracks);
	const artists = await client.getAllArtists(artistIds);

	return {
		genres: aggregateGenres(artists),
		artistCount: artists.length,
		source: 'spotify',
	};
}

/**
 * Fetch genre distribution from the user's top artists.
 *
 * @param client    - Spotify API client.
 * @param timeRange - Spotify time range.
 * @param limit     - Number of top artists to use.
 * @returns Genre distribution result.
 */
export async function getTopArtistGenres(
	client: SpotifyClient,
	timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
	limit = 50,
): Promise<GenreResult> {
	const response = await client.getTopArtists(timeRange, limit);
	const artistIds = response.items.map((a) => a.id);
	const artists = await client.getAllArtists(artistIds);

	return {
		genres: aggregateGenres(artists),
		artistCount: artists.length,
		source: 'spotify',
	};
}
