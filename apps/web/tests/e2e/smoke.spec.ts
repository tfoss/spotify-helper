import { test, expect } from '@playwright/test';

/**
 * Smoke test: verify the app loads without JavaScript errors.
 *
 * This catches wa-sqlite import failures, missing dependencies, and
 * other runtime errors that unit tests (which mock DbClient) can't detect.
 *
 * Does NOT require Spotify auth — just verifies the pages render.
 */

test.describe('App Smoke Test', () => {
	test('home page loads without JS errors', async ({ page }) => {
		const jsErrors: string[] = [];
		page.on('pageerror', (error) => {
			jsErrors.push(error.message);
		});

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const heading = page.getByText('Spotify Helper');
		await expect(heading).toBeVisible();

		expect(jsErrors).toEqual([]);
	});

	test('search page loads and shows search UI', async ({ page }) => {
		const jsErrors: string[] = [];
		page.on('pageerror', (error) => {
			jsErrors.push(error.message);
		});

		await page.goto('/search');
		await page.waitForLoadState('networkidle');

		const heading = page.getByRole('heading', { name: /search playlists/i });
		await expect(heading).toBeVisible();

		// The page should show either the search form (DB ready) or
		// a DB initializing/not-ready state — but NOT a crash
		const hasSearchInput = await page.locator('input[type="text"]').isVisible();
		const hasDbMessage = await page.getByText(/initializing|database|not ready/i).isVisible();
		expect(hasSearchInput || hasDbMessage).toBe(true);

		expect(jsErrors).toEqual([]);
	});

	test('analytics page loads without JS errors', async ({ page }) => {
		const jsErrors: string[] = [];
		page.on('pageerror', (error) => {
			jsErrors.push(error.message);
		});

		await page.goto('/analytics');
		await page.waitForLoadState('networkidle');

		const heading = page.getByRole('heading', { name: /analytics/i });
		await expect(heading).toBeVisible();

		expect(jsErrors).toEqual([]);
	});
});
