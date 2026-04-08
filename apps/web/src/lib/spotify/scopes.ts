/**
 * Spotify API scopes required by the spotify-helper application.
 *
 * Reference: https://developer.spotify.com/documentation/web-api/concepts/scopes
 */

/** Read the current user's profile. */
const USER_READ_PRIVATE = 'user-read-private';

/** Read the current user's email address. */
const USER_READ_EMAIL = 'user-read-email';

/** Read the current user's top artists and tracks. */
const USER_TOP_READ = 'user-top-read';

/** Read the current user's recently played tracks. */
const USER_READ_RECENTLY_PLAYED = 'user-read-recently-played';

/** Read the current user's playlists. */
const PLAYLIST_READ_PRIVATE = 'playlist-read-private';

/** Read playlists the user follows that are public. */
const PLAYLIST_READ_COLLABORATIVE = 'playlist-read-collaborative';

/**
 * All scopes required by the application.
 * Pass this array to buildAuthUrl when initiating the OAuth flow.
 */
export const REQUIRED_SCOPES: string[] = [
	USER_READ_PRIVATE,
	USER_READ_EMAIL,
	USER_TOP_READ,
	USER_READ_RECENTLY_PLAYED,
	PLAYLIST_READ_PRIVATE,
	PLAYLIST_READ_COLLABORATIVE,
];
