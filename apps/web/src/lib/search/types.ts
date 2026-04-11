export type SearchMode = 'track' | 'artist' | 'both' | 'unified';

export interface SearchQuery {
	query: string;
	mode: SearchMode;
	artistQuery?: string; // Used when mode is 'both'
}

export interface SearchResultItem {
	playlistId: string;
	playlistName: string;
	playlistOwner: string;
	trackId: string;
	trackName: string;
	artistName: string;
	albumName: string;
	matchType: 'track' | 'artist' | 'album';
	spotifyPlaylistUrl: string;
}

export interface SearchResults {
	query: SearchQuery;
	items: SearchResultItem[];
	totalMatches: number;
	searchTimeMs: number;
}
