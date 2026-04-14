import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from './index.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';
const CLIENT_ID = 'test-client-id';

const env = {
	SPOTIFY_CLIENT_ID: CLIENT_ID,
	ALLOWED_ORIGIN,
};

function makeRequest(
	path: string,
	body: unknown,
	origin: string = ALLOWED_ORIGIN,
): Request {
	return new Request(`https://worker.example.com${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Origin: origin,
		},
		body: JSON.stringify(body),
	});
}

function makeOptionsRequest(path: string): Request {
	return new Request(`https://worker.example.com${path}`, {
		method: 'OPTIONS',
		headers: { Origin: ALLOWED_ORIGIN },
	});
}

describe('CORS preflight', () => {
	it('responds 204 to OPTIONS requests', async () => {
		const res = await worker.fetch(makeOptionsRequest('/exchange'), env);
		expect(res.status).toBe(204);
	});

	it('includes CORS headers on preflight response', async () => {
		const res = await worker.fetch(makeOptionsRequest('/exchange'), env);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
		expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
	});
});

describe('origin validation', () => {
	it('returns 403 when Origin does not match', async () => {
		const req = makeRequest('/exchange', {}, 'https://evil.com');
		const res = await worker.fetch(req, env);
		expect(res.status).toBe(403);
	});

	it('returns 403 with no CORS headers for unknown origin', async () => {
		const req = makeRequest('/exchange', {}, 'https://evil.com');
		const res = await worker.fetch(req, env);
		expect(res.status).toBe(403);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
		expect(res.headers.get('Access-Control-Allow-Methods')).toBeNull();
	});

	it('returns 403 for OPTIONS preflight from unknown origin', async () => {
		const req = new Request('https://worker.example.com/exchange', {
			method: 'OPTIONS',
			headers: { Origin: 'https://evil.com' },
		});
		const res = await worker.fetch(req, env);
		expect(res.status).toBe(403);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
	});

	it('returns 405 for non-POST methods from valid origin', async () => {
		const req = new Request('https://worker.example.com/exchange', {
			method: 'GET',
			headers: { Origin: ALLOWED_ORIGIN },
		});
		const res = await worker.fetch(req, env);
		expect(res.status).toBe(405);
	});

	it('returns 404 for unknown paths', async () => {
		const req = makeRequest('/unknown', {});
		const res = await worker.fetch(req, env);
		expect(res.status).toBe(404);
	});
});

describe('handleExchange — PKCE token exchange', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	it('returns 400 when required fields are missing', async () => {
		const req = makeRequest('/exchange', { code: 'abc' });
		const res = await worker.fetch(req, env);
		expect(res.status).toBe(400);
		const data = await res.json() as { error: string };
		expect(data.error).toMatch(/code_verifier/);
	});

	it('returns 400 for invalid JSON body', async () => {
		const req = new Request('https://worker.example.com/exchange', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN },
			body: 'not-json',
		});
		const res = await worker.fetch(req, env);
		expect(res.status).toBe(400);
	});

	it('does NOT send client_secret to Spotify', async () => {
		const mockFetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
				{ status: 200 },
			),
		);
		vi.stubGlobal('fetch', mockFetch);

		const req = makeRequest('/exchange', {
			code: 'auth-code',
			code_verifier: 'verifier-abc',
			redirect_uri: 'http://localhost:5173/callback',
		});
		await worker.fetch(req, env);

		expect(mockFetch).toHaveBeenCalledOnce();
		const [, init] = mockFetch.mock.calls[0];
		const body = new URLSearchParams(init.body as string);
		expect(body.has('client_secret')).toBe(false);
	});

	it('sends client_id and code_verifier to Spotify', async () => {
		const mockFetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
				{ status: 200 },
			),
		);
		vi.stubGlobal('fetch', mockFetch);

		const req = makeRequest('/exchange', {
			code: 'auth-code',
			code_verifier: 'verifier-abc',
			redirect_uri: 'http://localhost:5173/callback',
		});
		await worker.fetch(req, env);

		const [, init] = mockFetch.mock.calls[0];
		const body = new URLSearchParams(init.body as string);
		expect(body.get('client_id')).toBe(CLIENT_ID);
		expect(body.get('code_verifier')).toBe('verifier-abc');
		expect(body.get('grant_type')).toBe('authorization_code');
	});

	it('returns access_token, refresh_token, expires_in on success', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
					{ status: 200 },
				),
			),
		);

		const req = makeRequest('/exchange', {
			code: 'auth-code',
			code_verifier: 'verifier-abc',
			redirect_uri: 'http://localhost:5173/callback',
		});
		const res = await worker.fetch(req, env);
		expect(res.status).toBe(200);
		const data = await res.json() as Record<string, unknown>;
		expect(data.access_token).toBe('at');
		expect(data.refresh_token).toBe('rt');
		expect(data.expires_in).toBe(3600);
	});

	it('forwards error status from Spotify', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({ error: 'invalid_grant', error_description: 'Code expired' }),
					{ status: 400 },
				),
			),
		);

		const req = makeRequest('/exchange', {
			code: 'bad-code',
			code_verifier: 'verifier',
			redirect_uri: 'http://localhost:5173/callback',
		});
		const res = await worker.fetch(req, env);
		expect(res.status).toBe(400);
		const data = await res.json() as { error: string };
		expect(data.error).toBe('Code expired');
	});
});

describe('handleRefresh — PKCE token refresh', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	it('returns 400 when refresh_token is missing', async () => {
		const req = makeRequest('/refresh', {});
		const res = await worker.fetch(req, env);
		expect(res.status).toBe(400);
		const data = await res.json() as { error: string };
		expect(data.error).toMatch(/refresh_token/);
	});

	it('does NOT send client_secret to Spotify', async () => {
		const mockFetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({ access_token: 'new-at', expires_in: 3600 }),
				{ status: 200 },
			),
		);
		vi.stubGlobal('fetch', mockFetch);

		const req = makeRequest('/refresh', { refresh_token: 'rt-abc' });
		await worker.fetch(req, env);

		expect(mockFetch).toHaveBeenCalledOnce();
		const [, init] = mockFetch.mock.calls[0];
		const body = new URLSearchParams(init.body as string);
		expect(body.has('client_secret')).toBe(false);
	});

	it('sends client_id and refresh_token to Spotify', async () => {
		const mockFetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({ access_token: 'new-at', expires_in: 3600 }),
				{ status: 200 },
			),
		);
		vi.stubGlobal('fetch', mockFetch);

		const req = makeRequest('/refresh', { refresh_token: 'rt-abc' });
		await worker.fetch(req, env);

		const [, init] = mockFetch.mock.calls[0];
		const body = new URLSearchParams(init.body as string);
		expect(body.get('client_id')).toBe(CLIENT_ID);
		expect(body.get('refresh_token')).toBe('rt-abc');
		expect(body.get('grant_type')).toBe('refresh_token');
	});

	it('returns access_token and expires_in on success', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({ access_token: 'new-at', expires_in: 3600 }),
					{ status: 200 },
				),
			),
		);

		const req = makeRequest('/refresh', { refresh_token: 'rt-abc' });
		const res = await worker.fetch(req, env);
		expect(res.status).toBe(200);
		const data = await res.json() as Record<string, unknown>;
		expect(data.access_token).toBe('new-at');
		expect(data.expires_in).toBe(3600);
		expect(data).not.toHaveProperty('refresh_token');
	});

	it('forwards error status from Spotify', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({ error: 'invalid_grant', error_description: 'Refresh token revoked' }),
					{ status: 400 },
				),
			),
		);

		const req = makeRequest('/refresh', { refresh_token: 'bad-rt' });
		const res = await worker.fetch(req, env);
		expect(res.status).toBe(400);
		const data = await res.json() as { error: string };
		expect(data.error).toBe('Refresh token revoked');
	});

	it('includes CORS headers in all responses', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ access_token: 'at', expires_in: 3600 }), { status: 200 }),
			),
		);

		const req = makeRequest('/refresh', { refresh_token: 'rt' });
		const res = await worker.fetch(req, env);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
	});
});
