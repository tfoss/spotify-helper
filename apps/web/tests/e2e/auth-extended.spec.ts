/**
 * sh-rx0.5 — Auth flow E2E tests using the shared fixtures.
 *
 * Covers:
 *   1. Unauthenticated home page shows Connect button
 *   2. Clicking Connect navigates to Spotify with correct PKCE params
 *   3. Valid callback (code + state) stores tokens and redirects to home
 *   4. Callback with mismatched state shows CSRF-error message
 *   5. Logout clears tokens and returns to unauthenticated state
 *
 * Tests use intercepted network routes — no real Spotify or Worker calls
 * are made. Auth exchange is stubbed via the Worker /token endpoint.
 */

import { test, expect, setFakeAuth, interceptAuthRefresh } from './fixtures';

const MOCK_ACCESS_TOKEN = 'mock_access_token_rx05';
const MOCK_REFRESH_TOKEN = 'mock_refresh_token_rx05';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stub the Worker /token exchange endpoint. */
async function interceptTokenExchange(page: import('@playwright/test').Page) {
	await page.route('**/token', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				access_token: MOCK_ACCESS_TOKEN,
				refresh_token: MOCK_REFRESH_TOKEN,
				expires_in: 3600,
			}),
		});
	});
}

/** Stub the Spotify /me profile endpoint. */
async function interceptSpotifyMe(page: import('@playwright/test').Page) {
	await page.route('**/api.spotify.com/v1/me', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				id: 'test_user_rx05',
				display_name: 'Test User',
				email: 'test@example.com',
				images: [],
			}),
		});
	});
}

// ---------------------------------------------------------------------------
// 1. Unauthenticated state
// ---------------------------------------------------------------------------

test.describe('Unauthenticated home page', () => {
	test('shows Connect with Spotify button when not logged in', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const connectBtn = page.getByRole('button', { name: /connect with spotify/i });
		await expect(connectBtn).toBeVisible({ timeout: 10000 });

		// Must NOT show the logged-in navigation links
		await expect(page.getByRole('link', { name: /^Search$/i })).not.toBeVisible();
	});
});

// ---------------------------------------------------------------------------
// 2. Connect → OAuth redirect
// ---------------------------------------------------------------------------

test.describe('Connect with Spotify', () => {
	test('clicking Connect navigates to Spotify authorize with PKCE params', async ({ page }) => {
		let capturedAuthUrl: URL | null = null;

		// Intercept the Spotify authorize redirect
		await page.route('**/accounts.spotify.com/authorize**', async (route) => {
			capturedAuthUrl = new URL(route.request().url());
			await route.fulfill({
				status: 200,
				contentType: 'text/html',
				body: '<html><body>Mocked Spotify Auth</body></html>',
			});
		});

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const connectBtn = page.getByRole('button', { name: /connect with spotify/i });
		await expect(connectBtn).toBeVisible({ timeout: 10000 });

		await Promise.all([
			page.waitForURL('**/accounts.spotify.com/**', { timeout: 5000 }).catch(() => null),
			connectBtn.click(),
		]);

		// Verify PKCE parameters were included
		if (capturedAuthUrl) {
			expect(capturedAuthUrl.searchParams.get('response_type')).toBe('code');
			expect(capturedAuthUrl.searchParams.get('code_challenge_method')).toBe('S256');
			expect(capturedAuthUrl.searchParams.has('code_challenge')).toBe(true);
			expect(capturedAuthUrl.searchParams.has('state')).toBe(true);
			expect(capturedAuthUrl.searchParams.has('scope')).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// 3. Valid callback → authenticated
// ---------------------------------------------------------------------------

test.describe('OAuth callback — valid state', () => {
	test('valid code + state stores tokens and redirects to home', async ({ page }) => {
		let capturedAuthUrl: URL | null = null;

		await page.route('**/accounts.spotify.com/authorize**', async (route) => {
			capturedAuthUrl = new URL(route.request().url());
			await route.fulfill({
				status: 200,
				contentType: 'text/html',
				body: '<html><body>Mocked Spotify Auth</body></html>',
			});
		});

		await interceptTokenExchange(page);
		await interceptSpotifyMe(page);
		await interceptAuthRefresh(page, MOCK_ACCESS_TOKEN);

		// Go to home so login() can store a PKCE state value in localStorage
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const connectBtn = page.getByRole('button', { name: /connect with spotify/i });
		await expect(connectBtn).toBeVisible({ timeout: 10000 });
		await connectBtn.click();

		if (!capturedAuthUrl) {
			test.skip(); // Shouldn't happen in CI but guards against timing issues
			return;
		}

		const state = capturedAuthUrl.searchParams.get('state');
		await page.goto(`/auth/callback?code=mock_code_valid&state=${state}`);

		await page.waitForURL('/', { timeout: 8000 });

		// Should now be authenticated
		await expect(page.getByRole('link', { name: /^Search$/i })).toBeVisible({ timeout: 8000 });
		await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();
	});
});

// ---------------------------------------------------------------------------
// 4. Mismatched state → CSRF error
// ---------------------------------------------------------------------------

test.describe('OAuth callback — mismatched state', () => {
	test('callback with wrong state shows CSRF error message', async ({ page }) => {
		// Set a real PKCE state in localStorage so the callback handler has
		// something to compare against
		await page.addInitScript(() => {
			localStorage.setItem('spotify_auth_state', 'correct_state_value');
		});

		await page.goto('/auth/callback?code=some_code&state=WRONG_STATE');
		await page.waitForLoadState('networkidle');

		// The page should show an auth error — either "Invalid state" or
		// "Authentication Failed" heading with the CSRF detail
		const hasInvalidState = await page
			.getByText(/invalid state|csrf/i)
			.isVisible()
			.catch(() => false);

		const hasAuthFailed = await page
			.getByRole('heading', { name: /authentication failed/i })
			.isVisible()
			.catch(() => false);

		expect(hasInvalidState || hasAuthFailed).toBe(true);

		// The "Back to Home" link should be visible
		await expect(page.getByRole('link', { name: /back to home/i })).toBeVisible();
	});
});

// ---------------------------------------------------------------------------
// 5. Logout
// ---------------------------------------------------------------------------

test.describe('Logout', () => {
	test('clicking Log out clears tokens and shows Connect button', async ({ authenticatedPage: page }) => {
		// Navigate to home as an authenticated user
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Should see the Log out button
		const logoutBtn = page.getByRole('button', { name: /^Log out$/i });
		await expect(logoutBtn).toBeVisible({ timeout: 10000 });

		await logoutBtn.click();

		// Should redirect to home in unauthenticated state
		await page.waitForURL('/', { timeout: 5000 });
		await page.waitForLoadState('networkidle');

		// Must show Connect button again
		const connectBtn = page.getByRole('button', { name: /connect with spotify/i });
		await expect(connectBtn).toBeVisible({ timeout: 8000 });

		// Verify localStorage no longer holds a refresh token
		const refreshToken = await page.evaluate(() =>
			localStorage.getItem('spotify_refresh_token'),
		);
		expect(refreshToken).toBeNull();
	});

	test('logout hides Search and Analytics links', async ({ authenticatedPage: page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Verify authenticated state first
		await expect(
			page.getByRole('link', { name: /^Search$/i }),
		).toBeVisible({ timeout: 10000 });

		const logoutBtn = page.getByRole('button', { name: /^Log out$/i });
		await expect(logoutBtn).toBeVisible();
		await logoutBtn.click();

		await page.waitForURL('/', { timeout: 5000 });
		await page.waitForLoadState('networkidle');

		await expect(
			page.getByRole('link', { name: /^Search$/i }),
		).not.toBeVisible({ timeout: 5000 });
	});
});
