/**
 * Svelte store for search state.
 *
 * Wraps the `searchPlaylists` domain function with debouncing and
 * loading/error state management. Components bind to this store rather
 * than calling the search function directly.
 */

import { writable } from 'svelte/store';
import { searchPlaylists } from '$lib/search';
import type { SearchQuery, SearchResults } from '$lib/search/types';
import type { DbExecutor } from '$lib/db/types';

const DEBOUNCE_MS = 300;

interface SearchState {
	query: SearchQuery | null;
	results: SearchResults | null;
	isSearching: boolean;
	error: string | null;
}

function createSearchStore() {
	const { subscribe, set, update } = writable<SearchState>({
		query: null,
		results: null,
		isSearching: false,
		error: null,
	});

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function performSearch(query: SearchQuery, exec: DbExecutor): void {
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
		}

		if (!query.query.trim()) {
			set({ query, results: null, isSearching: false, error: null });
			return;
		}

		update((s) => ({ ...s, query, isSearching: true, error: null }));

		debounceTimer = setTimeout(async () => {
			try {
				const results = await searchPlaylists(query, exec);
				update((s) => ({ ...s, results, isSearching: false }));
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'Search failed';
				update((s) => ({ ...s, isSearching: false, error: msg }));
			}
		}, DEBOUNCE_MS);
	}

	function clearSearch(): void {
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		set({ query: null, results: null, isSearching: false, error: null });
	}

	return { subscribe, performSearch, clearSearch };
}

export const search = createSearchStore();
