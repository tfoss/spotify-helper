/**
 * Search domain logic — composes DB query helpers into SearchResults.
 *
 * All functions are pure: they accept a `DbExecutor` rather than a global
 * connection, keeping them testable and composable.
 */

import type { DbExecutor, TrackRow, PlaylistRow } from '$lib/db/types';
import {
	searchTracksByName,
	searchTracksByArtist,
	getPlaylistsForTrack,
	getAllTracks,
} from '$lib/db/queries';
import type { SearchQuery, SearchResultItem, SearchResults } from './types';
import { fuzzyFilterTracks } from './fuzzy';

/**
 * Build the Spotify URI for a playlist so it opens in the native app.
 */
export function buildSpotifyPlaylistUrl(playlistId: string): string {
	return `spotify:playlist:${playlistId}`;
}

/**
 * Convert a track + playlist pair into a SearchResultItem.
 */
function toResultItem(
	track: TrackRow,
	playlist: PlaylistRow,
	matchType: SearchResultItem['matchType'],
): SearchResultItem {
	return {
		playlistId: playlist.id,
		playlistName: playlist.name,
		playlistOwner: playlist.owner,
		trackId: track.id,
		trackName: track.name,
		artistName: track.artist_name,
		albumName: track.album_name,
		matchType,
		spotifyPlaylistUrl: buildSpotifyPlaylistUrl(playlist.id),
	};
}

/**
 * Expand a list of tracks into SearchResultItems by fetching each track's playlists.
 */
async function expandTracks(
	tracks: TrackRow[],
	matchType: SearchResultItem['matchType'],
	exec: DbExecutor,
): Promise<SearchResultItem[]> {
	const items: SearchResultItem[] = [];
	for (const track of tracks) {
		const playlists = await getPlaylistsForTrack(exec, track.id);
		for (const playlist of playlists) {
			items.push(toResultItem(track, playlist, matchType));
		}
	}
	return items;
}

/**
 * Deduplicate result items by (playlistId, trackId) pair.
 */
function deduplicateItems(items: SearchResultItem[]): SearchResultItem[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const key = `${item.playlistId}::${item.trackId}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/**
 * Main search entry point. Queries the local DB and returns structured results.
 *
 * - mode 'track': search by track name
 * - mode 'artist': search by artist name
 * - mode 'both': intersect tracks matching both track name and artist name
 *
 * Empty queries return empty results immediately.
 */
export async function searchPlaylists(
	query: SearchQuery,
	exec: DbExecutor,
): Promise<SearchResults> {
	const start = performance.now();

	if (!query.query.trim()) {
		return { query, items: [], totalMatches: 0, searchTimeMs: 0 };
	}

	// Fuzzy mode: fetch all tracks in memory and apply Levenshtein scoring
	if (query.fuzzy) {
		const allTracks = await getAllTracks(exec);
		const scored = fuzzyFilterTracks(allTracks, query.query);
		const items: SearchResultItem[] = [];
		for (const { track, score } of scored) {
			const playlists = await getPlaylistsForTrack(exec, track.id);
			for (const playlist of playlists) {
				items.push({
					...toResultItem(track, playlist, 'fuzzy'),
					fuzzyScore: score,
				});
			}
		}
		const deduped = deduplicateItems(items);
		const searchTimeMs = Math.round(performance.now() - start);
		console.debug('[Search] fuzzy query="%s" → %d results (%dms)', query.query, deduped.length, searchTimeMs);
		return { query, items: deduped, totalMatches: deduped.length, searchTimeMs };
	}

	let items: SearchResultItem[] = [];

	if (query.mode === 'unified') {
		// Unified: OR across track name and artist name
		const byName = await searchTracksByName(exec, query.query);
		const byArtist = await searchTracksByArtist(exec, query.query);

		// Merge and deduplicate tracks by ID
		const trackMap = new Map<string, TrackRow>();
		for (const t of byName) trackMap.set(t.id, t);
		for (const t of byArtist) trackMap.set(t.id, t);

		const nameItems = await expandTracks(byName, 'track', exec);
		const artistItems = await expandTracks(
			byArtist.filter((t) => !byName.some((n) => n.id === t.id)),
			'artist',
			exec,
		);
		items = [...nameItems, ...artistItems];
	} else if (query.mode === 'track') {
		const tracks = await searchTracksByName(exec, query.query);
		items = await expandTracks(tracks, 'track', exec);
	} else if (query.mode === 'artist') {
		const tracks = await searchTracksByArtist(exec, query.query);
		items = await expandTracks(tracks, 'artist', exec);
	} else {
		// mode === 'both': intersect tracks by name and artist
		const byName = await searchTracksByName(exec, query.query);
		const artistTerm = query.artistQuery ?? query.query;
		const byArtist = await searchTracksByArtist(exec, artistTerm);

		// Intersect: tracks that match both queries
		const artistIds = new Set(byArtist.map((t) => t.id));
		const intersected = byName.filter((t) => artistIds.has(t.id));

		items = await expandTracks(intersected, 'track', exec);
	}

	const deduped = deduplicateItems(items);
	const searchTimeMs = Math.round(performance.now() - start);

	console.debug('[Search] mode=%s query="%s" → %d results (%dms)', query.mode, query.query, deduped.length, searchTimeMs);

	return {
		query,
		items: deduped,
		totalMatches: deduped.length,
		searchTimeMs,
	};
}
