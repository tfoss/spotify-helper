/**
 * Tests for token storage utilities.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	storeCodeVerifier,
	getCodeVerifier,
	clearCodeVerifier,
	storeState,
	getState,
	clearState,
	storeRefreshToken,
	getRefreshToken,
	clearRefreshToken,
	clearAllTokens,
	STORAGE_KEYS
} from '../../../src/lib/auth/tokens';

beforeEach(() => {
	sessionStorage.clear();
	localStorage.clear();
});

describe('code verifier (sessionStorage)', () => {
	it('stores and retrieves code verifier', () => {
		storeCodeVerifier('my-verifier');
		expect(getCodeVerifier()).toBe('my-verifier');
	});

	it('returns null when not set', () => {
		expect(getCodeVerifier()).toBeNull();
	});

	it('clears code verifier', () => {
		storeCodeVerifier('my-verifier');
		clearCodeVerifier();
		expect(getCodeVerifier()).toBeNull();
	});

	it('stores under the correct key', () => {
		storeCodeVerifier('v');
		expect(sessionStorage.getItem(STORAGE_KEYS.CODE_VERIFIER)).toBe('v');
	});
});

describe('state (sessionStorage)', () => {
	it('stores and retrieves state', () => {
		storeState('my-state');
		expect(getState()).toBe('my-state');
	});

	it('returns null when not set', () => {
		expect(getState()).toBeNull();
	});

	it('clears state', () => {
		storeState('my-state');
		clearState();
		expect(getState()).toBeNull();
	});
});

describe('refresh token (localStorage)', () => {
	it('stores and retrieves refresh token', () => {
		storeRefreshToken('refresh-abc');
		expect(getRefreshToken()).toBe('refresh-abc');
	});

	it('returns null when not set', () => {
		expect(getRefreshToken()).toBeNull();
	});

	it('clears refresh token', () => {
		storeRefreshToken('refresh-abc');
		clearRefreshToken();
		expect(getRefreshToken()).toBeNull();
	});

	it('stores under the correct key', () => {
		storeRefreshToken('r');
		expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBe('r');
	});
});

describe('clearAllTokens', () => {
	it('clears all token storage at once', () => {
		storeCodeVerifier('v');
		storeState('s');
		storeRefreshToken('r');

		clearAllTokens();

		expect(getCodeVerifier()).toBeNull();
		expect(getState()).toBeNull();
		expect(getRefreshToken()).toBeNull();
	});
});
