/**
 * Dark mode preference store.
 *
 * Manages the user's theme preference (dark/light) with:
 * - localStorage persistence across page loads
 * - prefers-color-scheme fallback on first visit
 * - Applies/removes the `dark` class on <html> for Tailwind class-based dark mode
 */

const STORAGE_KEY = 'spotify_theme_preference';

export type ThemePreference = 'dark' | 'light';

/**
 * Determine the initial preference: stored value → OS preference → light.
 * Must be called in a browser context.
 */
export function getInitialPreference(): ThemePreference {
	try {
		const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
		if (stored === 'dark' || stored === 'light') return stored;
	} catch {
		// localStorage unavailable (private browsing, etc.)
	}
	if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
		return 'dark';
	}
	return 'light';
}

/** Apply the given theme to the document root element. */
export function applyTheme(theme: ThemePreference): void {
	if (typeof document === 'undefined') return;
	if (theme === 'dark') {
		document.documentElement.classList.add('dark');
	} else {
		document.documentElement.classList.remove('dark');
	}
}

/** Persist the preference to localStorage (no-op if unavailable). */
export function persistPreference(theme: ThemePreference): void {
	try {
		localStorage.setItem(STORAGE_KEY, theme);
	} catch {
		// Ignore storage errors
	}
}

/** Svelte store for the active theme preference. */
import { writable } from 'svelte/store';

function createDarkModeStore() {
	// Start with a default; initialize() will correct it on mount.
	const { subscribe, set } = writable<ThemePreference>('light');

	/** Call on component mount (browser only) to hydrate from storage + apply class. */
	function initialize(): void {
		const pref = getInitialPreference();
		set(pref);
		applyTheme(pref);
	}

	/** Toggle between dark and light, persisting the new value. */
	function toggle(): void {
		let next: ThemePreference = 'light';
		subscribe((current) => {
			next = current === 'dark' ? 'light' : 'dark';
		})();
		set(next);
		applyTheme(next);
		persistPreference(next);
	}

	/** Explicitly set the theme. */
	function setTheme(theme: ThemePreference): void {
		set(theme);
		applyTheme(theme);
		persistPreference(theme);
	}

	return { subscribe, initialize, toggle, setTheme };
}

export const darkMode = createDarkModeStore();
