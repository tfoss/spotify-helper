/**
 * Tests for the dark mode store and helpers.
 *
 * Covers:
 * - getInitialPreference: localStorage → OS fallback → light default
 * - applyTheme: adds/removes `dark` class on document.documentElement
 * - persistPreference: writes to localStorage
 * - darkMode store: initialize, toggle, setTheme
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { getInitialPreference, applyTheme, persistPreference, darkMode } from '../../src/lib/stores/darkMode';

const STORAGE_KEY = 'spotify_theme_preference';

beforeEach(() => {
	localStorage.clear();
	// Reset documentElement classes
	document.documentElement.classList.remove('dark');
});

afterEach(() => {
	localStorage.clear();
	document.documentElement.classList.remove('dark');
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getInitialPreference
// ---------------------------------------------------------------------------

describe('getInitialPreference', () => {
	it('returns stored "dark" preference from localStorage', () => {
		localStorage.setItem(STORAGE_KEY, 'dark');
		expect(getInitialPreference()).toBe('dark');
	});

	it('returns stored "light" preference from localStorage', () => {
		localStorage.setItem(STORAGE_KEY, 'light');
		expect(getInitialPreference()).toBe('light');
	});

	it('falls back to OS dark preference when nothing is stored', () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({
			matches: true,
			media: '(prefers-color-scheme: dark)',
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn()
		} as MediaQueryList);

		expect(getInitialPreference()).toBe('dark');
	});

	it('falls back to "light" when OS prefers light and nothing is stored', () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({
			matches: false,
			media: '(prefers-color-scheme: dark)',
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn()
		} as MediaQueryList);

		expect(getInitialPreference()).toBe('light');
	});

	it('localStorage takes precedence over OS preference', () => {
		localStorage.setItem(STORAGE_KEY, 'light');
		vi.spyOn(window, 'matchMedia').mockReturnValue({
			matches: true, // OS says dark
			media: '(prefers-color-scheme: dark)',
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn()
		} as MediaQueryList);

		expect(getInitialPreference()).toBe('light');
	});
});

// ---------------------------------------------------------------------------
// applyTheme
// ---------------------------------------------------------------------------

describe('applyTheme', () => {
	it('adds "dark" class to documentElement when theme is "dark"', () => {
		applyTheme('dark');
		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});

	it('removes "dark" class from documentElement when theme is "light"', () => {
		document.documentElement.classList.add('dark');
		applyTheme('light');
		expect(document.documentElement.classList.contains('dark')).toBe(false);
	});

	it('is idempotent — applying dark twice does not error', () => {
		applyTheme('dark');
		applyTheme('dark');
		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// persistPreference
// ---------------------------------------------------------------------------

describe('persistPreference', () => {
	it('stores "dark" in localStorage', () => {
		persistPreference('dark');
		expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
	});

	it('stores "light" in localStorage', () => {
		persistPreference('light');
		expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
	});
});

// ---------------------------------------------------------------------------
// darkMode store
// ---------------------------------------------------------------------------

describe('darkMode store', () => {
	it('initialize() sets store value from localStorage and applies dark class', () => {
		localStorage.setItem(STORAGE_KEY, 'dark');
		darkMode.initialize();

		expect(get(darkMode)).toBe('dark');
		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});

	it('initialize() sets store to "light" and removes dark class when preference is light', () => {
		localStorage.setItem(STORAGE_KEY, 'light');
		document.documentElement.classList.add('dark'); // pre-applied
		darkMode.initialize();

		expect(get(darkMode)).toBe('light');
		expect(document.documentElement.classList.contains('dark')).toBe(false);
	});

	it('setTheme("dark") applies dark class and updates store', () => {
		darkMode.setTheme('dark');
		expect(get(darkMode)).toBe('dark');
		expect(document.documentElement.classList.contains('dark')).toBe(true);
		expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
	});

	it('setTheme("light") removes dark class and updates store', () => {
		darkMode.setTheme('dark');
		darkMode.setTheme('light');
		expect(get(darkMode)).toBe('light');
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
	});

	it('toggle() switches from light to dark', () => {
		darkMode.setTheme('light');
		darkMode.toggle();
		expect(get(darkMode)).toBe('dark');
		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});

	it('toggle() switches from dark to light', () => {
		darkMode.setTheme('dark');
		darkMode.toggle();
		expect(get(darkMode)).toBe('light');
		expect(document.documentElement.classList.contains('dark')).toBe(false);
	});
});
