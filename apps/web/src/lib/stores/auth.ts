/**
 * Svelte auth store for Spotify OAuth with PKCE.
 * Manages authentication state, token refresh, and login/logout flows.
 */

import { writable, get } from 'svelte/store';
import { generateCodeVerifier, generateCodeChallenge, generateState, buildAuthUrl } from '$lib/auth/pkce';
import { storeCodeVerifier, getCodeVerifier, clearCodeVerifier, storeState, getState, clearState, storeRefreshToken, getRefreshToken, clearAllTokens } from '$lib/auth/tokens';
import { REQUIRED_SCOPES } from '$lib/spotify/scopes';
import { config, getRedirectUri } from '$lib/config';

export interface AuthState {
	isAuthenticated: boolean;
	accessToken: string | null;
	expiresAt: number | null;
	error: string | null;
}

const initialState: AuthState = {
	isAuthenticated: false,
	accessToken: null,
	expiresAt: null,
	error: null
};

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(initialState);

	let refreshTimer: ReturnType<typeof setTimeout> | null = null;

	function clearRefreshTimer(): void {
		if (refreshTimer !== null) {
			clearTimeout(refreshTimer);
			refreshTimer = null;
		}
	}

	function scheduleRefresh(expiresAt: number): void {
		clearRefreshTimer();

		const now = Date.now();
		const refreshAt = expiresAt - 60_000; // 60 seconds before expiry
		const delay = Math.max(refreshAt - now, 0);

		refreshTimer = setTimeout(() => {
			refreshAccessToken();
		}, delay);
	}

	/**
	 * Initiate the Spotify login flow.
	 * Generates a PKCE pair, stores the verifier, and redirects to Spotify.
	 */
	async function login(): Promise<void> {
		try {
			const verifier = generateCodeVerifier();
			const challenge = await generateCodeChallenge(verifier);
			const state = generateState();

			storeCodeVerifier(verifier);
			storeState(state);

			const authUrl = buildAuthUrl(
				config.spotifyClientId,
				getRedirectUri(),
				challenge,
				state,
				REQUIRED_SCOPES
			);

			window.location.href = authUrl;
		} catch (err) {
			update((s) => ({
				...s,
				error: err instanceof Error ? err.message : 'Failed to initiate login'
			}));
		}
	}

	/**
	 * Handle the OAuth callback after Spotify redirects back.
	 * Validates state, exchanges the authorization code for tokens via the auth Worker.
	 */
	async function handleCallback(code: string, state: string): Promise<void> {
		const storedState = getState();
		if (!storedState || storedState !== state) {
			update((s) => ({ ...s, error: 'Invalid state parameter — possible CSRF attack' }));
			clearState();
			return;
		}

		const codeVerifier = getCodeVerifier();
		if (!codeVerifier) {
			update((s) => ({ ...s, error: 'Missing code verifier — please try logging in again' }));
			return;
		}

		try {
			const response = await fetch(`${config.authWorkerUrl}/exchange`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					code,
					code_verifier: codeVerifier,
					redirect_uri: getRedirectUri()
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					(errorData as Record<string, string>).error || `Token exchange failed (${response.status})`
				);
			}

			const data = (await response.json()) as {
				access_token: string;
				refresh_token: string;
				expires_in: number;
			};

			const expiresAt = Date.now() + data.expires_in * 1000;

			if (data.refresh_token) {
				storeRefreshToken(data.refresh_token);
			}

			clearCodeVerifier();
			clearState();

			set({
				isAuthenticated: true,
				accessToken: data.access_token,
				expiresAt,
				error: null
			});

			scheduleRefresh(expiresAt);
		} catch (err) {
			update((s) => ({
				...s,
				error: err instanceof Error ? err.message : 'Token exchange failed'
			}));
		}
	}

	/**
	 * Refresh the access token using the stored refresh token.
	 * - On 4xx: token is invalid — call logout() to clear storage and force re-login.
	 * - On 5xx or network error: transient failure — preserve token, show retry message.
	 * - On 401 specifically: retries exactly once before treating as a 4xx logout.
	 */
	async function refreshAccessToken(isRetry: boolean = false): Promise<void> {
		const refreshToken = getRefreshToken();
		if (!refreshToken) {
			logout();
			return;
		}

		// Separate the network fetch from HTTP status handling so we can distinguish
		// a rejected Promise (network error) from a resolved Response with a 4xx/5xx code.
		let response: Response;
		try {
			response = await fetch(`${config.authWorkerUrl}/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refresh_token: refreshToken })
			});
		} catch (_err) {
			// Network error (worker unreachable, DNS failure, etc.) — preserve the
			// refresh token so the user is not forced to re-login on the next load.
			update((s) => ({
				...s,
				isAuthenticated: false,
				accessToken: null,
				expiresAt: null,
				error: 'Could not refresh token — will retry on next page load'
			}));
			return;
		}

		// 401: retry exactly once — the worker may have just rotated its signing key.
		if (response.status === 401 && !isRetry) {
			await refreshAccessToken(true);
			return;
		}

		// 4xx: the refresh token is genuinely invalid — clear storage and force re-login.
		if (response.status >= 400 && response.status < 500) {
			logout();
			return;
		}

		// 5xx: server-side error — preserve the token and let the user retry later.
		if (!response.ok) {
			update((s) => ({
				...s,
				isAuthenticated: false,
				accessToken: null,
				expiresAt: null,
				error: 'Could not refresh token — will retry on next page load'
			}));
			return;
		}

		const data = (await response.json()) as {
			access_token: string;
			refresh_token?: string;
			expires_in: number;
		};

		const expiresAt = Date.now() + data.expires_in * 1000;

		if (data.refresh_token) {
			storeRefreshToken(data.refresh_token);
		}

		set({
			isAuthenticated: true,
			accessToken: data.access_token,
			expiresAt,
			error: null
		});

		scheduleRefresh(expiresAt);
	}

	/**
	 * Log out: clear all tokens, reset store state, cancel refresh timer.
	 */
	function logout(): void {
		clearRefreshTimer();
		clearAllTokens();
		set(initialState);
	}

	/**
	 * Initialize auth state from stored refresh token (call on app startup).
	 */
	async function initialize(): Promise<void> {
		const refreshToken = getRefreshToken();
		if (refreshToken) {
			await refreshAccessToken();
		}
	}

	return {
		subscribe,
		login,
		handleCallback,
		refreshAccessToken,
		logout,
		initialize
	};
}

export const authStore = createAuthStore();
