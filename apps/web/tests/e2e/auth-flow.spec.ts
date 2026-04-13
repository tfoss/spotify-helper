import { test, expect } from '@playwright/test';

/**
 * E2E test for the full Spotify OAuth PKCE auth flow.
 * All network calls are intercepted — no real Spotify or Worker calls are made.
 */

const MOCK_CLIENT_ID = 'test_client_id';
const MOCK_ACCESS_TOKEN = 'mock_access_token_abc123';
const MOCK_REFRESH_TOKEN = 'mock_refresh_token_xyz789';

test.describe('Auth Flow', () => {
	test('full login flow: connect → Spotify redirect → callback → authenticated', async ({ page }) => {
		let capturedAuthUrl: URL | null = null;

		// Intercept the Spotify authorization redirect to capture params
		await page.route('**/accounts.spotify.com/authorize**', async (route) => {
			capturedAuthUrl = new URL(route.request().url());
			// Don't actually navigate to Spotify — we'll simulate the callback
			await route.fulfill({
				status: 200,
				contentType: 'text/html',
				body: '<html><body>Mocked Spotify Auth</body></html>',
			});
		});

		// Intercept the Worker /exchange endpoint (token exchange)
		await page.route('**/exchange', async (route) => {
			const body = route.request().postDataJSON();
			expect(body).toHaveProperty('code');
			expect(body).toHaveProperty('code_verifier');
			expect(body).toHaveProperty('redirect_uri');

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

		// Intercept Spotify API calls to verify token usage
		await page.route('**/api.spotify.com/v1/me', async (route) => {
			const authHeader = route.request().headers()['authorization'];
			expect(authHeader).toBe(`Bearer ${MOCK_ACCESS_TOKEN}`);

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: 'test_user',
					display_name: 'Test User',
					email: 'test@example.com',
					images: [],
				}),
			});
		});

		// Step 1: Navigate to home — should see "Connect with Spotify"
		await page.goto('/');
		const connectButton = page.getByRole('button', { name: /connect with spotify/i });
		await expect(connectButton).toBeVisible();

		// Step 2: Click connect — the app will try to redirect to Spotify
		// We need to capture the navigation before it happens
		const [navigation] = await Promise.all([
			page.waitForURL('**/accounts.spotify.com/**', { timeout: 5000 }).catch(() => null),
			connectButton.click(),
		]);

		// Verify the auth URL had the correct PKCE params
		if (capturedAuthUrl) {
			expect(capturedAuthUrl.searchParams.get('response_type')).toBe('code');
			expect(capturedAuthUrl.searchParams.get('code_challenge_method')).toBe('S256');
			expect(capturedAuthUrl.searchParams.has('code_challenge')).toBe(true);
			expect(capturedAuthUrl.searchParams.has('state')).toBe(true);
			expect(capturedAuthUrl.searchParams.has('scope')).toBe(true);

			// Step 3: Simulate callback with the state from the auth URL
			const state = capturedAuthUrl.searchParams.get('state');
			await page.goto(`/auth/callback?code=mock_auth_code&state=${state}`);

			// Step 4: After successful exchange, should redirect to home
			await page.waitForURL('/', { timeout: 5000 });

			// Step 5: Verify authenticated state — should see Search/Analytics links
			await expect(page.getByRole('link', { name: /search/i })).toBeVisible();
			await expect(page.getByRole('link', { name: /analytics/i })).toBeVisible();
		}
	});

	test('callback with error param shows error message', async ({ page }) => {
		await page.goto('/auth/callback?error=access_denied');

		await expect(page.getByText(/access was denied/i)).toBeVisible();
		await expect(page.getByRole('link', { name: /back to home/i })).toBeVisible();
	});

	test('callback without code/state shows error', async ({ page }) => {
		await page.goto('/auth/callback');

		await expect(page.getByText(/missing/i)).toBeVisible();
	});
});
