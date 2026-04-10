# Deployment Guide

Spotify Helper deploys to Cloudflare as two components:

| Component | Service | What it does |
|-----------|---------|-------------|
| Auth Worker | Cloudflare Workers | Proxies OAuth token exchange (keeps client secret server-side) |
| Frontend | Cloudflare Pages | Serves the SvelteKit SPA |

## Prerequisites

- Node.js 18+
- wrangler CLI authenticated: `npx wrangler login`
- A Spotify Developer app with Client ID and Client Secret

## Quick deploy

```bash
./scripts/deploy.sh          # Deploy everything
```

The script validates prerequisites, deploys the Worker, builds the frontend, and deploys to Pages.

## Step-by-step

### 1. Set Worker secrets

These are stored in Cloudflare (never in git):

```bash
./scripts/deploy.sh secrets
```

This prompts for:

| Secret | Value |
|--------|-------|
| `SPOTIFY_CLIENT_ID` | Your Spotify app Client ID |
| `SPOTIFY_CLIENT_SECRET` | Your Spotify app Client Secret |
| `ALLOWED_ORIGIN` | Your Pages URL (e.g. `https://spotify-helper.pages.dev`) |

### 2. Deploy the auth Worker

```bash
./scripts/deploy.sh worker
```

Note the deployed URL (e.g. `https://spotify-auth.<account>.workers.dev`). You need it for step 3.

### 3. Configure Pages environment variables

In the Cloudflare dashboard under Pages > spotify-helper > Settings > Environment variables, set:

| Variable | Value |
|----------|-------|
| `PUBLIC_SPOTIFY_CLIENT_ID` | Your Spotify app Client ID |
| `PUBLIC_AUTH_WORKER_URL` | Worker URL from step 2 |
| `PUBLIC_SPOTIFY_REDIRECT_URI` | `https://spotify-helper.pages.dev/auth/callback` |

### 4. Deploy the frontend

```bash
./scripts/deploy.sh pages
```

### 5. Configure Spotify redirect URI

In the Spotify Developer Dashboard, add your production callback URL as a redirect URI:

```
https://spotify-helper.pages.dev/auth/callback
```

## Deploy script options

```bash
./scripts/deploy.sh all      # Deploy worker + pages (default)
./scripts/deploy.sh worker   # Deploy auth Worker only
./scripts/deploy.sh pages    # Deploy Pages frontend only
./scripts/deploy.sh secrets  # Set Worker secrets interactively
./scripts/deploy.sh check    # Validate prerequisites only
```

## Environments

The Worker supports staging and production environments via `wrangler.toml`:

```bash
# Deploy to staging
npx wrangler deploy --env staging -c workers/auth/wrangler.toml

# Deploy to production (default)
npx wrangler deploy -c workers/auth/wrangler.toml
```

Set secrets per environment:
```bash
npx wrangler secret put SPOTIFY_CLIENT_SECRET --env staging
```

## Custom domains

To use a custom domain for the Worker, uncomment and configure the `routes` section in `workers/auth/wrangler.toml`.

For Pages, configure a custom domain in the Cloudflare dashboard under Pages > spotify-helper > Custom domains.

## Troubleshooting

**"wrangler not authenticated"** -- Run `npx wrangler login` and follow the browser prompt.

**Worker returns 403** -- Check that `ALLOWED_ORIGIN` matches your Pages URL exactly (including protocol, no trailing slash).

**Auth flow fails in production** -- Verify that the Spotify Developer Dashboard has the correct production redirect URI, and that `PUBLIC_SPOTIFY_REDIRECT_URI` in Pages matches.

**Build fails** -- Run `npm install` in both the root and `workers/auth/` directories. Check Node.js is 18+.
