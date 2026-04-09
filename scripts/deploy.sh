#!/bin/bash
set -euo pipefail

# Deploy Spotify Helper to Cloudflare
# Prerequisites:
#   - wrangler CLI installed and authenticated (npx wrangler login)
#   - Secrets configured (see below)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Deploying Spotify Helper ==="
echo ""

# Step 1: Deploy the auth Worker
echo "[1/3] Deploying auth Worker..."
cd "$ROOT_DIR/workers/auth"
npx wrangler deploy
echo "Auth Worker deployed."
echo ""

# Step 2: Build the SvelteKit frontend
echo "[2/3] Building SvelteKit app..."
cd "$ROOT_DIR/apps/web"
npm run build
echo "Build complete."
echo ""

# Step 3: Deploy frontend to Cloudflare Pages
echo "[3/3] Deploying to Cloudflare Pages..."
npx wrangler pages deploy build/ --project-name=spotify-helper
echo "Frontend deployed."
echo ""

echo "=== Deployment complete ==="
echo ""
echo "--- Required secrets (set if not already configured) ---"
echo "  cd workers/auth"
echo "  npx wrangler secret put SPOTIFY_CLIENT_ID"
echo "  npx wrangler secret put SPOTIFY_CLIENT_SECRET"
echo "  npx wrangler secret put ALLOWED_ORIGIN"
echo ""
echo "--- Required env vars for Pages ---"
echo "  PUBLIC_SPOTIFY_CLIENT_ID    (your Spotify app client ID)"
echo "  PUBLIC_AUTH_WORKER_URL      (your deployed Worker URL)"
echo "  PUBLIC_SPOTIFY_REDIRECT_URI (your production callback URL)"
