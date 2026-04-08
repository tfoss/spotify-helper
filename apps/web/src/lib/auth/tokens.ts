/**
 * Token storage and management for Spotify OAuth.
 *
 * Storage strategy:
 * - access_token: in-memory only (never persisted)
 * - refresh_token: localStorage (survives page reloads)
 * - code_verifier: sessionStorage (tab-scoped, discarded after exchange)
 *
 * Proactive refresh: triggers when within 60 seconds of access token expiry.
 */

const REFRESH_TOKEN_KEY = 'spotify_refresh_token';
const CODE_VERIFIER_KEY = 'spotify_code_verifier';
const REFRESH_THRESHOLD_SECONDS = 60;

interface TokenState {
	accessToken: string | null;
	expiresAt: number | null; // Unix timestamp in ms
}

const state: TokenState = {
	accessToken: null,
	expiresAt: null,
};

// --- Access token (in-memory) ---

/**
 * Store an access token with its expiry in memory.
 * @param token - The access token string.
 * @param expiresIn - Lifetime in seconds (from Spotify API response).
 */
export function setAccessToken(token: string, expiresIn: number): void {
	state.accessToken = token;
	state.expiresAt = Date.now() + expiresIn * 1000;
}

/**
 * Retrieve the current access token, or null if not set.
 */
export function getAccessToken(): string | null {
	return state.accessToken;
}

/**
 * Return true if the access token is still valid and not near expiry.
 */
export function isAccessTokenValid(): boolean {
	if (!state.accessToken || state.expiresAt === null) return false;
	return Date.now() < state.expiresAt - REFRESH_THRESHOLD_SECONDS * 1000;
}

/**
 * Return true if the access token is within the proactive refresh window.
 */
export function isAccessTokenExpiringSoon(): boolean {
	if (!state.accessToken || state.expiresAt === null) return false;
	const now = Date.now();
	return now >= state.expiresAt - REFRESH_THRESHOLD_SECONDS * 1000 && now < state.expiresAt;
}

/**
 * Clear the in-memory access token.
 */
export function clearAccessToken(): void {
	state.accessToken = null;
	state.expiresAt = null;
}

// --- Refresh token (localStorage) ---

/**
 * Persist the refresh token to localStorage.
 */
export function setRefreshToken(token: string): void {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(REFRESH_TOKEN_KEY, token);
	}
}

/**
 * Retrieve the refresh token from localStorage.
 */
export function getRefreshToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Remove the refresh token from localStorage.
 */
export function clearRefreshToken(): void {
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem(REFRESH_TOKEN_KEY);
	}
}

// --- Code verifier (sessionStorage) ---

/**
 * Store the PKCE code_verifier in sessionStorage for the duration of the auth flow.
 */
export function setCodeVerifier(verifier: string): void {
	if (typeof sessionStorage !== 'undefined') {
		sessionStorage.setItem(CODE_VERIFIER_KEY, verifier);
	}
}

/**
 * Retrieve the PKCE code_verifier from sessionStorage.
 */
export function getCodeVerifier(): string | null {
	if (typeof sessionStorage === 'undefined') return null;
	return sessionStorage.getItem(CODE_VERIFIER_KEY);
}

/**
 * Remove the code_verifier from sessionStorage after use.
 */
export function clearCodeVerifier(): void {
	if (typeof sessionStorage !== 'undefined') {
		sessionStorage.removeItem(CODE_VERIFIER_KEY);
	}
}

// --- Composite helpers ---

/**
 * Store all tokens returned from a successful exchange or refresh.
 */
export function storeTokens(params: {
	accessToken: string;
	expiresIn: number;
	refreshToken?: string;
}): void {
	setAccessToken(params.accessToken, params.expiresIn);
	if (params.refreshToken) {
		setRefreshToken(params.refreshToken);
	}
}

/**
 * Clear all stored tokens (access, refresh, code_verifier).
 * Call on logout.
 */
export function clearAllTokens(): void {
	clearAccessToken();
	clearRefreshToken();
	clearCodeVerifier();
}
