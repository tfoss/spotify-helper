// Cloudflare Worker for Spotify OAuth authentication
// Placeholder — implementation coming in a future bead
export default {
	async fetch(_request: Request, _env: unknown, _ctx: unknown): Promise<Response> {
		return new Response('Auth worker placeholder', { status: 200 });
	}
};
