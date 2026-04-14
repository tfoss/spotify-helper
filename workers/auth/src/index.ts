interface Env {
	SPOTIFY_CLIENT_ID: string;
	ALLOWED_ORIGIN: string;
}

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

function corsHeaders(allowedOrigin: string): Record<string, string> {
	return {
		'Access-Control-Allow-Origin': allowedOrigin,
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};
}

function validateOrigin(request: Request, allowedOrigin: string): boolean {
	const origin = request.headers.get('Origin');
	return origin === allowedOrigin;
}

function errorResponse(message: string, status: number, allowedOrigin: string): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: {
			'Content-Type': 'application/json',
			...corsHeaders(allowedOrigin),
		},
	});
}

function jsonResponse(data: unknown, allowedOrigin: string): Response {
	return new Response(JSON.stringify(data), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			...corsHeaders(allowedOrigin),
		},
	});
}

async function handleExchange(request: Request, env: Env): Promise<Response> {
	let body: { code?: string; code_verifier?: string; redirect_uri?: string };
	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON body', 400, env.ALLOWED_ORIGIN);
	}

	const { code, code_verifier, redirect_uri } = body;
	if (!code || !code_verifier || !redirect_uri) {
		return errorResponse('Missing required fields: code, code_verifier, redirect_uri', 400, env.ALLOWED_ORIGIN);
	}

	const params = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri,
		client_id: env.SPOTIFY_CLIENT_ID,
		code_verifier,
	});

	const spotifyResponse = await fetch(SPOTIFY_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: params.toString(),
	});

	const spotifyData = await spotifyResponse.json() as Record<string, unknown>;

	if (!spotifyResponse.ok) {
		return errorResponse(
			(spotifyData['error_description'] as string) ?? 'Token exchange failed',
			spotifyResponse.status,
			env.ALLOWED_ORIGIN,
		);
	}

	return jsonResponse(
		{
			access_token: spotifyData['access_token'],
			refresh_token: spotifyData['refresh_token'],
			expires_in: spotifyData['expires_in'],
		},
		env.ALLOWED_ORIGIN,
	);
}

async function handleRefresh(request: Request, env: Env): Promise<Response> {
	let body: { refresh_token?: string };
	try {
		body = await request.json();
	} catch {
		return errorResponse('Invalid JSON body', 400, env.ALLOWED_ORIGIN);
	}

	const { refresh_token } = body;
	if (!refresh_token) {
		return errorResponse('Missing required field: refresh_token', 400, env.ALLOWED_ORIGIN);
	}

	const params = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token,
		client_id: env.SPOTIFY_CLIENT_ID,
	});

	const spotifyResponse = await fetch(SPOTIFY_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: params.toString(),
	});

	const spotifyData = await spotifyResponse.json() as Record<string, unknown>;

	if (!spotifyResponse.ok) {
		return errorResponse(
			(spotifyData['error_description'] as string) ?? 'Token refresh failed',
			spotifyResponse.status,
			env.ALLOWED_ORIGIN,
		);
	}

	return jsonResponse(
		{
			access_token: spotifyData['access_token'],
			expires_in: spotifyData['expires_in'],
		},
		env.ALLOWED_ORIGIN,
	);
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Validate origin first — no CORS headers for unknown origins
		if (!validateOrigin(request, env.ALLOWED_ORIGIN)) {
			return new Response(JSON.stringify({ error: 'Forbidden' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Handle CORS preflight (origin already validated above)
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders(env.ALLOWED_ORIGIN),
			});
		}

		if (request.method !== 'POST') {
			return errorResponse('Method not allowed', 405, env.ALLOWED_ORIGIN);
		}

		if (url.pathname === '/exchange') {
			return handleExchange(request, env);
		}

		if (url.pathname === '/refresh') {
			return handleRefresh(request, env);
		}

		return errorResponse('Not found', 404, env.ALLOWED_ORIGIN);
	},
};
