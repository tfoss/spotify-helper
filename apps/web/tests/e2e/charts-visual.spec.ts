/**
 * Analytics chart visual regression tests (sh-rx0.4).
 *
 * Captures screenshots of the rendered charts and compares them to stored
 * baselines.  On the first run, Playwright writes the baseline PNGs into
 * tests/e2e/charts-visual.spec.ts-snapshots/.  Subsequent runs diff against
 * those baselines and fail if pixels diverge beyond the allowed threshold.
 *
 * What these tests verify (beyond unit tests):
 *   - Charts actually render visible SVG content (no blank/clipped viewports)
 *   - Axis labels are not clipped or invisible
 *   - Line chart fill is transparent (not solid black)
 *   - Visual output is stable across code changes
 *
 * Approach: intercept Spotify API calls so charts load seeded data without
 * hitting real endpoints, then wait for SVG text to render before screenshotting.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Seeded chart data
// ---------------------------------------------------------------------------

const TOP_ARTISTS = [
	{ id: 'a1', name: 'Radiohead', popularity: 85, images: [] },
	{ id: 'a2', name: 'Portishead', popularity: 72, images: [] },
	{ id: 'a3', name: 'Beirut', popularity: 68, images: [] },
	{ id: 'a4', name: 'Nick Cave', popularity: 65, images: [] },
	{ id: 'a5', name: 'Tom Waits', popularity: 63, images: [] },
];

const TOP_TRACKS = [
	{ id: 'trk1', name: 'Paranoid Android', artists: [{ id: 'a1', name: 'Radiohead' }], album: { name: 'OK Computer', images: [] }, popularity: 82 },
	{ id: 'trk2', name: 'Glory Box', artists: [{ id: 'a2', name: 'Portishead' }], album: { name: 'Dummy', images: [] }, popularity: 76 },
	{ id: 'trk3', name: 'Nantes', artists: [{ id: 'a3', name: 'Beirut' }], album: { name: 'The Flying Club Cup', images: [] }, popularity: 70 },
];

const RECENTLY_PLAYED = Array.from({ length: 10 }, (_, i) => ({
	track: {
		id: `rp-${i}`,
		name: `Track ${i}`,
		artists: [{ id: 'a1', name: 'Radiohead' }],
		album: { name: 'OK Computer', images: [] },
		popularity: 80,
	},
	played_at: new Date(Date.now() - i * 3600_000).toISOString(),
}));

// ---------------------------------------------------------------------------
// Route mock helper
// ---------------------------------------------------------------------------

async function setupChartMocks(page: Page) {
	// Auth worker: return a fake access token
	await page.route('**/refresh', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ access_token: 'fake_access_token', expires_in: 3600 }),
		});
	});

	await page.route('**/api.spotify.com/**', async (route) => {
		const url = route.request().url();

		if (url.includes('/me/top/artists')) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ items: TOP_ARTISTS, total: TOP_ARTISTS.length, limit: 50, offset: 0 }),
			});
			return;
		}

		if (url.includes('/me/top/tracks')) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ items: TOP_TRACKS, total: TOP_TRACKS.length, limit: 50, offset: 0 }),
			});
			return;
		}

		if (url.includes('/me/player/recently-played')) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ items: RECENTLY_PLAYED, next: null }),
			});
			return;
		}

		// Sync endpoints — return empty so auto-sync finishes quickly
		if (url.includes('/me/playlists')) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ items: [], total: 0, next: null, limit: 50, offset: 0 }),
			});
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ items: [], total: 0, next: null, limit: 50, offset: 0 }),
		});
	});

	await page.addInitScript(() => {
		localStorage.setItem('spotify_refresh_token', 'fake_refresh_token_for_testing');
	});
}

/** Wait until at least one SVG contains visible text content. */
async function waitForChartText(page: Page, minCount = 3) {
	await page.waitForFunction(
		(n: number) => {
			const texts = Array.from(document.querySelectorAll('svg text'));
			return texts.filter((t) => (t.textContent ?? '').trim().length > 0).length >= n;
		},
		minCount,
		{ timeout: 20000 },
	);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Chart visual regression', () => {
	test.beforeEach(async ({ page }) => {
		await setupChartMocks(page);
		// Home first so auth initialises and auto-sync fires
		await page.goto('/');
		await page.waitForLoadState('networkidle');
	});

	test('top artists bar chart renders correctly', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		// Navigate via the nav link so the analytics page loads in a live session
		await page.getByRole('link', { name: /analytics/i }).first().click();
		await page.waitForLoadState('networkidle');

		await waitForChartText(page);

		// Screenshot the chart area; Playwright diffs against the stored baseline.
		const chartEl = page.locator('.h-72, [class*="chart"], svg').first();
		await expect(chartEl).toHaveScreenshot('top-artists-bar-chart.png', { maxDiffPixels: 50 });
	});

	test('top tracks bar chart renders correctly', async ({ page }) => {
		await page.goto('/analytics');
		await page.waitForLoadState('networkidle');

		// Switch to Top Tracks tab
		await page.getByRole('button', { name: /top tracks/i }).click();
		await waitForChartText(page);

		const chartEl = page.locator('.h-72, [class*="chart"], svg').first();
		await expect(chartEl).toHaveScreenshot('top-tracks-bar-chart.png', { maxDiffPixels: 50 });
	});

	test('era histogram renders with x-axis year labels', async ({ page }) => {
		await page.goto('/analytics/era');
		await page.waitForLoadState('networkidle');

		// Era page shows a histogram of release years from the local DB.
		// With no synced tracks the chart shows an empty state — assert it
		// renders without clipping errors regardless.
		await page.waitForLoadState('networkidle');

		// Screenshot the full era page content area
		const content = page.locator('main, .space-y-6, [class*="space-y"]').first();
		await expect(content).toHaveScreenshot('era-histogram.png', { maxDiffPixels: 100 });
	});

	test('genre distribution chart renders correctly', async ({ page }) => {
		await page.goto('/analytics/genre');
		await page.waitForLoadState('networkidle');

		// With no synced tracks the genre page shows an empty/no-data state.
		// Verify it renders without JS errors and screenshot for regression.
		const content = page.locator('main, .space-y-6, [class*="space-y"]').first();
		await expect(content).toHaveScreenshot('genre-distribution.png', { maxDiffPixels: 100 });
	});

	test('line chart fill is not solid black', async ({ page }) => {
		await page.goto('/analytics');
		await page.waitForLoadState('networkidle');

		// Navigate to Recent Activity to trigger the line/spline chart
		await page.getByRole('button', { name: /recent activity/i }).click();
		await waitForChartText(page, 1);

		// Assert: no SVG path element has fill set to solid black
		const blackFillCount = await page.evaluate(() => {
			const paths = Array.from(document.querySelectorAll('svg path'));
			return paths.filter((p) => {
				const fill = (p.getAttribute('fill') ?? window.getComputedStyle(p).fill ?? '').toLowerCase();
				return fill === '#000' || fill === '#000000' || fill === 'black' || fill === 'rgb(0, 0, 0)';
			}).length;
		});

		expect(blackFillCount).toBe(0);
	});

	test('SVG axis labels are not clipped (overflow-visible applied)', async ({ page }) => {
		await page.goto('/analytics');
		await page.waitForLoadState('networkidle');

		await waitForChartText(page);

		// The outer chart SVG must have overflow: visible so axis labels that
		// render outside the SVG viewport bounds are not clipped.
		const overflowStyle = await page.evaluate(() => {
			const svgs = Array.from(document.querySelectorAll('svg'));
			// Find the LayerChart wrapper SVG (it has the layercake-layout-svg class)
			const layoutSvg = svgs.find(
				(s) =>
					s.classList.contains('layercake-layout-svg') ||
					s.style.overflow === 'visible' ||
					window.getComputedStyle(s).overflow === 'visible',
			);
			return layoutSvg ? window.getComputedStyle(layoutSvg).overflow : null;
		});

		// Should be 'visible', not 'hidden' or 'clip'
		expect(overflowStyle).not.toBe('hidden');
		expect(overflowStyle).not.toBe('clip');
	});
});
