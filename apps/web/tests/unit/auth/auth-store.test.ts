/**
 * Tests for the auth Svelte store:
 * - state nonce validation on callback
 * - token exchange calls Worker /exchange correctly
 * - token refresh triggered within 60s of expiry
 * - token refresh retries on 401 exactly once, then fails cleanly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock $env/static/public before importing auth store
vi.mock('$env/static/public', () => ({
	PUBLIC_SPOTIFY_CLIENT_ID: 'test-client-id',
	PUBLIC_AUTH_WORKER_URL: 'https://auth-worker.test',
	PUBLIC_APP_ENV: 'local'
}));

// Mock config module
vi.mock('../../../src/lib/config', () => ({
	config: {
		spotifyClientId: 'test-client-id',
		authWorkerUrl: 'https://auth-worker.test',
		appEnv: 'local'
	},
	getRedirectUri: () => 'http://localhost:5173/auth/callback'
}));

import { authStore } from '../../../src/lib/stores/auth';
import { storeState, storeCodeVerifier, clearAllTokens, getRefreshToken } from '../../../src/lib/auth/tokens';

beforeEach(() => {
	sessionStorage.clear();
	localStorage.clear();
	vi.useFakeTimers();

	// Reset store to initial state by calling logout
	authStore.logout();
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
	clearAllTokens();
});

// ---------------------------------------------------------------------------
// State nonce validation
// ---------------------------------------------------------------------------

describe('handleCallback — state nonce validation', () => {
	it('sets error when no state is stored in sessionStorage', async () => {
		// No storeState() call — sessionStorage is empty
		await authStore.handleCallback('auth-code', 'some-state');

		const state = get(authStore);
		expect(state.isAuthenticated).toBe(false);
		expect(state.error).toMatch(/invalid state/i);
	});

	it('sets error when state does not match stored state', async () => {
		storeState('correct-state');
		await authStore.handleCallback('auth-code', 'wrong-state');

		const state = get(authStore);
		expect(state.isAuthenticated).toBe(false);
		expect(state.error).toMatch(/invalid state/i);
	});

	it('sets error when code verifier is missing', async () => {
		storeState('my-state');
		// No storeCodeVerifier() call
		await authStore.handleCallback('auth-code', 'my-state');

		const state = get(authStore);
		expect(state.isAuthenticated).toBe(false);
		expect(state.error).toMatch(/code verifier/i);
	});
});

// ---------------------------------------------------------------------------
// Token exchange — calls Worker /exchange endpoint correctly
// ---------------------------------------------------------------------------

describe('handleCallback — token exchange', () => {
	it('calls Worker /exchange with correct payload', async () => {
		storeState('valid-state');
		storeCodeVerifier('my-verifier');

		const mockFetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				access_token: 'access-abc',
				refresh_token: 'refresh-xyz',
				expires_in: 3600
			})
		});
		vi.stubGlobal('fetch', mockFetch);

		await authStore.handleCallback('auth-code-123', 'valid-state');

		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://auth-worker.test/token');
		expect(options.method).toBe('POST');

		const body = JSON.parse(options.body as string);
		expect(body.code).toBe('auth-code-123');
		expect(body.code_verifier).toBe('my-verifier');
		expect(body.redirect_uri).toBe('http://localhost:5173/auth/callback');
	});

	it('sets isAuthenticated and accessToken on success', async () => {
		storeState('valid-state');
		storeCodeVerifier('my-verifier');

		vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				access_token: 'the-access-token',
				refresh_token: 'the-refresh-token',
				expires_in: 3600
			})
		}));

		await authStore.handleCallback('code', 'valid-state');

		const state = get(authStore);
		expect(state.isAuthenticated).toBe(true);
		expect(state.accessToken).toBe('the-access-token');
		expect(state.error).toBeNull();
	});

	it('stores refresh token in localStorage on success', async () => {
		storeState('valid-state');
		storeCodeVerifier('my-verifier');

		vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				access_token: 'a',
				refresh_token: 'stored-refresh',
				expires_in: 3600
			})
		}));

		await authStore.handleCallback('code', 'valid-state');
		expect(getRefreshToken()).toBe('stored-refresh');
	});

	it('sets error when Worker returns non-ok response', async () => {
		storeState('valid-state');
		storeCodeVerifier('my-verifier');

		vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
			ok: false,
			status: 400,
			json: async () => ({ error: 'invalid_grant' })
		}));

		await authStore.handleCallback('code', 'valid-state');

		const state = get(authStore);
		expect(state.isAuthenticated).toBe(false);
		expect(state.error).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// Token refresh — triggered within 60s of expiry
// ---------------------------------------------------------------------------

describe('token refresh timing', () => {
	it('schedules refresh ~60 seconds before token expiry', async () => {
		storeState('valid-state');
		storeCodeVerifier('my-verifier');

		let exchangeDone = false;
		let refreshCallCount = 0;

		// First call: token exchange. Subsequent calls: refresh (returns a token
		// that expires far in the future so no second refresh timer fires in this test).
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
			if (!exchangeDone) {
				exchangeDone = true;
				return Promise.resolve({
					ok: true,
					json: async () => ({
						access_token: 'initial-token',
						refresh_token: 'my-refresh-token',
						expires_in: 3600 // expires in 1 hour
					})
				});
			}
			// refresh — long-lived token to prevent re-scheduling within this test
			refreshCallCount++;
			return Promise.resolve({
				ok: true,
				json: async () => ({
					access_token: 'refreshed-token',
					expires_in: 86400 // 24h
				})
			});
		}));

		await authStore.handleCallback('code', 'valid-state');

		// Token expires in 3600s; refresh timer fires at 3600s - 60s = 3540s
		// Just before refresh window: not called yet
		await vi.advanceTimersByTimeAsync(3539_000);
		expect(refreshCallCount).toBe(0);

		// Advance past the 3540s mark
		await vi.advanceTimersByTimeAsync(2_000);
		expect(refreshCallCount).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Token refresh — retries on 401 exactly once, then fails cleanly
// ---------------------------------------------------------------------------

describe('refreshAccessToken — 401 retry behavior', () => {
	it('retries once on 401, then logs out on second failure', async () => {
		localStorage.setItem('spotify_refresh_token', 'stale-refresh');

		let callCount = 0;
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
			callCount++;
			return Promise.resolve({
				ok: false,
				status: 401,
				json: async () => ({})
			});
		}));

		await authStore.refreshAccessToken();

		// Should have tried exactly twice (original + one retry)
		expect(callCount).toBe(2);

		// Store should be in logged-out state after clean failure
		const state = get(authStore);
		expect(state.isAuthenticated).toBe(false);
		expect(state.accessToken).toBeNull();
	});

	it('succeeds if second attempt returns 200', async () => {
		localStorage.setItem('spotify_refresh_token', 'my-refresh');

		let callCount = 0;
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
			}
			return Promise.resolve({
				ok: true,
				json: async () => ({ access_token: 'new-token', expires_in: 3600 })
			});
		}));

		await authStore.refreshAccessToken();

		expect(callCount).toBe(2);
		const state = get(authStore);
		expect(state.isAuthenticated).toBe(true);
		expect(state.accessToken).toBe('new-token');
	});
});

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

describe('logout', () => {
	it('resets store to initial state', async () => {
		// Simulate authenticated state
		storeState('valid-state');
		storeCodeVerifier('my-verifier');

		vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 })
		}));

		await authStore.handleCallback('code', 'valid-state');
		expect(get(authStore).isAuthenticated).toBe(true);

		authStore.logout();

		const state = get(authStore);
		expect(state.isAuthenticated).toBe(false);
		expect(state.accessToken).toBeNull();
		expect(state.expiresAt).toBeNull();
	});

	it('clears all tokens from storage', () => {
		localStorage.setItem('spotify_refresh_token', 'r');
		sessionStorage.setItem('spotify_code_verifier', 'v');

		authStore.logout();

		expect(localStorage.getItem('spotify_refresh_token')).toBeNull();
		expect(sessionStorage.getItem('spotify_code_verifier')).toBeNull();
	});
});
