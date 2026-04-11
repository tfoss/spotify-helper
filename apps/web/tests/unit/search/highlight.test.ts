/**
 * Tests for the search highlight utility.
 */

import { describe, it, expect } from 'vitest';
import { highlightMatches } from '../../../src/lib/search/highlight';

describe('highlightMatches', () => {
	it('returns single unhighlighted segment for empty query', () => {
		const result = highlightMatches('Hello World', '');
		expect(result).toEqual([{ text: 'Hello World', highlighted: false }]);
	});

	it('returns single unhighlighted segment when no match', () => {
		const result = highlightMatches('Hello World', 'xyz');
		expect(result).toEqual([{ text: 'Hello World', highlighted: false }]);
	});

	it('highlights matching portion case-insensitively', () => {
		const result = highlightMatches('Gold Digger', 'gold');
		expect(result.length).toBeGreaterThan(1);

		const highlighted = result.filter((s) => s.highlighted);
		expect(highlighted.length).toBe(1);
		expect(highlighted[0].text).toBe('Gold');
	});

	it('highlights multiple occurrences', () => {
		const result = highlightMatches('la la land', 'la');
		const highlighted = result.filter((s) => s.highlighted);
		expect(highlighted.length).toBe(3); // "la", "la", "la" (in "land")
	});

	it('handles full text match', () => {
		const result = highlightMatches('gold', 'gold');
		expect(result.some((s) => s.highlighted && s.text === 'gold')).toBe(true);
	});

	it('handles empty text', () => {
		const result = highlightMatches('', 'query');
		expect(result).toEqual([{ text: '', highlighted: false }]);
	});

	it('escapes regex special characters in query', () => {
		const result = highlightMatches('price: $10.99', '$10');
		const highlighted = result.filter((s) => s.highlighted);
		expect(highlighted.length).toBe(1);
		expect(highlighted[0].text).toBe('$10');
	});

	it('preserves original case in segments', () => {
		const result = highlightMatches('Taylor Swift', 'taylor');
		const highlighted = result.filter((s) => s.highlighted);
		expect(highlighted[0].text).toBe('Taylor');
	});

	it('returns non-empty segments only', () => {
		const result = highlightMatches('abc', 'abc');
		for (const segment of result) {
			expect(segment.text.length).toBeGreaterThan(0);
		}
	});
});
