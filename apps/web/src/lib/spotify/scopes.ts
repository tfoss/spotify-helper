/**
 * Spotify API scopes required by the application.
 */
export const REQUIRED_SCOPES = [
	'user-read-private',
	'user-read-email',
	'playlist-read-private',
	'playlist-read-collaborative',
	'user-top-read',
	'user-read-recently-played'
] as const;

export type SpotifyScope = (typeof REQUIRED_SCOPES)[number];
