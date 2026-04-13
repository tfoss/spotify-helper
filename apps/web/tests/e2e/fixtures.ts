/**
 * Base Playwright fixtures for spotify-helper E2E tests.
 *
 * Exports a custom `test` object with pre-baked fixtures:
 *   - `authenticatedPage`  — page with fake Spotify auth tokens set and
 *                            the auth-worker refresh endpoint intercepted.
 *   - `seededPage`         — authenticated page that has also tried to seed
 *                            the in-memory wa-sqlite DB via window.__dbStore.
 *
 * Import `test` and `expect` from this file instead of `@playwright/test`
 * in any test that needs auth or a seeded database.
 *
 * @example
 *   import { test, expect } from './fixtures';
 *
 *   test('my test', async ({ authenticatedPage }) => {
 *     await authenticatedPage.goto('/analytics');
 *     ...
 *   });
 */

import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import rawSeedData from './fixtures/seed-data.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

export type SeedData = typeof rawSeedData;

/** The canonical fixture dataset. Import this for assertions against known data. */
export const seedData: SeedData = rawSeedData;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Set fake Spotify auth tokens in localStorage so the app treats the session
 * as authenticated without a real OAuth round-trip.
 *
 * Call via `page.addInitScript(() => ...)` or inside a route intercept so the
 * tokens are present before the first frame evaluates.
 */
export async function setFakeAuth(page: Page): Promise<void> {
	await page.addInitScript(() => {
		localStorage.setItem('spotify_refresh_token', 'fake_refresh_token_for_testing');
		localStorage.setItem('spotify_last_synced_at', String(Date.now()));
	});
}

/**
 * Intercept the auth worker's `/refresh` endpoint to return a fake access
 * token, and stub all Spotify API calls with empty successful responses.
 *
 * @param page       - Playwright page.
 * @param accessToken - The fake access token to return (default stable value).
 */
export async function interceptAuthRefresh(
	page: Page,
	accessToken = 'fake_access_token_for_testing',
): Promise<void> {
	await page.route('**/refresh', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ access_token: accessToken, expires_in: 3600 }),
		});
	});

	await page.route('**/api.spotify.com/**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ items: [], total: 0, limit: 50, offset: 0, next: null }),
		});
	});
}

/**
 * Intercept Spotify's `/me/top/artists` endpoint with controlled data while
 * falling back to empty responses for other Spotify API calls.
 *
 * @param page    - Playwright page.
 * @param artists - Array of artist objects (id, name, popularity).
 */
export async function interceptSpotifyTopArtists(
	page: Page,
	artists: Array<{ id: string; name: string; popularity: number }>,
): Promise<void> {
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
			body: JSON.stringify({ items: [], total: 0, limit: 50, offset: 0, next: null }),
		});
	});
}

// ---------------------------------------------------------------------------
// DB seeding helper
// ---------------------------------------------------------------------------

/**
 * Seed the wa-sqlite database exposed by the app via `window.__dbStore`.
 *
 * Returns `true` if seeding succeeded, `false` if the store was not accessible
 * (e.g. DB not yet initialised). Callers should call this after the page has
 * had time to initialise the DB.
 *
 * @param page - Playwright page (must already be on an app route).
 * @param data - Seed data to insert. Defaults to the canonical `seedData`.
 */
export async function seedDatabase(
	page: Page,
	data: SeedData = seedData,
): Promise<boolean> {
	// Give the DB a moment to initialise after navigation
	await page.waitForTimeout(2000);

	return page.evaluate(async (d) => {
		try {
			const store = (window as any).__dbStore;
			if (!store || !store.executor) return false;

			const exec = store.executor;

			for (const p of d.playlists) {
				await exec(
					'INSERT OR REPLACE INTO playlists (id, name, owner, snapshot_id, image_url, synced_at) VALUES (?, ?, ?, ?, ?, ?)',
					[p.id, p.name, p.owner, p.snapshot_id, p.image_url, p.synced_at],
				);
			}

			for (const t of d.tracks) {
				await exec(
					'INSERT OR REPLACE INTO tracks (id, name, name_lower, artist_name, artist_lower, artist_id, album_name, duration_ms, popularity, release_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
					[t.id, t.name, t.name.toLowerCase(), t.artist_name, t.artist_name.toLowerCase(), null, t.album_name, t.duration_ms, t.popularity, t.release_date],
				);
			}

			for (const pt of d.playlist_tracks) {
				await exec(
					'INSERT OR REPLACE INTO playlist_tracks (playlist_id, track_id, added_at, position) VALUES (?, ?, ?, ?)',
					[pt.playlist_id, pt.track_id, pt.added_at, pt.position],
				);
			}

			return true;
		} catch (e) {
			console.error('[Fixture] seedDatabase failed:', e);
			return false;
		}
	}, data);
}

// ---------------------------------------------------------------------------
// Custom fixture types
// ---------------------------------------------------------------------------

type SpotifyTestFixtures = {
	/** An unauthenticated page (standard Playwright page). */
	page: Page;
	/** A page with fake auth tokens + auth-worker stub applied. */
	authenticatedPage: Page;
	/** An authenticated page that has been navigated to `/` and had the DB seeded. */
	seededPage: Page;
};

// ---------------------------------------------------------------------------
// Extended test object
// ---------------------------------------------------------------------------

/**
 * Playwright `test` extended with spotify-helper fixtures.
 *
 * Use this instead of the base `@playwright/test` import for any test that
 * needs auth or seed data.
 */
export const test = base.extend<SpotifyTestFixtures>({
	authenticatedPage: async ({ page }, use) => {
		await interceptAuthRefresh(page);
		await setFakeAuth(page);
		await use(page);
	},

	seededPage: async ({ page }, use) => {
		await interceptAuthRefresh(page);
		await setFakeAuth(page);

		// Navigate first so the DB can initialise, then seed
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await seedDatabase(page);

		await use(page);
	},
});

export { expect };
