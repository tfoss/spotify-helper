/**
 * PKCE (Proof Key for Code Exchange) helpers for Spotify OAuth 2.0.
 * Implements RFC 7636 for public client authorization.
 */

const UNRESERVED_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/**
 * Generate a cryptographically random code verifier string.
 * Uses unreserved characters per RFC 7636 Section 4.1.
 * Length must be between 43 and 128 characters.
 */
export function generateCodeVerifier(length: number = 64): string {
	if (length < 43 || length > 128) {
		throw new RangeError('Code verifier length must be between 43 and 128 characters');
	}

	const randomValues = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(randomValues)
		.map((byte) => UNRESERVED_CHARS[byte % UNRESERVED_CHARS.length])
		.join('');
}

/**
 * Generate a code challenge from a code verifier using S256 method.
 * Returns the base64url-encoded SHA-256 hash of the verifier.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(verifier);
	const digest = await crypto.subtle.digest('SHA-256', data);

	return base64UrlEncode(digest);
}

/**
 * Generate a random state parameter for CSRF protection.
 */
export function generateState(): string {
	const randomValues = crypto.getRandomValues(new Uint8Array(32));
	return base64UrlEncode(randomValues.buffer as ArrayBuffer);
}

/**
 * Build the full Spotify authorization URL with PKCE parameters.
 */
export function buildAuthUrl(
	clientId: string,
	redirectUri: string,
	codeChallenge: string,
	state: string,
	scopes: readonly string[]
): string {
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: clientId,
		redirect_uri: redirectUri,
		code_challenge_method: 'S256',
		code_challenge: codeChallenge,
		state,
		scope: scopes.join(' ')
	});

	return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Base64url encode an ArrayBuffer (no padding, URL-safe alphabet).
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
