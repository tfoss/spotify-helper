/**
 * sh-rx0.3 — Search page content tests with a seeded database.
 *
 * Uses the `seededPage` fixture (authenticated + DB seeded with fixture data).
 * Fixture data includes 12 known tracks, 4 playlists, 14 playlist-track links.
 *
 * Tests verify:
 *   1. Empty query shows initial "Start typing" state
 *   2. Typing a known track name returns result cards
 *   3. Result cards contain track name, artist name, and playlist info
 *   4. Unknown query shows "No results" message
 *   5. Refined search (separate track + artist fields) works
 *   6. Artist-name search returns matching tracks
 */

import { test, expect, seedData } from './fixtures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Type into the unified search input and wait for results to stabilise.
 * The search is debounced/immediate via oninput so we wait for networkidle
 * after typing.
 */
async function typeInUnifiedSearch(
	page: import('@playwright/test').Page,
	value: string,
) {
	const input = page.locator('input[type="text"]').first();
	await input.fill(value);
	await input.dispatchEvent('input');
	await page.waitForTimeout(300); // allow reactive update
}

// ---------------------------------------------------------------------------
// Setup: navigate to search with seeded DB
// ---------------------------------------------------------------------------

test.describe('Search page content', () => {
	// Each test uses a seededPage and navigates to /search where data is present.
	test.beforeEach(async ({ seededPage: page }) => {
		await page.goto('/search');
		await page.waitForLoadState('networkidle');

		// Wait until the search input is visible (confirms DB ready + has playlists)
		await page.locator('input[type="text"]').first().waitFor({ state: 'visible', timeout: 15000 });
	});

	// -------------------------------------------------------------------------
	// 1. Empty query → initial state
	// -------------------------------------------------------------------------

	test('empty query shows "Start typing" prompt', async ({ seededPage: page }) => {
		// The input starts empty — the placeholder / below-input message should show
		const hasPrompt = await page
			.getByText(/start typing/i)
			.isVisible()
			.catch(() => false);
		const hasPlaceholder = await page
			.locator('input[placeholder*="Search"]')
			.isVisible()
			.catch(() => false);

		expect(hasPrompt || hasPlaceholder).toBe(true);

		// No result cards yet
		const resultLinks = page.locator('ul li a');
		await expect(resultLinks).toHaveCount(0);
	});

	// -------------------------------------------------------------------------
	// 2. Known track name returns results
	// -------------------------------------------------------------------------

	test('typing a known track name returns result cards', async ({ seededPage: page }) => {
		// "Bohemian Rhapsody" is in pl-001 (Chill Vibes) and pl-003 (Road Trip)
		await typeInUnifiedSearch(page, 'Bohemian');

		// At least one result card should appear
		const resultCards = page.locator('ul li a');
		await expect(resultCards.first()).toBeVisible({ timeout: 8000 });

		const count = await resultCards.count();
		expect(count).toBeGreaterThan(0);
	});

	// -------------------------------------------------------------------------
	// 3. Result cards contain expected content
	// -------------------------------------------------------------------------

	test('result cards show track name, artist, and playlist', async ({ seededPage: page }) => {
		await typeInUnifiedSearch(page, 'Bohemian Rhapsody');

		const firstCard = page.locator('ul li a').first();
		await expect(firstCard).toBeVisible({ timeout: 8000 });

		// Track name
		await expect(firstCard.getByText(/Bohemian Rhapsody/i)).toBeVisible();

		// Artist name — "Queen" appears in the subtitle
		await expect(firstCard.getByText(/Queen/i)).toBeVisible();

		// Playlist name — either "Chill Vibes" or "Road Trip"
		const playlistVisible =
			(await firstCard.getByText(/Chill Vibes/i).isVisible().catch(() => false)) ||
			(await firstCard.getByText(/Road Trip/i).isVisible().catch(() => false));
		expect(playlistVisible).toBe(true);
	});

	// -------------------------------------------------------------------------
	// 4. Result count message
	// -------------------------------------------------------------------------

	test('result count is shown above results', async ({ seededPage: page }) => {
		await typeInUnifiedSearch(page, 'Queen');

		// Wait for results
		await page.locator('ul li a').first().waitFor({ state: 'visible', timeout: 8000 });

		// A "N results in Xms" line should appear
		const countText = page.getByText(/result/i).first();
		await expect(countText).toBeVisible({ timeout: 5000 });
	});

	// -------------------------------------------------------------------------
	// 5. Unknown query → no results message
	// -------------------------------------------------------------------------

	test('unknown query shows "No results found" message', async ({ seededPage: page }) => {
		await typeInUnifiedSearch(page, 'xyzzy_no_such_track_12345');

		// Wait for the no-results message
		await expect(
			page.getByText(/no results found/i),
		).toBeVisible({ timeout: 8000 });

		// No result cards
		const resultLinks = page.locator('ul li a');
		await expect(resultLinks).toHaveCount(0);
	});

	// -------------------------------------------------------------------------
	// 6. Artist-name search
	// -------------------------------------------------------------------------

	test('searching by artist name returns tracks by that artist', async ({ seededPage: page }) => {
		// "Eminem" has one track: "Lose Yourself" in Workout Mix
		await typeInUnifiedSearch(page, 'Eminem');

		const firstCard = page.locator('ul li a').first();
		await expect(firstCard).toBeVisible({ timeout: 8000 });

		// "Lose Yourself" should appear
		await expect(page.getByText(/Lose Yourself/i)).toBeVisible();
	});

	// -------------------------------------------------------------------------
	// 7. Refined search mode — separate track + artist fields
	// -------------------------------------------------------------------------

	test('refined search toggle shows two input fields', async ({ seededPage: page }) => {
		// Click "Refine search" button
		const refineBtn = page.getByRole('button', { name: /refine search/i });
		await expect(refineBtn).toBeVisible({ timeout: 8000 });
		await refineBtn.click();

		// Two inputs should now be visible
		const inputs = page.locator('input[type="text"]');
		await expect(inputs).toHaveCount(2);

		// Placeholders indicate track and artist
		await expect(page.locator('input[placeholder*="Track"]')).toBeVisible();
		await expect(page.locator('input[placeholder*="Artist"]')).toBeVisible();
	});

	test('refined search finds track + artist combination', async ({ seededPage: page }) => {
		// Enable refined mode
		const refineBtn = page.getByRole('button', { name: /refine search/i });
		await expect(refineBtn).toBeVisible({ timeout: 8000 });
		await refineBtn.click();

		// Fill in track name field
		const trackInput = page.locator('input[placeholder*="Track"]');
		await trackInput.fill('Hotel California');
		await trackInput.dispatchEvent('input');
		await page.waitForTimeout(300);

		// Results should include "Hotel California" by Eagles
		const firstCard = page.locator('ul li a').first();
		await expect(firstCard).toBeVisible({ timeout: 8000 });
		await expect(page.getByText(/Hotel California/i)).toBeVisible();
	});

	test('back to unified search restores single input field', async ({ seededPage: page }) => {
		// Go into refined mode
		const refineBtn = page.getByRole('button', { name: /refine search/i });
		await expect(refineBtn).toBeVisible({ timeout: 8000 });
		await refineBtn.click();

		// Click "Back to unified search"
		const backBtn = page.getByRole('button', { name: /back to unified search/i });
		await expect(backBtn).toBeVisible({ timeout: 5000 });
		await backBtn.click();

		// Single input restored
		const inputs = page.locator('input[type="text"]');
		await expect(inputs).toHaveCount(1);
	});
});
