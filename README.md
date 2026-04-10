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

### Prerequisites

- Node.js 18+
- A [Spotify Developer](https://developer.spotify.com/dashboard) app with a Client ID and Client Secret

### 1. Install dependencies

```
git clone https://github.com/tfoss/spotify-helper.git
cd spotify-helper
npm install
cd workers/auth && npm install && cd ../..
```

### 2. Configure environment

Copy the example env file to the repo root and fill in your Spotify credentials:

```
cp .env.example .env
```

Required values in `.env`:

| Variable | Where to find it |
|----------|-----------------|
| `PUBLIC_SPOTIFY_CLIENT_ID` | Spotify Developer Dashboard → your app → Client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify Developer Dashboard → your app → Client Secret |
| `PUBLIC_AUTH_WORKER_URL` | Set to `http://127.0.0.1:8787` for local dev |
| `PUBLIC_APP_ENV` | Set to `local` |

The web app reads `.env` via a symlink at `apps/web/.env` → `../../.env`. If that symlink is missing, create it:

```
ln -s ../../.env apps/web/.env
```

### 3. Configure Spotify redirect URI

In the Spotify Developer Dashboard, add this as a redirect URI for your app:

```
http://127.0.0.1:5174/auth/callback
```

> **Important:** Spotify requires `127.0.0.1` (the IP literal), not `localhost`. Using `localhost` will be rejected.

### 4. Set up the auth worker's local secrets

Create `workers/auth/.dev.vars` with your Spotify credentials (this file is gitignored):

```
SPOTIFY_CLIENT_ID=<your client id>
SPOTIFY_CLIENT_SECRET=<your client secret>
ALLOWED_ORIGIN=http://127.0.0.1:5174
```

### 5. Start the dev servers

You need **two terminals**:

**Terminal 1 — Auth worker** (runs on port 8787):
```
cd workers/auth
npm run dev
```

**Terminal 2 — Web app** (runs on port 5174):
```
cd apps/web
npm run dev
```

Then open `http://127.0.0.1:5174` in your browser and click "Connect with Spotify".

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

Run `scripts/deploy.sh` to deploy both the auth Worker and the SvelteKit frontend to Cloudflare. Prerequisites: `wrangler` CLI authenticated (`npx wrangler login`).

Before first deploy, set the required Worker secrets:

```
cd workers/auth
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET
npx wrangler secret put ALLOWED_ORIGIN
```

Set these environment variables in Cloudflare Pages:

| Variable | Description |
|----------|-------------|
| `PUBLIC_SPOTIFY_CLIENT_ID` | Your Spotify app client ID |
| `PUBLIC_AUTH_WORKER_URL` | Deployed Worker URL (e.g. `https://spotify-auth.<account>.workers.dev`) |
| `PUBLIC_SPOTIFY_REDIRECT_URI` | Production callback URL |

See [PROJECT.md](./PROJECT.md) for full deployment details.

## License

TBD
