export type SearchMode = 'track' | 'artist' | 'both' | 'unified';

export interface SearchQuery {
	query: string;
	mode: SearchMode;
	artistQuery?: string; // Used when mode is 'both'
	/** When true, use fuzzy/approximate matching for typo tolerance. */
	fuzzy?: boolean;
}

export interface SearchResultItem {
	playlistId: string;
	playlistName: string;
	playlistOwner: string;
	trackId: string;
	trackName: string;
	artistName: string;
	albumName: string;
	matchType: 'track' | 'artist' | 'album' | 'fuzzy';
	spotifyPlaylistUrl: string;
	/** Fuzzy match score (0–1); only present when matchType is 'fuzzy'. */
	fuzzyScore?: number;
}

export interface SearchResults {
	query: SearchQuery;
	items: SearchResultItem[];
	totalMatches: number;
	searchTimeMs: number;
}
