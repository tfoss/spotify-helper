/**
 * Saved searches — persist named search presets to localStorage.
 *
 * Each saved search captures the full search state (query, artist query,
 * refined mode, and fuzzy flag) so it can be one-click restored.
 */

const STORAGE_KEY = 'spotify_saved_searches';

export interface SavedSearch {
	/** Unique identifier (timestamp string). */
	id: string;
	/** Human-readable label chosen by the user. */
	name: string;
	/** Main query (track name in refined mode, combined in unified mode). */
	query: string;
	/** Artist query — only relevant in refined mode. */
	artistQuery: string;
	/** Whether refined (separate track + artist) mode was active. */
	refined: boolean;
	/** Whether fuzzy matching was active. */
	fuzzy: boolean;
	/** Unix timestamp (ms) of when the search was saved. */
	savedAt: number;
}

/** Read all saved searches from localStorage, newest first. */
export function getSavedSearches(): SavedSearch[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return (parsed as SavedSearch[]).sort((a, b) => b.savedAt - a.savedAt);
	} catch {
		return [];
	}
}

let _idCounter = 0;

/** Generate a unique id even when called multiple times within the same millisecond. */
function uniqueId(): string {
	return `${Date.now()}-${++_idCounter}`;
}

/** Persist a new saved search. Returns the updated list. */
export function saveSearch(
	name: string,
	params: Omit<SavedSearch, 'id' | 'name' | 'savedAt'>
): SavedSearch[] {
	const existing = getSavedSearches();
	const resolvedName = name.trim() || params.query.trim() || 'Untitled search';
	const entry: SavedSearch = {
		id: uniqueId(),
		name: resolvedName,
		savedAt: Date.now(),
		...params
	};
	const updated = [entry, ...existing];
	writeSavedSearches(updated);
	return updated;
}

/** Remove a saved search by id. Returns the updated list. */
export function removeSavedSearch(id: string): SavedSearch[] {
	const updated = getSavedSearches().filter((s) => s.id !== id);
	writeSavedSearches(updated);
	return updated;
}

/** Overwrite the entire saved searches list in localStorage. */
function writeSavedSearches(searches: SavedSearch[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
	} catch {
		// Storage quota exceeded or private browsing — silently ignore.
	}
}
