/**
 * PKCE (Proof Key for Code Exchange) helpers for Spotify OAuth.
 * Generates a random code_verifier and derives code_challenge via SHA-256.
 */

const CODE_VERIFIER_LENGTH = 128;

/**
 * Generate a cryptographically random code_verifier string.
 * Uses URL-safe base64 characters (A-Z, a-z, 0-9, -, _, .).
 */
export function generateCodeVerifier(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_~.';
	const randomBytes = crypto.getRandomValues(new Uint8Array(CODE_VERIFIER_LENGTH));
	return Array.from(randomBytes)
		.map((byte) => chars[byte % chars.length])
		.join('');
}

/**
 * Derive the code_challenge from a code_verifier using SHA-256.
 * Returns the URL-safe base64-encoded SHA-256 hash (no padding).
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(codeVerifier);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return base64UrlEncode(digest);
}

/**
 * Encode an ArrayBuffer as URL-safe base64 (no padding).
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate a cryptographically random state nonce for CSRF protection.
 */
export function generateStateNonce(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return base64UrlEncode(bytes.buffer);
}

/**
 * Build a Spotify authorization URL with PKCE parameters.
 */
export function buildAuthUrl(params: {
	clientId: string;
	redirectUri: string;
	scopes: string[];
	codeChallenge: string;
	state: string;
}): string {
	const url = new URL('https://accounts.spotify.com/authorize');
	url.searchParams.set('client_id', params.clientId);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('redirect_uri', params.redirectUri);
	url.searchParams.set('scope', params.scopes.join(' '));
	url.searchParams.set('code_challenge_method', 'S256');
	url.searchParams.set('code_challenge', params.codeChallenge);
	url.searchParams.set('state', params.state);
	return url.toString();
}
