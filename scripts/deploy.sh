#!/bin/bash
set -euo pipefail

# Deploy Spotify Helper to Cloudflare (Worker + Pages)
#
# Usage:
#   ./scripts/deploy.sh              Deploy everything (worker + frontend)
#   ./scripts/deploy.sh worker       Deploy only the auth Worker
#   ./scripts/deploy.sh pages        Deploy only the Pages frontend
#   ./scripts/deploy.sh secrets      Set Worker secrets interactively
#   ./scripts/deploy.sh check        Validate prerequisites only
#
# Prerequisites:
#   - Node.js 18+
#   - wrangler CLI authenticated (npx wrangler login)
#   - Worker secrets configured (run: ./scripts/deploy.sh secrets)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ---------------------------------------------------------------------------
# Prerequisite checks
# ---------------------------------------------------------------------------

check_node() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Install Node.js 18+ and try again."
        return 1
    fi

    local node_version
    node_version=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$node_version" -lt 18 ]; then
        log_error "Node.js 18+ required. Found: $(node -v)"
        return 1
    fi
    log_info "Node.js $(node -v) found"
}

check_wrangler() {
    if ! npx wrangler --version &> /dev/null 2>&1; then
        log_error "wrangler CLI not found. Run: npm install -g wrangler"
        return 1
    fi
    log_info "wrangler CLI found"
}

check_wrangler_auth() {
    if ! npx wrangler whoami &> /dev/null 2>&1; then
        log_error "wrangler not authenticated. Run: npx wrangler login"
        return 1
    fi
    log_info "wrangler authenticated"
}

check_dependencies() {
    if [ ! -d "$ROOT_DIR/node_modules" ]; then
        log_warn "Root node_modules missing. Running npm install..."
        cd "$ROOT_DIR"
        npm install
    fi

    if [ ! -d "$ROOT_DIR/workers/auth/node_modules" ]; then
        log_warn "Worker node_modules missing. Running npm install..."
        cd "$ROOT_DIR/workers/auth"
        npm install
    fi
    log_info "Dependencies installed"
}

run_checks() {
    log_info "Checking prerequisites..."
    echo ""
    check_node
    check_wrangler
    check_wrangler_auth
    check_dependencies
    echo ""
    log_info "All prerequisites met."
}

# ---------------------------------------------------------------------------
# Secrets management
# ---------------------------------------------------------------------------

setup_secrets() {
    log_info "Setting Worker secrets..."
    echo ""
    echo "You will be prompted to enter each secret value."
    echo "These are stored securely in Cloudflare and never committed to git."
    echo ""

    cd "$ROOT_DIR/workers/auth"

    local secrets=("SPOTIFY_CLIENT_ID" "SPOTIFY_CLIENT_SECRET" "ALLOWED_ORIGIN")
    for secret in "${secrets[@]}"; do
        echo "--- $secret ---"
        npx wrangler secret put "$secret"
        echo ""
    done

    log_info "Worker secrets configured."
    echo ""
    echo "Reminder: Also set these in Cloudflare Pages dashboard:"
    echo "  PUBLIC_SPOTIFY_CLIENT_ID    — Your Spotify app client ID"
    echo "  PUBLIC_AUTH_WORKER_URL      — Deployed Worker URL"
    echo "  PUBLIC_SPOTIFY_REDIRECT_URI — Production callback URL"
}

# ---------------------------------------------------------------------------
# Deployment
# ---------------------------------------------------------------------------

deploy_worker() {
    log_info "Deploying auth Worker..."
    cd "$ROOT_DIR/workers/auth"
    npx wrangler deploy
    echo ""
    log_info "Auth Worker deployed."
}

deploy_pages() {
    log_info "Building SvelteKit app..."
    cd "$ROOT_DIR/apps/web"
    npm run build
    echo ""

    log_info "Deploying to Cloudflare Pages..."
    npx wrangler pages deploy build/ --project-name=spotify-helper
    echo ""
    log_info "Frontend deployed to Cloudflare Pages."
}

deploy_all() {
    echo "=== Deploying Spotify Helper ==="
    echo ""

    run_checks
    echo ""

    echo "[1/2] Auth Worker"
    deploy_worker
    echo ""

    echo "[2/2] Frontend (Cloudflare Pages)"
    deploy_pages
    echo ""

    echo "=== Deployment complete ==="
    echo ""
    echo "Post-deployment checklist:"
    echo "  1. Verify Worker is responding:  curl -I https://spotify-auth.<account>.workers.dev"
    echo "  2. Verify Pages is live:         open https://spotify-helper.pages.dev"
    echo "  3. Test the auth flow end-to-end"
    echo ""
    echo "If this is your first deploy, also run:"
    echo "  ./scripts/deploy.sh secrets"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

case "${1:-all}" in
    worker)
        run_checks
        deploy_worker
        ;;
    pages)
        run_checks
        deploy_pages
        ;;
    secrets)
        setup_secrets
        ;;
    check)
        run_checks
        ;;
    all)
        deploy_all
        ;;
    *)
        echo "Usage: $0 {all|worker|pages|secrets|check}"
        exit 1
        ;;
esac
