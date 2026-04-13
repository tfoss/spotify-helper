import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'spotify-helper-theme';

function applyTheme(theme: Theme): void {
	if (!browser) return;
	if (theme === 'dark') {
		document.documentElement.classList.add('dark');
		document.documentElement.classList.remove('light');
	} else {
		document.documentElement.classList.remove('dark');
		document.documentElement.classList.add('light');
	}
}

function resolveInitialTheme(): Theme {
	if (!browser) return 'dark';
	const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
	if (stored === 'dark' || stored === 'light') return stored;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function createThemeStore() {
	const { subscribe, set, update } = writable<Theme>('dark');

	/** Call once on mount to read localStorage / system preference and apply the class. */
	function init(): void {
		const theme = resolveInitialTheme();
		set(theme);
		applyTheme(theme);
	}

	/** Toggle between dark and light, persisting the choice. */
	function toggle(): void {
		update((current) => {
			const next: Theme = current === 'dark' ? 'light' : 'dark';
			if (browser) {
				localStorage.setItem(STORAGE_KEY, next);
				applyTheme(next);
			}
			return next;
		});
	}

	/** Explicitly set the theme. */
	function setTheme(theme: Theme): void {
		set(theme);
		if (browser) {
			localStorage.setItem(STORAGE_KEY, theme);
			applyTheme(theme);
		}
	}

	return { subscribe, init, toggle, setTheme };
}

export const themeStore = createThemeStore();
