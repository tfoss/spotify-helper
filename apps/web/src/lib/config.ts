/**
 * Environment-aware configuration for the Spotify Helper app.
 * Uses SvelteKit's $env/static/public for type-safe env access.
 */

import {
	PUBLIC_SPOTIFY_CLIENT_ID,
	PUBLIC_AUTH_WORKER_URL,
	PUBLIC_APP_ENV
} from '$env/static/public';

export const config = {
	spotifyClientId: PUBLIC_SPOTIFY_CLIENT_ID,
	authWorkerUrl: PUBLIC_AUTH_WORKER_URL,
	appEnv: PUBLIC_APP_ENV || 'local'
} as const;

/**
 * Returns the appropriate redirect URI based on the current environment.
 */
export function getRedirectUri(): string {
	if (config.appEnv === 'production') {
		return `${window.location.origin}/auth/callback`;
	}
	return 'http://localhost:5173/auth/callback';
}
