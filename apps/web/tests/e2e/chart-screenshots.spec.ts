/**
 * Analytics chart screenshot capture (sh-21v).
 *
 * Saves PNG screenshots of every chart in the Analytics view to
 * screenshots/plots/ for human review. Screenshots are regenerated on every
 * run (existing files are overwritten — no regression diffing here).
 *
 * Seeded Spotify API mocks ensure charts render with known data even without
 * a real Spotify account.
 */

import path from 'path';
import { test, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Seeded chart data (mirrors charts-visual.spec.ts for consistency)
// ---------------------------------------------------------------------------

const TOP_ARTISTS = [
	{ id: 'a1', name: 'Radiohead', popularity: 85, images: [] },
	{ id: 'a2', name: 'Portishead', popularity: 72, images: [] },
	{ id: 'a3', name: 'Beirut', popularity: 68, images: [] },
	{ id: 'a4', name: 'Nick Cave', popularity: 65, images: [] },
	{ id: 'a5', name: 'Tom Waits', popularity: 63, images: [] },
];

const TOP_TRACKS = [
	{
		id: 'trk1',
		name: 'Paranoid Android',
		artists: [{ id: 'a1', name: 'Radiohead' }],
		album: { name: 'OK Computer', images: [] },
		popularity: 82,
	},
	{
		id: 'trk2',
		name: 'Glory Box',
		artists: [{ id: 'a2', name: 'Portishead' }],
		album: { name: 'Dummy', images: [] },
		popularity: 76,
	},
	{
		id: 'trk3',
		name: 'Nantes',
		artists: [{ id: 'a3', name: 'Beirut' }],
		album: { name: 'The Flying Club Cup', images: [] },
		popularity: 70,
	},
];

const RECENTLY_PLAYED = Array.from({ length: 10 }, (_, i) => ({
	track: {
		id: `rp-${i}`,
		name: `Track ${i}`,
		artists: [{ id: 'a1', name: 'Radiohead' }],
		album: { name: 'OK Computer', images: [] },
		popularity: 80,
	},
	played_at: new Date(Date.now() - i * 3_600_000).toISOString(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a screenshot output path relative to the project root (apps/web/). */
function plotPath(filename: string): string {
	return path.join('screenshots', 'plots', filename);
}

/** Wire up Spotify API mocks and inject a fake refresh token. */
async function setupMocks(page: Page): Promise<void> {
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
				body: JSON.stringify({
					items: TOP_ARTISTS,
					total: TOP_ARTISTS.length,
					limit: 50,
					offset: 0,
				}),
			});
			return;
		}

		if (url.includes('/me/top/tracks')) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					items: TOP_TRACKS,
					total: TOP_TRACKS.length,
					limit: 50,
					offset: 0,
				}),
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

		// Catch-all: return an empty list so any other sync endpoints finish quickly.
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

/** Wait until at least `minCount` SVG text nodes have visible content. */
async function waitForChartText(page: Page, minCount = 3): Promise<void> {
	await page.waitForFunction(
		(n: number) => {
			const texts = Array.from(document.querySelectorAll('svg text'));
			return texts.filter((t) => (t.textContent ?? '').trim().length > 0).length >= n;
		},
		minCount,
		{ timeout: 20_000 },
	);
}

// ---------------------------------------------------------------------------
// Screenshot tests
// ---------------------------------------------------------------------------

test.describe('Chart plot screenshots (sh-21v)', () => {
	test.beforeEach(async ({ page }) => {
		await setupMocks(page);
		// Visit home first so auth initialises and auto-sync fires before navigating.
		await page.goto('/');
		await page.waitForLoadState('networkidle');
	});

	test('analytics — top artists bar chart', async ({ page }) => {
		await page.goto('/analytics');
		await page.waitForLoadState('networkidle');
		await waitForChartText(page);

		await page.screenshot({ path: plotPath('analytics-top-artists.png'), fullPage: false });
	});

	test('analytics — top tracks bar chart', async ({ page }) => {
		await page.goto('/analytics');
		await page.waitForLoadState('networkidle');

		const topTracksBtn = page.getByRole('button', { name: /top tracks/i });
		if (await topTracksBtn.isVisible()) {
			await topTracksBtn.click();
		}
		await waitForChartText(page);

		await page.screenshot({ path: plotPath('analytics-top-tracks.png'), fullPage: false });
	});

	test('analytics — recent activity line chart', async ({ page }) => {
		await page.goto('/analytics');
		await page.waitForLoadState('networkidle');

		const recentBtn = page.getByRole('button', { name: /recent activity/i });
		if (await recentBtn.isVisible()) {
			await recentBtn.click();
		}
		await waitForChartText(page, 1);

		await page.screenshot({ path: plotPath('analytics-recent-activity.png'), fullPage: false });
	});

	test('analytics/era — era histogram', async ({ page }) => {
		await page.goto('/analytics/era');
		await page.waitForLoadState('networkidle');

		await page.screenshot({ path: plotPath('analytics-era-histogram.png'), fullPage: true });
	});

	test('analytics/genre — genre distribution chart', async ({ page }) => {
		await page.goto('/analytics/genre');
		await page.waitForLoadState('networkidle');

		await page.screenshot({ path: plotPath('analytics-genre-distribution.png'), fullPage: true });
	});

	test('analytics/overlap — playlist overlap view', async ({ page }) => {
		await page.goto('/analytics/overlap');
		await page.waitForLoadState('networkidle');

		await page.screenshot({ path: plotPath('analytics-playlist-overlap.png'), fullPage: true });
	});
});
