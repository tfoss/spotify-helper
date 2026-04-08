/**
 * Tests for PKCE auth helpers.
 * Includes a known-vector test for code_verifier / code_challenge generation.
 */

import { describe, it, expect } from 'vitest';
import {
	generateCodeVerifier,
	generateCodeChallenge,
	generateState,
	buildAuthUrl
} from '../../../src/lib/auth/pkce';

describe('generateCodeVerifier', () => {
	it('returns a string of the default length (64)', () => {
		const verifier = generateCodeVerifier();
		expect(verifier).toHaveLength(64);
	});

	it('returns a string of custom length', () => {
		const verifier = generateCodeVerifier(96);
		expect(verifier).toHaveLength(96);
	});

	it('only contains unreserved RFC 7636 characters', () => {
		const verifier = generateCodeVerifier(128);
		expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
	});

	it('throws for length < 43', () => {
		expect(() => generateCodeVerifier(42)).toThrow(RangeError);
	});

	it('throws for length > 128', () => {
		expect(() => generateCodeVerifier(129)).toThrow(RangeError);
	});

	it('produces different values on repeated calls', () => {
		const a = generateCodeVerifier();
		const b = generateCodeVerifier();
		expect(a).not.toBe(b);
	});
});

describe('generateCodeChallenge — known-vector test', () => {
	/**
	 * Known-vector from RFC 7636 Appendix B:
	 *   verifier  = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	 *   challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
	 */
	it('produces the RFC 7636 Appendix B known-vector challenge', async () => {
		const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
		const challenge = await generateCodeChallenge(verifier);
		expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
	});

	it('produces a base64url-encoded string (no +, /, or = chars)', async () => {
		const verifier = generateCodeVerifier();
		const challenge = await generateCodeChallenge(verifier);
		expect(challenge).not.toContain('+');
		expect(challenge).not.toContain('/');
		expect(challenge).not.toContain('=');
	});
});

describe('generateState', () => {
	it('returns a non-empty string', () => {
		const state = generateState();
		expect(state.length).toBeGreaterThan(0);
	});

	it('produces different values on repeated calls', () => {
		const a = generateState();
		const b = generateState();
		expect(a).not.toBe(b);
	});
});

describe('buildAuthUrl', () => {
	it('returns a valid Spotify authorize URL', () => {
		const url = buildAuthUrl(
			'test-client-id',
			'http://localhost:5173/auth/callback',
			'test-challenge',
			'test-state',
			['user-read-private', 'user-read-email']
		);

		expect(url).toMatch(/^https:\/\/accounts\.spotify\.com\/authorize\?/);
	});

	it('includes all required PKCE parameters', () => {
		const url = buildAuthUrl(
			'my-client',
			'https://example.com/callback',
			'my-challenge',
			'my-state',
			['user-top-read']
		);

		const params = new URL(url).searchParams;
		expect(params.get('response_type')).toBe('code');
		expect(params.get('client_id')).toBe('my-client');
		expect(params.get('redirect_uri')).toBe('https://example.com/callback');
		expect(params.get('code_challenge_method')).toBe('S256');
		expect(params.get('code_challenge')).toBe('my-challenge');
		expect(params.get('state')).toBe('my-state');
		expect(params.get('scope')).toBe('user-top-read');
	});

	it('joins multiple scopes with a space', () => {
		const url = buildAuthUrl('c', 'http://x', 'ch', 'st', [
			'user-read-private',
			'user-top-read'
		]);
		const scope = new URL(url).searchParams.get('scope');
		expect(scope).toBe('user-read-private user-top-read');
	});
});
