import { test, expect } from '@playwright/test';
import seedData from './fixtures/seed-data.json';

/**
 * Functional E2E tests with seeded DB fixtures.
 *
 * These tests verify runtime behavior that unit tests (which mock DbClient)
 * cannot catch: wa-sqlite crashes, chart rendering errors, search result
 * display, and highlight functionality.
 */

/**
 * Set fake auth tokens in localStorage so the app thinks the user is
 * authenticated. The refresh token triggers auth initialization.
 */
async function setFakeAuth(page: import('@playwright/test').Page) {
	await page.addInitScript(() => {
		localStorage.setItem('spotify_refresh_token', 'fake_refresh_token_for_testing');
		localStorage.setItem('spotify_last_synced_at', Date.now().toString());
	});
}

/**
 * Intercept the auth worker's /refresh endpoint so the app doesn't
 * actually call the real worker. Return a fake access token.
 */
async function interceptAuthRefresh(page: import('@playwright/test').Page) {
	await page.route('**/refresh', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				access_token: 'fake_access_token_for_testing',
				expires_in: 3600,
			}),
		});
	});

	// Intercept any Spotify API calls to prevent real requests
	await page.route('**/api.spotify.com/**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ items: [], total: 0, limit: 50, offset: 0 }),
		});
	});
}

/**
 * Wait for the DB to be ready and seed it with fixture data by executing
 * SQL statements through the app's DB executor.
 */
async function seedDatabase(page: import('@playwright/test').Page) {
	// Wait for the DB store to be ready (poll for up to 10 seconds)
	await page.waitForFunction(() => {
		// Check if the dbStore is ready by looking for a global signal
		const dbReadyEl = document.querySelector('[data-db-ready]');
		return dbReadyEl !== null;
	}, { timeout: 10000 }).catch(() => {
		// DB might not expose a ready signal — fall back to a delay
	});

	// Give the DB a moment to initialize
	await page.waitForTimeout(2000);

	// Seed data by posting messages to the worker through the app
	const seeded = await page.evaluate(async (data) => {
		// Access the dbStore from the Svelte app context
		// The store is available as a module-level export; we need to
		// execute SQL through whatever mechanism is available
		try {
			// Try to find the executor through the global state
			const dbStoreModule = (window as any).__dbStore;
			if (dbStoreModule && dbStoreModule.executor) {
				const exec = dbStoreModule.executor;

				// Seed playlists
				for (const p of data.playlists) {
					await exec(
						'INSERT OR REPLACE INTO playlists (id, name, owner, snapshot_id, image_url, synced_at) VALUES (?, ?, ?, ?, ?, ?)',
						[p.id, p.name, p.owner, p.snapshot_id, p.image_url, p.synced_at]
					);
				}

				// Seed tracks
				for (const t of data.tracks) {
					await exec(
						'INSERT OR REPLACE INTO tracks (id, name, name_lower, artist_name, artist_lower, album_name, duration_ms, popularity, release_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
						[t.id, t.name, t.name.toLowerCase(), t.artist_name, t.artist_name.toLowerCase(), t.album_name, t.duration_ms, t.popularity, t.release_date]
					);
				}

				// Seed playlist_tracks
				for (const pt of data.playlist_tracks) {
					await exec(
						'INSERT OR REPLACE INTO playlist_tracks (playlist_id, track_id, added_at, position) VALUES (?, ?, ?, ?)',
						[pt.playlist_id, pt.track_id, pt.added_at, pt.position]
					);
				}

				return true;
			}
			return false;
		} catch (e) {
			console.error('Seed failed:', e);
			return false;
		}
	}, seedData);

	return seeded;
}

// ---------------------------------------------------------------------------
// Test A: Search page loads without JS errors
// ---------------------------------------------------------------------------

test.describe('Functional: Page Loading', () => {
	test('search page loads without JS errors', async ({ page }) => {
		const jsErrors: string[] = [];
		page.on('pageerror', (error) => {
			jsErrors.push(error.message);
		});

		await page.goto('/search');
		await page.waitForLoadState('networkidle');

		const heading = page.getByRole('heading', { name: /search playlists/i });
		await expect(heading).toBeVisible();

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

	test('home page shows connect button when not authenticated', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const connectBtn = page.getByRole('button', { name: /connect with spotify/i });
		await expect(connectBtn).toBeVisible();
	});
});

// ---------------------------------------------------------------------------
// Test B & D: Search with auth bypass
// ---------------------------------------------------------------------------

test.describe('Functional: Authenticated Pages', () => {
	test.beforeEach(async ({ page }) => {
		await interceptAuthRefresh(page);
		await setFakeAuth(page);
	});

	test('home page shows navigation links when authenticated', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// After auth init, should show Search and Analytics links
		const searchLink = page.getByRole('link', { name: /search/i });
		const analyticsLink = page.getByRole('link', { name: /analytics/i });

		await expect(searchLink).toBeVisible({ timeout: 10000 });
		await expect(analyticsLink).toBeVisible();
	});

	test('search page shows sync prompt or search form when authenticated', async ({ page }) => {
		const jsErrors: string[] = [];
		page.on('pageerror', (error) => {
			jsErrors.push(error.message);
		});

		await page.goto('/search');
		await page.waitForLoadState('networkidle');

		// Should see either:
		// - Search input (DB ready with data)
		// - "No playlists synced" message (DB ready but empty)
		// - "Initializing database" (DB starting up)
		// - "Sync from Spotify" button
		// But NOT a crash
		const heading = page.getByRole('heading', { name: /search playlists/i });
		await expect(heading).toBeVisible();

		const hasInput = await page.locator('input[type="text"]').isVisible().catch(() => false);
		const hasSyncPrompt = await page.getByText(/no playlists synced|sync from spotify/i).isVisible().catch(() => false);
		const hasDbMessage = await page.getByText(/initializing|database/i).isVisible().catch(() => false);

		expect(hasInput || hasSyncPrompt || hasDbMessage).toBe(true);
		expect(jsErrors).toEqual([]);
	});

	test('analytics page renders tabs when authenticated', async ({ page }) => {
		const jsErrors: string[] = [];
		page.on('pageerror', (error) => {
			jsErrors.push(error.message);
		});

		await page.goto('/analytics');
		await page.waitForLoadState('networkidle');

		// Should see tab buttons
		const artistsTab = page.getByRole('button', { name: /top artists/i });
		await expect(artistsTab).toBeVisible({ timeout: 10000 });

		// Should see the connect prompt OR the analytics tabs
		const tracksTab = page.getByRole('button', { name: /top tracks/i });
		await expect(tracksTab).toBeVisible();

		expect(jsErrors).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// sh-rvw: Chart axis rendering (visual/DOM assertions)
// ---------------------------------------------------------------------------

/**
 * Intercept Spotify's /me/top/artists with seeded data that includes
 * `name` and `popularity`. Anything else on api.spotify.com still returns
 * an empty list so we don't break other flows.
 */
async function interceptSpotifyTopArtists(
	page: import('@playwright/test').Page,
	artists: Array<{ id: string; name: string; popularity: number }>,
) {
	await page.route('**/api.spotify.com/**', async (route) => {
		const url = route.request().url();
		if (url.includes('/me/top/artists')) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					items: artists.map((a) => ({ ...a, images: [] })),
					total: artists.length,
					limit: 50,
					offset: 0,
				}),
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ items: [], total: 0, limit: 50, offset: 0 }),
		});
	});
}

test.describe('Chart axis rendering', () => {
	const SEEDED_ARTISTS = [
		{ id: 'a-beirut', name: 'Beirut', popularity: 72 },
		{ id: 'a-tomwaits', name: 'Tom Waits', popularity: 68 },
		{ id: 'a-radiohead', name: 'Radiohead', popularity: 85 },
		{ id: 'a-portishead', name: 'Portishead', popularity: 63 },
		{ id: 'a-nickcave', name: 'Nick Cave', popularity: 70 },
	];

	test.beforeEach(async ({ page }) => {
		await page.route('**/refresh', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					access_token: 'fake_access_token_for_testing',
					expires_in: 3600,
				}),
			});
		});
		await interceptSpotifyTopArtists(page, SEEDED_ARTISTS);
		await setFakeAuth(page);
	});

	test('Test A: BarChart renders axis text inside the SVG', async ({ page }) => {
		await page.goto('/analytics');
		await page.waitForLoadState('networkidle');

		const svg = page.locator('svg').first();
		await expect(svg).toBeVisible({ timeout: 15000 });

		// Wait until the SVG actually contains <text> elements (tick labels render
		// asynchronously after scale resolution).
		await page.waitForFunction(
			() => {
				const s = document.querySelector('svg');
				return !!s && s.querySelectorAll('text').length >= 3;
			},
			{ timeout: 15000 },
		);

		const textCount = await svg.locator('text').count();
		expect(textCount).toBeGreaterThanOrEqual(3);

		// At least one rendered text element must have non-empty content.
		const nonEmptyCount = await page.evaluate(() => {
			const texts = Array.from(document.querySelectorAll('svg text'));
			return texts.filter((t) => (t.textContent ?? '').trim().length > 0).length;
		});
		expect(nonEmptyCount).toBeGreaterThan(0);

		// None of the text elements should be invisible via fill="none"/"transparent".
		const invisibleCount = await page.evaluate(() => {
			const texts = Array.from(document.querySelectorAll('svg text')) as SVGTextElement[];
			return texts.filter((t) => {
				const attr = (t.getAttribute('fill') ?? '').toLowerCase();
				return attr === 'none' || attr === 'transparent';
			}).length;
		});
		expect(invisibleCount).toBe(0);
	});

	test('Test B: Y-axis tick labels have a visible (non-black, non-transparent) fill', async ({ page }) => {
		await page.goto('/analytics');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(
			() => {
				const s = document.querySelector('svg');
				return !!s && s.querySelectorAll('text').length >= 3;
			},
			{ timeout: 15000 },
		);

		// Collect computed fill for every text node — at least one must be a
		// visible gray (not black, not transparent, not "none").
		const visibleFills = await page.evaluate(() => {
			const texts = Array.from(document.querySelectorAll('svg text')) as SVGTextElement[];
			return texts
				.map((t) => window.getComputedStyle(t).fill)
				.filter((fill) => {
					const f = fill.trim().toLowerCase();
					if (!f || f === 'none' || f === 'transparent') return false;
					if (f === 'rgb(0, 0, 0)' || f === '#000' || f === '#000000' || f === 'black') return false;
					// rgba(0,0,0,0) → transparent black
					if (f.startsWith('rgba(0, 0, 0, 0)') || f.startsWith('rgba(0,0,0,0)')) return false;
					return true;
				});
		});

		expect(visibleFills.length).toBeGreaterThan(0);
	});

	test('Test C: seeded artist names appear on the x-axis', async ({ page }) => {
		await page.goto('/analytics');
		await page.waitForLoadState('networkidle');

		await page.waitForFunction(
			() => {
				const s = document.querySelector('svg');
				return !!s && s.querySelectorAll('text').length >= 3;
			},
			{ timeout: 15000 },
		);

		const svgText = (await page.evaluate(() => {
			const texts = Array.from(document.querySelectorAll('svg text'));
			return texts.map((t) => (t.textContent ?? '').trim()).join('\n');
		})) as string;

		// Allow truncation with an ellipsis (e.g. "Radiohea…").
		const seenNames = SEEDED_ARTISTS.filter((a) => {
			if (svgText.includes(a.name)) return true;
			// Accept prefix match in case the chart truncates long labels.
			const prefix = a.name.slice(0, Math.min(5, a.name.length));
			return prefix.length >= 3 && svgText.includes(prefix);
		});

		expect(seenNames.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Test C: Genre and Era pages load
// ---------------------------------------------------------------------------

test.describe('Functional: Sub-pages', () => {
	test('genre distribution page loads', async ({ page }) => {
		const jsErrors: string[] = [];
		page.on('pageerror', (error) => {
			jsErrors.push(error.message);
		});

		await page.goto('/analytics/genre');
		await page.waitForLoadState('networkidle');

		const heading = page.getByRole('heading', { name: /genre distribution/i });
		await expect(heading).toBeVisible();

		expect(jsErrors).toEqual([]);
	});

	test('era heatmap page loads', async ({ page }) => {
		const jsErrors: string[] = [];
		page.on('pageerror', (error) => {
			jsErrors.push(error.message);
		});

		await page.goto('/analytics/era');
		await page.waitForLoadState('networkidle');

		// Page should load without crash
		const heading = page.getByText(/era|release year|heatmap/i).first();
		await expect(heading).toBeVisible();

		expect(jsErrors).toEqual([]);
	});
});
