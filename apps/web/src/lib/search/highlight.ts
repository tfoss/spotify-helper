/**
 * Text highlighting utility for search results.
 *
 * Splits text into segments based on case-insensitive query matches,
 * marking which segments are highlighted. Used by HighlightText.svelte.
 */

/** A segment of text, either highlighted or plain. */
export interface TextSegment {
	text: string;
	highlighted: boolean;
}

/**
 * Split text into segments based on a search query.
 *
 * Performs case-insensitive matching. If the query is empty or not found,
 * returns a single unhighlighted segment.
 *
 * @param text  - The full text to search within.
 * @param query - The search query to highlight.
 * @returns Array of text segments with highlight flags.
 */
export function highlightMatches(text: string, query: string): TextSegment[] {
	if (!query.trim() || !text) {
		return [{ text, highlighted: false }];
	}

	const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const regex = new RegExp(`(${escaped})`, 'gi');
	const parts = text.split(regex);

	if (parts.length === 1) {
		return [{ text, highlighted: false }];
	}

	return parts
		.filter((part) => part.length > 0)
		.map((part) => ({
			text: part,
			highlighted: regex.test(part) || part.toLowerCase() === query.toLowerCase(),
		}));
}
