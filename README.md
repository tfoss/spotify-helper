# Spotify Helper

Local-first playlist search and listening analytics.

## What it does

Spotify Helper syncs your Spotify library to an in-browser database and gives you two main features:

- **Playlist search** — search across all your playlists by track name, artist, or both. Find which playlists contain a specific song without scrolling through each one.
- **Listening analytics** — visualize your listening habits: top artists and tracks over different time ranges, recently played history, and playlist-level breakdowns.

All data lives in your browser (wa-sqlite + OPFS). Nothing is sent to a third-party backend.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | SvelteKit (static SPA) |
| Styling | Tailwind CSS |
| Charts | LayerChart (Svelte + D3) |
| Local DB | wa-sqlite + OPFS (in-browser, persistent) |
| Auth proxy | Cloudflare Worker |
| Hosting | Cloudflare Pages + Workers |

## Local development

1. Clone the repo and install dependencies:
   ```
   git clone https://github.com/tfoss/spotify-helper.git
   cd spotify-helper
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your credentials:
   ```
   cp .env.example .env
   ```
   You need `PUBLIC_SPOTIFY_CLIENT_ID` from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

3. In the Spotify Dashboard, register `http://localhost:5173/auth/callback` as a redirect URI for your app.

4. Start the dev server:
   ```
   npm run dev
   ```

## Project structure

```
apps/web/                  SvelteKit SPA
  src/lib/auth/            PKCE helpers, token management
  src/lib/spotify/         Typed API client, scopes
  src/lib/db/              wa-sqlite client, schema, queries
  src/lib/search/          Search domain logic
  src/lib/stores/          Svelte stores (auth, search)
  src/components/          UI components (search, charts)
  src/routes/              SvelteKit pages

workers/auth/              Cloudflare Worker — OAuth token proxy
```

## Auth flow

Spotify Helper uses PKCE (Proof Key for Code Exchange) OAuth. The browser generates a code verifier/challenge pair and redirects to Spotify for login. On callback, it sends the authorization code to a Cloudflare Worker that exchanges it for tokens using the client secret — keeping the secret server-side. Access tokens are held in memory; refresh tokens are stored in localStorage.

## Deployment

See the Deployment section in [PROJECT.md](./PROJECT.md) for full details. In short: the SvelteKit app deploys to Cloudflare Pages, and the auth worker deploys via `wrangler deploy` in the `workers/auth/` directory. Set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `ALLOWED_ORIGIN` as Worker secrets.

## License

TBD
