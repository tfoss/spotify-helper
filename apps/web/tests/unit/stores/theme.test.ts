/**
 * Tests for the theme store:
 * - dark mode class applied to root element when preference is dark
 * - light mode class applied when preference is light
 * - preference persists to localStorage
 * - falls back to prefers-color-scheme on first load
 * - toggle switches between modes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock $app/environment before importing the store
vi.mock('$app/environment', () => ({
	browser: true,
}));

// We manipulate document.documentElement directly in tests
let storedTheme: string | null = null;
const classListState = new Set<string>();

beforeEach(() => {
	storedTheme = null;
	classListState.clear();

	vi.stubGlobal('localStorage', {
		getItem: (key: string) => (key === 'spotify-helper-theme' ? storedTheme : null),
		setItem: (key: string, value: string) => {
			if (key === 'spotify-helper-theme') storedTheme = value;
		},
		removeItem: (key: string) => {
			if (key === 'spotify-helper-theme') storedTheme = null;
		},
	});

	vi.stubGlobal('document', {
		documentElement: {
			classList: {
				add: (cls: string) => classListState.add(cls),
				remove: (cls: string) => classListState.delete(cls),
				contains: (cls: string) => classListState.has(cls),
			},
		},
	});

	vi.stubGlobal('window', {
		matchMedia: (_query: string) => ({ matches: false }),
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

async function importFreshStore() {
	// Re-import each time to get a fresh store after vi.resetModules()
	const mod = await import('../../../src/lib/stores/theme');
	return mod.themeStore;
}

describe('themeStore.init()', () => {
	it('applies dark class when localStorage has "dark"', async () => {
		storedTheme = 'dark';
		const store = await importFreshStore();
		store.init();
		expect(classListState.has('dark')).toBe(true);
		expect(classListState.has('light')).toBe(false);
		expect(get(store)).toBe('dark');
	});

	it('applies light class when localStorage has "light"', async () => {
		storedTheme = 'light';
		const store = await importFreshStore();
		store.init();
		expect(classListState.has('light')).toBe(true);
		expect(classListState.has('dark')).toBe(false);
		expect(get(store)).toBe('light');
	});

	it('falls back to dark when system prefers dark and no stored preference', async () => {
		storedTheme = null;
		vi.stubGlobal('window', {
			matchMedia: (query: string) => ({ matches: query === '(prefers-color-scheme: dark)' }),
		});
		const store = await importFreshStore();
		store.init();
		expect(classListState.has('dark')).toBe(true);
		expect(get(store)).toBe('dark');
	});

	it('falls back to light when system prefers light and no stored preference', async () => {
		storedTheme = null;
		vi.stubGlobal('window', {
			matchMedia: (_query: string) => ({ matches: false }),
		});
		const store = await importFreshStore();
		store.init();
		expect(classListState.has('light')).toBe(true);
		expect(classListState.has('dark')).toBe(false);
		expect(get(store)).toBe('light');
	});
});

describe('themeStore.toggle()', () => {
	it('switches from dark to light and updates localStorage', async () => {
		storedTheme = 'dark';
		const store = await importFreshStore();
		store.init();
		store.toggle();
		expect(classListState.has('light')).toBe(true);
		expect(classListState.has('dark')).toBe(false);
		expect(get(store)).toBe('light');
		expect(storedTheme).toBe('light');
	});

	it('switches from light to dark and updates localStorage', async () => {
		storedTheme = 'light';
		const store = await importFreshStore();
		store.init();
		store.toggle();
		expect(classListState.has('dark')).toBe(true);
		expect(classListState.has('light')).toBe(false);
		expect(get(store)).toBe('dark');
		expect(storedTheme).toBe('dark');
	});
});

describe('themeStore.setTheme()', () => {
	it('sets dark theme explicitly', async () => {
		storedTheme = 'light';
		const store = await importFreshStore();
		store.init();
		store.setTheme('dark');
		expect(classListState.has('dark')).toBe(true);
		expect(get(store)).toBe('dark');
		expect(storedTheme).toBe('dark');
	});

	it('sets light theme explicitly', async () => {
		storedTheme = 'dark';
		const store = await importFreshStore();
		store.init();
		store.setTheme('light');
		expect(classListState.has('light')).toBe(true);
		expect(classListState.has('dark')).toBe(false);
		expect(get(store)).toBe('light');
		expect(storedTheme).toBe('light');
	});
});
