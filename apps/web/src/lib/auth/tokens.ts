/**
 * Token storage utilities for Spotify OAuth.
 * Code verifier uses sessionStorage (ephemeral, per-tab).
 * Refresh token uses localStorage (persistent across sessions).
 */

const STORAGE_KEYS = {
	CODE_VERIFIER: 'spotify_code_verifier',
	STATE: 'spotify_auth_state',
	REFRESH_TOKEN: 'spotify_refresh_token'
} as const;

export { STORAGE_KEYS };

// --- Code Verifier (sessionStorage) ---

export function storeCodeVerifier(verifier: string): void {
	sessionStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, verifier);
}

export function getCodeVerifier(): string | null {
	return sessionStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
}

export function clearCodeVerifier(): void {
	sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
}

// --- Auth State (sessionStorage) ---

export function storeState(state: string): void {
	sessionStorage.setItem(STORAGE_KEYS.STATE, state);
}

export function getState(): string | null {
	return sessionStorage.getItem(STORAGE_KEYS.STATE);
}

export function clearState(): void {
	sessionStorage.removeItem(STORAGE_KEYS.STATE);
}

// --- Refresh Token (localStorage) ---

export function storeRefreshToken(token: string): void {
	localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
}

export function getRefreshToken(): string | null {
	return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

export function clearRefreshToken(): void {
	localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
}

// --- Bulk operations ---

/**
 * Clear all auth-related tokens from both sessionStorage and localStorage.
 */
export function clearAllTokens(): void {
	clearCodeVerifier();
	clearState();
	clearRefreshToken();
}
