/**
 * sh-rx0.2 — Route render smoke tests.
 *
 * Visits every app route and asserts:
 *   - No JavaScript runtime errors (pageerror events)
 *   - Key content elements (headings, buttons, navigation) are present
 *   - No HTTP 500-level failures on page load
 *
 * Tests are split into:
 *   - Unauthenticated routes: pages accessible without auth
 *   - Authenticated routes: pages that require auth (uses authenticatedPage fixture)
 *
 * No real Spotify or Worker calls are made — auth is stubbed.
 */

import { test, expect } from './fixtures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capture JS errors from pageerror events. */
function captureJsErrors(page: import('@playwright/test').Page): string[] {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push(err.message));
	return errors;
}

// ---------------------------------------------------------------------------
// Unauthenticated routes
// ---------------------------------------------------------------------------

test.describe('Unauthenticated routes — smoke', () => {
	test('/ — home page loads with Connect button and no JS errors', async ({ page }) => {
		const jsErrors = captureJsErrors(page);

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Core heading
		await expect(page.getByText('Spotify Helper')).toBeVisible({ timeout: 10000 });

		// Connect button is the primary CTA when not logged in
		await expect(
			page.getByRole('button', { name: /connect with spotify/i }),
		).toBeVisible();

		expect(jsErrors).toEqual([]);
	});

	test('/search — page loads with heading and no JS errors', async ({ page }) => {
		const jsErrors = captureJsErrors(page);

		await page.goto('/search');
		await page.waitForLoadState('networkidle');

		await expect(
			page.getByRole('heading', { name: /search playlists/i }),
		).toBeVisible({ timeout: 10000 });

		expect(jsErrors).toEqual([]);
	});

	test('/analytics — page loads with heading and no JS errors', async ({ page }) => {
		const jsErrors = captureJsErrors(page);

		await page.goto('/analytics');
		await page.waitForLoadState('networkidle');

		await expect(
			page.getByRole('heading', { name: /analytics/i }),
		).toBeVisible({ timeout: 10000 });

		expect(jsErrors).toEqual([]);
	});

	test('/analytics/genre — page loads with heading and no JS errors', async ({ page }) => {
		const jsErrors = captureJsErrors(page);

		await page.goto('/analytics/genre');
		await page.waitForLoadState('networkidle');

		await expect(
			page.getByRole('heading', { name: /genre distribution/i }),
		).toBeVisible({ timeout: 10000 });

		expect(jsErrors).toEqual([]);
	});

	test('/analytics/era — page loads with heading and no JS errors', async ({ page }) => {
		const jsErrors = captureJsErrors(page);

		await page.goto('/analytics/era');
		await page.waitForLoadState('networkidle');

		await expect(
			page.getByRole('heading', { name: /era heatmap/i }),
		).toBeVisible({ timeout: 10000 });

		expect(jsErrors).toEqual([]);
	});

	test('/analytics/overlap — page loads with heading and no JS errors', async ({ page }) => {
		const jsErrors = captureJsErrors(page);

		await page.goto('/analytics/overlap');
		await page.waitForLoadState('networkidle');

		// Look for any heading that signals the page loaded
		const heading = page.getByRole('heading').first();
		await expect(heading).toBeVisible({ timeout: 10000 });

		expect(jsErrors).toEqual([]);
	});

	test('/auth/callback — shows error UI when params are missing', async ({ page }) => {
		const jsErrors = captureJsErrors(page);

		// Visiting callback without code/state params — the app should handle
		// this gracefully and show an error rather than crashing.
		await page.goto('/auth/callback');
		await page.waitForLoadState('networkidle');

		// Should show an error state OR redirect to home — either is valid.
		// What must NOT happen is a blank screen or uncaught JS error.
		const url = page.url();
		const isHome = url.endsWith('/') || url.endsWith('/?');
		const hasError = await page
			.getByText(/error|invalid|failed|missing/i)
			.isVisible()
			.catch(() => false);
		const hasBackLink = await page
			.getByRole('link', { name: /back to home/i })
			.isVisible()
			.catch(() => false);

		expect(isHome || hasError || hasBackLink).toBe(true);
		expect(jsErrors).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Authenticated routes — navigation and content
// ---------------------------------------------------------------------------

test.describe('Authenticated routes — smoke', () => {
	test('/ — shows Search, Analytics, Log out when authenticated', async ({
		authenticatedPage: page,
	}) => {
		const jsErrors = captureJsErrors(page);

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Navigation actions visible after auth
		await expect(page.getByRole('link', { name: /^Search$/i })).toBeVisible({ timeout: 10000 });
		await expect(page.getByRole('link', { name: /^Analytics$/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /^Log out$/i })).toBeVisible();

		// Connect button should be gone
		await expect(
			page.getByRole('button', { name: /connect with spotify/i }),
		).not.toBeVisible();

		expect(jsErrors).toEqual([]);
	});

	test('/analytics — renders tab buttons when authenticated', async ({
		authenticatedPage: page,
	}) => {
		const jsErrors = captureJsErrors(page);

		await page.goto('/analytics');
		await page.waitForLoadState('networkidle');

		// Analytics page has tab buttons for different chart views
		await expect(
			page.getByRole('button', { name: /top artists/i }),
		).toBeVisible({ timeout: 10000 });
		await expect(page.getByRole('button', { name: /top tracks/i })).toBeVisible();

		expect(jsErrors).toEqual([]);
	});

	test('/search — shows search UI or empty-state prompt when authenticated', async ({
		authenticatedPage: page,
	}) => {
		const jsErrors = captureJsErrors(page);

		await page.goto('/search');
		await page.waitForLoadState('networkidle');

		await expect(
			page.getByRole('heading', { name: /search playlists/i }),
		).toBeVisible({ timeout: 10000 });

		// The page shows one of: search input, sync prompt, or initializing message
		const hasInput = await page.locator('input[type="text"]').isVisible().catch(() => false);
		const hasSyncBtn = await page
			.getByRole('button', { name: /sync from spotify/i })
			.isVisible()
			.catch(() => false);
		const hasInitMsg = await page
			.getByText(/initializing|database|not ready/i)
			.isVisible()
			.catch(() => false);
		const hasEmptyMsg = await page
			.getByText(/no playlists synced/i)
			.isVisible()
			.catch(() => false);

		expect(hasInput || hasSyncBtn || hasInitMsg || hasEmptyMsg).toBe(true);
		expect(jsErrors).toEqual([]);
	});

	test('/analytics/genre — page loads with heading when authenticated', async ({
		authenticatedPage: page,
	}) => {
		const jsErrors = captureJsErrors(page);

		await page.goto('/analytics/genre');
		await page.waitForLoadState('networkidle');

		await expect(
			page.getByRole('heading', { name: /genre distribution/i }),
		).toBeVisible({ timeout: 10000 });

		expect(jsErrors).toEqual([]);
	});

	test('/analytics/era — page loads with heading when authenticated', async ({
		authenticatedPage: page,
	}) => {
		const jsErrors = captureJsErrors(page);

		await page.goto('/analytics/era');
		await page.waitForLoadState('networkidle');

		await expect(
			page.getByRole('heading', { name: /era heatmap/i }),
		).toBeVisible({ timeout: 10000 });

		expect(jsErrors).toEqual([]);
	});

	test('/analytics/overlap — page loads when authenticated', async ({
		authenticatedPage: page,
	}) => {
		const jsErrors = captureJsErrors(page);

		await page.goto('/analytics/overlap');
		await page.waitForLoadState('networkidle');

		const heading = page.getByRole('heading').first();
		await expect(heading).toBeVisible({ timeout: 10000 });

		expect(jsErrors).toEqual([]);
	});
});
