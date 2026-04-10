import type {
	SpotifyUser,
	SpotifyPlaylist,
	SpotifyPlaylistTrack,
	SpotifyTrack,
	SpotifyFullArtist,
	SpotifyPaginated,
	SpotifyTopItems,
	SpotifyRecentlyPlayed,
	SpotifyTimeRange,
} from './types';

const BASE_URL = 'https://api.spotify.com/v1';

export class SpotifyClient {
	private getAccessToken: () => string | null;
	private onTokenExpired: () => Promise<void>;

	constructor(getAccessToken: () => string | null, onTokenExpired: () => Promise<void>) {
		this.getAccessToken = getAccessToken;
		this.onTokenExpired = onTokenExpired;
	}

	private async fetch<T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<T> {
		const token = this.getAccessToken();
		const headers: HeadersInit = {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(options.headers as Record<string, string> ?? {}),
		};

		const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

		if (response.status === 401 && retry) {
			await this.onTokenExpired();
			return this.fetch<T>(endpoint, options, false);
		}

		if (response.status === 429) {
			const retryAfter = parseInt(response.headers.get('Retry-After') ?? '1', 10);
			await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
			return this.fetch<T>(endpoint, options, retry);
		}

		if (!response.ok) {
			throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
		}

		return response.json() as Promise<T>;
	}

	getCurrentUser(): Promise<SpotifyUser> {
		return this.fetch<SpotifyUser>('/me');
	}

	getUserPlaylists(limit = 50, offset = 0): Promise<SpotifyPaginated<SpotifyPlaylist>> {
		return this.fetch<SpotifyPaginated<SpotifyPlaylist>>(
			`/me/playlists?limit=${limit}&offset=${offset}`,
		);
	}

	async getAllUserPlaylists(): Promise<SpotifyPlaylist[]> {
		const playlists: SpotifyPlaylist[] = [];
		let offset = 0;
		const limit = 50;

		while (true) {
			const page = await this.getUserPlaylists(limit, offset);
			playlists.push(...page.items);
			if (page.next === null || playlists.length >= page.total) break;
			offset += limit;
		}

		return playlists;
	}

	getPlaylistTracks(
		playlistId: string,
		limit = 100,
		offset = 0,
	): Promise<SpotifyPaginated<SpotifyPlaylistTrack>> {
		return this.fetch<SpotifyPaginated<SpotifyPlaylistTrack>>(
			`/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`,
		);
	}

	async getAllPlaylistTracks(playlistId: string): Promise<SpotifyPlaylistTrack[]> {
		const tracks: SpotifyPlaylistTrack[] = [];
		let offset = 0;
		const limit = 100;

		while (true) {
			const page = await this.getPlaylistTracks(playlistId, limit, offset);
			tracks.push(...page.items);
			if (page.next === null || tracks.length >= page.total) break;
			offset += limit;
		}

		return tracks;
	}

	getTopArtists(timeRange: SpotifyTimeRange, limit = 50): Promise<SpotifyTopItems<SpotifyUser>> {
		return this.fetch<SpotifyTopItems<SpotifyUser>>(
			`/me/top/artists?time_range=${timeRange}&limit=${limit}`,
		);
	}

	getTopTracks(timeRange: SpotifyTimeRange, limit = 50): Promise<SpotifyTopItems<SpotifyTrack>> {
		return this.fetch<SpotifyTopItems<SpotifyTrack>>(
			`/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
		);
	}

	/**
	 * Get full artist objects by IDs. Spotify allows up to 50 at a time.
	 */
	getArtists(ids: string[]): Promise<{ artists: SpotifyFullArtist[] }> {
		return this.fetch<{ artists: SpotifyFullArtist[] }>(
			`/artists?ids=${ids.join(',')}`,
		);
	}

	/**
	 * Get full artist objects in batches of 50.
	 */
	async getAllArtists(ids: string[]): Promise<SpotifyFullArtist[]> {
		const artists: SpotifyFullArtist[] = [];
		const uniqueIds = [...new Set(ids)];

		for (let i = 0; i < uniqueIds.length; i += 50) {
			const batch = uniqueIds.slice(i, i + 50);
			const response = await this.getArtists(batch);
			artists.push(...response.artists.filter(Boolean));
		}

		return artists;
	}

	getRecentlyPlayed(limit = 50, after?: number): Promise<SpotifyRecentlyPlayed> {
		const params = new URLSearchParams({ limit: limit.toString() });
		if (after !== undefined) params.set('after', after.toString());
		return this.fetch<SpotifyRecentlyPlayed>(`/me/player/recently-played?${params.toString()}`);
	}
}
