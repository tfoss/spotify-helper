/**
 * Svelte auth store — manages Spotify OAuth state and token lifecycle.
 *
 * Responsibilities:
 * - Initiate login (PKCE flow)
 * - Handle token storage after successful exchange
 * - Proactive token refresh
 * - Logout (clear all tokens)
 */

import { writable, derived, get } from 'svelte/store';
import {
	generateCodeVerifier,
	generateCodeChallenge,
	generateStateNonce,
	buildAuthUrl,
} from '$lib/auth/pkce';
import {
	storeTokens,
	clearAllTokens,
	getRefreshToken,
	getAccessToken,
	isAccessTokenValid,
	setCodeVerifier,
} from '$lib/auth/tokens';
import { REQUIRED_SCOPES } from '$lib/spotify/scopes';

const AUTH_WORKER_URL =
	(import.meta.env.PUBLIC_AUTH_WORKER_URL as string | undefined) ?? 'http://localhost:8787';

const CLIENT_ID = import.meta.env.PUBLIC_SPOTIFY_CLIENT_ID as string;
const REDIRECT_URI = import.meta.env.PUBLIC_SPOTIFY_REDIRECT_URI as string;

const STATE_NONCE_KEY = 'spotify_auth_state';

interface AuthState {
	isAuthenticated: boolean;
	isLoading: boolean;
	error: string | null;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		isAuthenticated: isAccessTokenValid(),
		isLoading: false,
		error: null,
	});

	async function login(): Promise<void> {
		update((s) => ({ ...s, isLoading: true, error: null }));

		const codeVerifier = generateCodeVerifier();
		const codeChallenge = await generateCodeChallenge(codeVerifier);
		const state = generateStateNonce();

		setCodeVerifier(codeVerifier);
		sessionStorage.setItem(STATE_NONCE_KEY, state);

		const url = buildAuthUrl({
			clientId: CLIENT_ID,
			redirectUri: REDIRECT_URI,
			scopes: REQUIRED_SCOPES,
			codeChallenge,
			state,
		});

		window.location.href = url;
	}

	async function handleCallback(code: string, returnedState: string): Promise<void> {
		update((s) => ({ ...s, isLoading: true, error: null }));

		const expectedState = sessionStorage.getItem(STATE_NONCE_KEY);
		if (!expectedState || returnedState !== expectedState) {
			const msg = 'State mismatch — possible CSRF attack';
			update((s) => ({ ...s, isLoading: false, error: msg }));
			throw new Error(msg);
		}
		sessionStorage.removeItem(STATE_NONCE_KEY);

		const codeVerifier = sessionStorage.getItem('spotify_code_verifier');
		if (!codeVerifier) {
			const msg = 'Missing code_verifier';
			update((s) => ({ ...s, isLoading: false, error: msg }));
			throw new Error(msg);
		}

		const response = await fetch(`${AUTH_WORKER_URL}/exchange`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: REDIRECT_URI }),
		});

		if (!response.ok) {
			const err = await response.json().catch(() => ({})) as { error?: string };
			const msg = err.error ?? 'Token exchange failed';
			update((s) => ({ ...s, isLoading: false, error: msg }));
			throw new Error(msg);
		}

		const data = await response.json() as {
			access_token: string;
			refresh_token: string;
			expires_in: number;
		};

		storeTokens({
			accessToken: data.access_token,
			expiresIn: data.expires_in,
			refreshToken: data.refresh_token,
		});

		set({ isAuthenticated: true, isLoading: false, error: null });
	}

	async function refresh(): Promise<void> {
		const refreshToken = getRefreshToken();
		if (!refreshToken) {
			logout();
			return;
		}

		const response = await fetch(`${AUTH_WORKER_URL}/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refresh_token: refreshToken }),
		});

		if (!response.ok) {
			logout();
			return;
		}

		const data = await response.json() as {
			access_token: string;
			expires_in: number;
		};

		storeTokens({ accessToken: data.access_token, expiresIn: data.expires_in });
	}

	function logout(): void {
		clearAllTokens();
		set({ isAuthenticated: false, isLoading: false, error: null });
	}

	/** Return the current access token, refreshing first if needed. */
	async function getToken(): Promise<string | null> {
		if (!isAccessTokenValid()) {
			await refresh();
		}
		return getAccessToken();
	}

	return { subscribe, login, handleCallback, refresh, logout, getToken };
}

export const auth = createAuthStore();

/** Derived readable: true when user is authenticated. */
export const isAuthenticated = derived(auth, ($auth) => $auth.isAuthenticated);
