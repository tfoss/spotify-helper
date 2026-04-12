export interface SpotifyImage {
	url: string;
	height: number | null;
	width: number | null;
}

export interface SpotifyUser {
	id: string;
	display_name: string | null;
	email: string;
	images: SpotifyImage[];
}

export interface SpotifyPlaylistOwner {
	display_name: string | null;
}

export interface SpotifyPlaylist {
	id: string;
	name: string;
	owner: SpotifyPlaylistOwner;
	snapshot_id: string;
	images: SpotifyImage[];
	tracks: { total: number };
}

export interface SpotifyArtist {
	id: string;
	name: string;
}

export interface SpotifyTopArtist {
	id: string;
	name: string;
	images?: SpotifyImage[];
	genres?: string[];
	popularity?: number;
}

export interface SpotifyAlbum {
	name: string;
	release_date: string;
}

export interface SpotifyTrack {
	id: string;
	name: string;
	artists: SpotifyArtist[];
	album: SpotifyAlbum;
	duration_ms: number;
	popularity: number;
}

export interface SpotifyPlaylistTrack {
	added_at: string;
	track: SpotifyTrack;
}

export interface SpotifyPaginated<T> {
	items: T[];
	total: number;
	limit: number;
	offset: number;
	next: string | null;
	previous: string | null;
}

export interface SpotifyTopItems<T> {
	items: T[];
	total: number;
	limit: number;
	offset: number;
}

export interface SpotifyRecentlyPlayedItem {
	track: SpotifyTrack;
	played_at: string;
}

export interface SpotifyRecentlyPlayed {
	items: SpotifyRecentlyPlayedItem[];
	next: string | null;
	cursors: {
		after: string;
		before: string;
	};
}

export type SpotifyTimeRange = 'short_term' | 'medium_term' | 'long_term';
