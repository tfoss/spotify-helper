/**
 * Fuzzy search helpers for playlist search.
 *
 * Implements Levenshtein-distance-based approximate matching so queries
 * with typos (e.g. "beatels") still find the right tracks ("The Beatles").
 *
 * All functions are pure and operate on already-fetched TrackRow arrays
 * rather than querying the DB directly, making them testable without a DB.
 */

import type { TrackRow } from '$lib/db/types';

// ---------------------------------------------------------------------------
// Levenshtein distance
// ---------------------------------------------------------------------------

/**
 * Compute the Levenshtein edit distance between two strings.
 *
 * Uses the standard iterative two-row DP algorithm — O(n·m) time,
 * O(min(n, m)) space.
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns The minimum number of single-character edits to transform a → b.
 */
export function levenshteinDistance(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	// Keep the shorter string in 'a' to minimise memory
	if (a.length > b.length) {
		const tmp = a;
		a = b;
		b = tmp;
	}

	const lenA = a.length;
	const lenB = b.length;

	let prev = Array.from({ length: lenA + 1 }, (_, i) => i);
	let curr = new Array<number>(lenA + 1);

	for (let j = 1; j <= lenB; j++) {
		curr[0] = j;
		for (let i = 1; i <= lenA; i++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[i] = Math.min(
				prev[i] + 1,       // deletion
				curr[i - 1] + 1,   // insertion
				prev[i - 1] + cost, // substitution
			);
		}
		[prev, curr] = [curr, prev];
	}

	return prev[lenA];
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Minimum fuzzy score to include a track in results (0–1). */
export const FUZZY_THRESHOLD = 0.5;

/**
 * Score how well `query` matches a single token.
 *
 * - Exact substring match → 1.0
 * - Otherwise: 1 − (editDistance / max(queryLen, tokenLen))
 *
 * @param token - A single word from the candidate text (lowercase).
 * @param query - The search query (lowercase).
 * @returns Score in [0, 1].
 */
export function tokenScore(token: string, query: string): number {
	if (token.includes(query)) return 1.0;
	const dist = levenshteinDistance(token, query);
	const maxLen = Math.max(token.length, query.length);
	return maxLen === 0 ? 1.0 : 1 - dist / maxLen;
}

/**
 * Compute the best fuzzy score for `query` against any token in `text`.
 *
 * Splits `text` on whitespace and returns the maximum per-token score.
 * This allows "beatels" to score highly against "The Beatles" by matching
 * the token "beatles" rather than the full string.
 *
 * @param text  - Candidate text to match against (will be lowercased).
 * @param query - Search query (will be lowercased).
 * @returns Best token score in [0, 1].
 */
export function fuzzyScore(text: string, query: string): number {
	if (!text || !query) return 0;
	const normText = text.toLowerCase();
	const normQuery = query.toLowerCase();

	// Fast path: exact substring match in the full text
	if (normText.includes(normQuery)) return 1.0;

	const tokens = normText.split(/\s+/).filter(Boolean);
	let best = 0;
	for (const token of tokens) {
		const s = tokenScore(token, normQuery);
		if (s > best) best = s;
	}
	return best;
}

// ---------------------------------------------------------------------------
// Track-level scoring and filtering
// ---------------------------------------------------------------------------

/** A track enriched with its fuzzy match score (0–1). */
export interface ScoredTrack {
	track: TrackRow;
	/** Highest fuzzy score across name and artist fields. */
	score: number;
	/** Which field produced the best score. */
	matchField: 'name' | 'artist';
}

/**
 * Score and filter a list of tracks against `query`.
 *
 * Computes the fuzzy score against both track name and artist name,
 * keeps only tracks above `FUZZY_THRESHOLD`, and returns them sorted
 * by score descending (best matches first).
 *
 * @param tracks - Candidate tracks to filter.
 * @param query  - Search query string.
 * @returns Scored tracks above the threshold, best first.
 */
export function fuzzyFilterTracks(tracks: TrackRow[], query: string): ScoredTrack[] {
	if (!query.trim()) return [];

	const normQuery = query.toLowerCase();
	const scored: ScoredTrack[] = [];

	for (const track of tracks) {
		const nameScore = fuzzyScore(track.name, normQuery);
		const artistScore = fuzzyScore(track.artist_name, normQuery);

		const score = Math.max(nameScore, artistScore);
		if (score >= FUZZY_THRESHOLD) {
			scored.push({
				track,
				score,
				matchField: nameScore >= artistScore ? 'name' : 'artist',
			});
		}
	}

	// Sort best-first
	scored.sort((a, b) => b.score - a.score);
	return scored;
}
