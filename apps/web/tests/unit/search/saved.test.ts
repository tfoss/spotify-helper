/**
 * Tests for saved search persistence helpers.
 *
 * Covers: getSavedSearches, saveSearch, removeSavedSearch —
 * specifically that data round-trips through localStorage correctly
 * and that removal/ordering behave as expected.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSavedSearches, saveSearch, removeSavedSearch } from '../../../src/lib/search/saved';
import type { SavedSearch } from '../../../src/lib/search/saved';

const STORAGE_KEY = 'spotify_saved_searches';

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getSavedSearches
// ---------------------------------------------------------------------------

describe('getSavedSearches', () => {
	it('returns empty array when nothing is stored', () => {
		expect(getSavedSearches()).toEqual([]);
	});

	it('returns empty array when localStorage value is not valid JSON', () => {
		localStorage.setItem(STORAGE_KEY, 'not-json{{{');
		expect(getSavedSearches()).toEqual([]);
	});

	it('returns empty array when stored value is not an array', () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
		expect(getSavedSearches()).toEqual([]);
	});

	it('returns stored searches sorted newest first', () => {
		const searches: SavedSearch[] = [
			{ id: '1', name: 'Old', query: 'a', artistQuery: '', refined: false, fuzzy: false, savedAt: 1000 },
			{ id: '2', name: 'New', query: 'b', artistQuery: '', refined: false, fuzzy: false, savedAt: 2000 }
		];
		localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));

		const result = getSavedSearches();
		expect(result[0].id).toBe('2');
		expect(result[1].id).toBe('1');
	});
});

// ---------------------------------------------------------------------------
// saveSearch
// ---------------------------------------------------------------------------

describe('saveSearch', () => {
	it('persists a search and returns the updated list', () => {
		const list = saveSearch('Beatles', { query: 'beatles', artistQuery: '', refined: false, fuzzy: false });
		expect(list).toHaveLength(1);
		expect(list[0].name).toBe('Beatles');
		expect(list[0].query).toBe('beatles');
	});

	it('uses the query as name when name is empty', () => {
		const list = saveSearch('', { query: 'radiohead', artistQuery: '', refined: false, fuzzy: false });
		expect(list[0].name).toBe('radiohead');
	});

	it('uses fallback name "Untitled search" when name and query are blank', () => {
		const list = saveSearch('   ', { query: '', artistQuery: '', refined: false, fuzzy: false });
		expect(list[0].name).toBe('Untitled search');
	});

	it('prepends new search to the front of the list', () => {
		saveSearch('First', { query: 'first', artistQuery: '', refined: false, fuzzy: false });
		const list = saveSearch('Second', { query: 'second', artistQuery: '', refined: false, fuzzy: false });
		expect(list[0].name).toBe('Second');
		expect(list[1].name).toBe('First');
	});

	it('stores refined search with artistQuery', () => {
		const list = saveSearch('Refined', { query: 'yesterday', artistQuery: 'beatles', refined: true, fuzzy: false });
		expect(list[0].refined).toBe(true);
		expect(list[0].artistQuery).toBe('beatles');
	});

	it('persists to localStorage so getSavedSearches reads it back', () => {
		saveSearch('My search', { query: 'pink floyd', artistQuery: '', refined: false, fuzzy: true });
		const from_storage = getSavedSearches();
		expect(from_storage).toHaveLength(1);
		expect(from_storage[0].name).toBe('My search');
		expect(from_storage[0].fuzzy).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// removeSavedSearch
// ---------------------------------------------------------------------------

describe('removeSavedSearch', () => {
	it('removes the search with the given id', () => {
		saveSearch('A', { query: 'a', artistQuery: '', refined: false, fuzzy: false });
		saveSearch('B', { query: 'b', artistQuery: '', refined: false, fuzzy: false });
		const all = getSavedSearches();
		const idToRemove = all.find((s) => s.name === 'A')!.id;

		const updated = removeSavedSearch(idToRemove);
		expect(updated).toHaveLength(1);
		expect(updated[0].name).toBe('B');
	});

	it('is a no-op when the id does not exist', () => {
		saveSearch('Keep me', { query: 'x', artistQuery: '', refined: false, fuzzy: false });
		const updated = removeSavedSearch('nonexistent-id');
		expect(updated).toHaveLength(1);
		expect(updated[0].name).toBe('Keep me');
	});

	it('returns empty array after removing the only item', () => {
		const list = saveSearch('Lone', { query: 'lone', artistQuery: '', refined: false, fuzzy: false });
		const updated = removeSavedSearch(list[0].id);
		expect(updated).toEqual([]);
		expect(getSavedSearches()).toEqual([]);
	});

	it('persists the removal to localStorage', () => {
		const list = saveSearch('Gone', { query: 'gone', artistQuery: '', refined: false, fuzzy: false });
		removeSavedSearch(list[0].id);
		expect(getSavedSearches()).toEqual([]);
	});
});
