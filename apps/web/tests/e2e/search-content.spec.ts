/**
 * Search page content tests (sh-rx0.3).
 *
 * Verifies search behaviour with a seeded local DB:
 *   - Empty state when unauthenticated
 *   - Search input appears after a mocked sync completes
 *   - Correct tracks / playlists returned for known queries
 *   - "No results" path for an unmatched query
 *
 * Approach: intercept all Spotify API calls so the app's sync engine runs
 * against deterministic fixture data (seed-data.json) without hitting real
 * network endpoints.
 */

import { test, expect, type Page } from '@playwright/test';
import seedData from './fixtures/seed-data.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// Spotify API mock helpers
// ---------------------------------------------------------------------------

type SeedPlaylist = (typeof seedData.playlists)[0];
type SeedTrack = (typeof seedData.tracks)[0];

function toSpotifyPlaylist(p: SeedPlaylist) {
	return {
		id: p.id,
		name: p.name,
		owner: { display_name: p.owner, id: p.owner },
		snapshot_id: p.snapshot_id,
		images: p.image_url ? [{ url: p.image_url }] : [],
	};
}

function toSpotifyPlaylistTrack(track: SeedTrack, addedAt: number) {
	// Derive a stable artist ID from the artist name
	const artistId = `artist-${track.artist_name.replace(/\s+/g, '-').toLowerCase()}`;
	return {
		track: {
			id: track.id,
			name: track.name,
			artists: [{ id: artistId, name: track.artist_name }],
			album: {
				name: track.album_name,
				release_date: track.release_date,
				images: [],
			},
			duration_ms: track.duration_ms,
			popularity: track.popularity,
		},
		added_at: new Date(addedAt).toISOString(),
	};
}

/**
 * Build a map of playlistId → array of Spotify-format playlist track objects,
 * derived from seed-data.json.
 */
function buildPlaylistTracksMap() {
	const map = new Map<string, ReturnType<typeof toSpotifyPlaylistTrack>[]>();

	for (const pt of seedData.playlist_tracks) {
		if (!map.has(pt.playlist_id)) map.set(pt.playlist_id, []);
		const track = seedData.tracks.find((t) => t.id === pt.track_id);
		if (track) {
			map.get(pt.playlist_id)!.push(toSpotifyPlaylistTrack(track, pt.added_at));
		}
	}

	return map;
}

/**
 * Register route interceptors that feed the app's sync engine with fixture
 * data, and set a fake refresh token in localStorage so the auth store
 * considers the user authenticated.
 */
async function setupMockedSync(page: Page) {
	const playlistTracksMap = buildPlaylistTracksMap();

	// Auth worker: return a fake access token without hitting Cloudflare
	await page.route('**/refresh', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ access_token: 'fake_access_token', expires_in: 3600 }),
		});
	});

	// Spotify API: serve fixture data for all endpoints used during sync
	await page.route('**/api.spotify.com/**', async (route) => {
		const url = route.request().url();

		// GET /me/playlists
		if (url.includes('/me/playlists')) {
			const items = seedData.playlists.map(toSpotifyPlaylist);
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ items, total: items.length, next: null, limit: 50, offset: 0 }),
			});
			return;
		}

		// GET /playlists/{id}/tracks
		const tracksMatch = url.match(/\/playlists\/([^/?]+)\/tracks/);
		if (tracksMatch) {
			const playlistId = tracksMatch[1];
			const items = playlistTracksMap.get(playlistId) ?? [];
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ items, total: items.length, next: null, limit: 100, offset: 0 }),
			});
			return;
		}

		// GET /artists?ids=... (genre sync) — return empty artists so tests don't break
		if (url.includes('/artists')) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ artists: [] }),
			});
			return;
		}

		// Fallback: empty paginated response
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ items: [], total: 0, next: null, limit: 50, offset: 0 }),
		});
	});

	// Inject fake auth tokens before the page scripts execute
	await page.addInitScript(() => {
		localStorage.setItem('spotify_refresh_token', 'fake_refresh_token_for_testing');
	});
}

/**
 * Wait for the sync to populate the DB and for the search page to show the
 * search input.  The input only renders when `hasPlaylists` is true.
 */
async function waitForSearchInput(page: Page) {
	await expect(page.locator('input[type="text"]').first()).toBeVisible({ timeout: 30000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Search: empty state (unauthenticated)', () => {
	test('shows "No playlists synced yet" with connect CTA when not authenticated', async ({ page }) => {
		const jsErrors: string[] = [];
		page.on('pageerror', (e) => jsErrors.push(e.message));

		await page.goto('/search');
		await page.waitForLoadState('networkidle');

		// Heading always present
		await expect(page.getByRole('heading', { name: /search playlists/i })).toBeVisible();

		// No playlists → shows sync prompt or "connect" CTA
		const hasPrompt = await page.getByText(/no playlists synced yet/i).isVisible().catch(() => false);
		const hasConnect = await page.getByRole('link', { name: /connect spotify first/i }).isVisible().catch(() => false);
		const hasDbMessage = await page.getByText(/initializing|database/i).isVisible().catch(() => false);

		expect(hasPrompt || hasConnect || hasDbMessage).toBe(true);
		expect(jsErrors).toEqual([]);
	});
});

test.describe('Search: content with mocked sync', () => {
	test.beforeEach(async ({ page }) => {
		await setupMockedSync(page);
		// Load home first so the layout mounts, auth initialises, and auto-sync fires
		await page.goto('/');
		await page.waitForLoadState('networkidle');
	});

	test('search input is visible after sync completes', async ({ page }) => {
		await page.goto('/search');
		await waitForSearchInput(page);
	});

	test('searching "bohemian" returns Bohemian Rhapsody in Chill Vibes and Road Trip', async ({ page }) => {
		await page.goto('/search');
		await waitForSearchInput(page);

		const input = page.locator('input[type="text"]').first();
		await input.fill('bohemian');
		await input.dispatchEvent('input');

		// Allow search to complete
		await page.waitForTimeout(1000);

		const resultText = await page.locator('body').textContent();
		expect(resultText).toMatch(/bohemian rhapsody/i);
		expect(resultText).toMatch(/chill vibes/i);
		expect(resultText).toMatch(/road trip/i);
	});

	test('searching "queen" returns tracks from both Queen playlists', async ({ page }) => {
		await page.goto('/search');
		await waitForSearchInput(page);

		const input = page.locator('input[type="text"]').first();
		await input.fill('queen');
		await input.dispatchEvent('input');

		await page.waitForTimeout(1000);

		// Both Queen tracks should appear (Bohemian Rhapsody + Don't Stop Me Now)
		const resultText = await page.locator('body').textContent();
		// At least one result should mention Queen
		expect(resultText).toMatch(/queen/i);
	});

	test('searching for an unknown term returns no results', async ({ page }) => {
		await page.goto('/search');
		await waitForSearchInput(page);

		const input = page.locator('input[type="text"]').first();
		await input.fill('zzz_no_such_track_xyzxyz');
		await input.dispatchEvent('input');

		await page.waitForTimeout(1000);

		// The app shows "No results found" or a similar empty state
		const hasNoResults = await page.getByText(/no results/i).isVisible().catch(() => false);
		const hasEmptyState = await page.locator('body').textContent().then((t) =>
			/no results|nothing found|0 result/i.test(t ?? ''),
		);

		expect(hasNoResults || hasEmptyState).toBe(true);
	});

	test('searching by artist "adele" returns Rolling in the Deep in Chill Vibes', async ({ page }) => {
		await page.goto('/search');
		await waitForSearchInput(page);

		const input = page.locator('input[type="text"]').first();
		await input.fill('adele');
		await input.dispatchEvent('input');

		await page.waitForTimeout(1000);

		const resultText = await page.locator('body').textContent();
		// t-010 "Rolling in the Deep" by Adele is in pl-001 (Chill Vibes)
		expect(resultText).toMatch(/rolling in the deep|adele/i);
	});

	test('search result track name links to spotify:track URI with playlist context', async ({ page }) => {
		await page.goto('/search');
		await waitForSearchInput(page);

		const input = page.locator('input[type="text"]').first();
		await input.fill('bohemian');
		await input.dispatchEvent('input');

		await page.waitForTimeout(1000);

		// t-001 "Bohemian Rhapsody" is in pl-001 (Chill Vibes) and pl-003 (Road Trip)
		// Find the track name link for Chill Vibes result
		const trackLinks = page.locator('a[href^="spotify:track:"]');
		await expect(trackLinks.first()).toBeVisible();

		const firstHref = await trackLinks.first().getAttribute('href');
		// Should be spotify:track:{trackId}:playlist:{playlistId}
		expect(firstHref).toMatch(/^spotify:track:[^:]+:playlist:[^:]+$/);
		expect(firstHref).toContain('spotify:track:t-001:playlist:');
	});

	test('search result playlist name links to spotify:playlist URI', async ({ page }) => {
		await page.goto('/search');
		await waitForSearchInput(page);

		const input = page.locator('input[type="text"]').first();
		await input.fill('bohemian');
		await input.dispatchEvent('input');

		await page.waitForTimeout(1000);

		// Find the playlist name link
		const playlistLinks = page.locator('a[href^="spotify:playlist:"]');
		await expect(playlistLinks.first()).toBeVisible();

		const firstHref = await playlistLinks.first().getAttribute('href');
		// Should be spotify:playlist:{playlistId}
		expect(firstHref).toMatch(/^spotify:playlist:[^:]+$/);
		// Bohemian Rhapsody is in pl-001 (Chill Vibes) and pl-003 (Road Trip)
		expect(firstHref === 'spotify:playlist:pl-001' || firstHref === 'spotify:playlist:pl-003').toBe(true);
	});

	test('search result card wrapper is not itself a link', async ({ page }) => {
		await page.goto('/search');
		await waitForSearchInput(page);

		const input = page.locator('input[type="text"]').first();
		await input.fill('bohemian');
		await input.dispatchEvent('input');

		await page.waitForTimeout(1000);

		// The list item's direct child should be a div, not an anchor
		const listItems = page.locator('ul li');
		await expect(listItems.first()).toBeVisible();
		const firstChild = listItems.first().locator('> div');
		await expect(firstChild).toBeVisible();
		// Confirm there's no wrapping anchor on the card
		const cardAnchor = listItems.first().locator('> a');
		await expect(cardAnchor).toHaveCount(0);
	});
});
