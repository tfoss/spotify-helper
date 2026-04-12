/**
 * Internal analytics types.
 * UI must NEVER depend on raw Spotify response shapes — use these instead.
 */

export type TimeRange = 'short_term' | 'medium_term' | 'long_term';

export interface TopItem {
	rank: number;
	id: string;
	name: string;
	imageUrl?: string;
	playCount?: number;
	popularity?: number;
	spotifyUrl: string;
}

export interface TopArtistsResult {
	timeRange: TimeRange;
	items: TopItem[];
	source: 'spotify' | 'local';
}

export interface TopTracksResult {
	timeRange: TimeRange;
	items: TopItem[];
	source: 'spotify' | 'local';
}

export interface RecentPlay {
	trackId: string;
	trackName: string;
	artistName: string;
	albumName: string;
	playedAt: Date;
}

export interface RecentActivityResult {
	plays: RecentPlay[];
	totalCount: number;
}

export interface ChartDataPoint {
	label: string;
	value: number;
	metadata?: Record<string, unknown>;
}
