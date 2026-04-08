# PROJECT.md — Project Brief

## One-liner

A local-first webapp for searching Spotify playlists and exploring personal listening analytics, built as a single-page application with optional Cloudflare deployment.

## Product Vision

Spotify's native app is weak at answering practical personal questions like:
- Which of my playlists contain this song?
- Which playlists contain songs by this artist?
- What have I been listening to most lately?
- How do my listening patterns change over time?

This project creates a focused utility app that augments Spotify with:
1. Fast playlist search across a user's library
2. Useful personal listening analytics and visualizations
3. A polished, responsive interface that works locally and deploys simply to Cloudflare

---

## How Agents Should Use This Brief

This brief is the authoritative source of truth for the project. Agents should:

1. **Read the full brief before writing any code.** Understand the architecture, constraints, and phased milestones before beginning.
2. **Work phase by phase.** Each phase (Foundation → Search → Analytics → Deployment) should be completed and verified before moving to the next. Do not jump ahead.
3. **Ask before inventing.** If a requirement is ambiguous, ask for clarification rather than making a consequential assumption. Small assumptions (naming, minor layout choices) are fine; architectural assumptions are not.
4. **Prefer explicit over implicit.** Code should be typed, documented at module boundaries, and structured to match the directory layout in this brief.
5. **Do not gold-plate.** Stick to must-haves in each phase. Nice-to-haves are listed but should not be built unless explicitly requested.
6. **Tests are not optional.** Every phase includes required tests. Do not mark a phase complete without passing tests for that phase.

---

## Problem

Spotify makes it easy to play music, but not easy to answer higher-level questions about a user's own library and habits.

The app solves two main problems:

### 1. Playlist Search
The user wants to search across all of their playlists to determine:
- Which playlists contain a specific song
- Which playlists contain tracks matching a title
- Which playlists contain songs by a specific artist
- Optionally, which playlists contain matching albums or partial/fuzzy matches

### 2. Listening Analytics
The user wants to inspect and visualize their listening behavior, including:
- Top tracks and artists over common time windows
- Recent listening activity
- Trends and distributions
- Configurable charts for common analysis tasks

---

## Technical Strategy: "Local-First Analytics"

To solve data limitations and performance issues, the app follows a **Local-First** architecture:

- **Primary Store:** `wa-sqlite` compiled to WebAssembly, running in a dedicated Web Worker. Do not use DuckDB-wasm — it is heavier and its analytical orientation is not needed here.
- **Ingestion:** Incremental sync from Spotify API directly into the local browser database.
- **Persistence:** Origin Private File System (OPFS) for durable, fast in-browser storage. This keeps all user data local and private.
- **Privacy:** No user listening data is ever stored on a centralized server.

---

## Recommended Stack

| Concern | Choice | Notes |
|---|---|---|
| Frontend framework | SvelteKit (Static Adapter) | SPA mode; no SSR required |
| Local database | `wa-sqlite` + OPFS | Resolves to this; do not substitute DuckDB-wasm |
| Styling | Tailwind CSS | Utility-first; avoid heavy component libraries |
| Charts | LayerChart | Svelte-native wrapper around D3; use its built-in chart components rather than writing raw D3 unless a chart type is not supported, or user asks specifically for D3 |
| Auth | Spotify OAuth 2.0 — PKCE flow | See Auth section for full detail |
| Testing — unit/logic | Vitest | |
| Testing — E2E | Playwright | |
| Deployment | Cloudflare Pages (frontend) + Cloudflare Workers (auth proxy) | See Deployment section |

---

## Target Directory Structure

Agents must follow this layout. Do not reorganize without explicit instruction.

```
/
├── apps/
│   └── web/                        # SvelteKit SPA
│       ├── src/
│       │   ├── routes/             # SvelteKit file-based routes
│       │   │   ├── +layout.svelte
│       │   │   ├── +page.svelte    # Root / redirect
│       │   │   ├── search/
│       │   │   │   └── +page.svelte
│       │   │   ├── analytics/
│       │   │   │   └── +page.svelte
│       │   │   └── auth/
│       │   │       └── callback/
│       │   │           └── +page.svelte
│       │   ├── lib/
│       │   │   ├── spotify/        # Typed Spotify API client
│       │   │   │   ├── client.ts
│       │   │   │   ├── types.ts
│       │   │   │   └── scopes.ts
│       │   │   ├── db/             # wa-sqlite setup, schema, migrations
│       │   │   │   ├── worker.ts   # DB Web Worker entry point
│       │   │   │   ├── schema.ts
│       │   │   │   └── queries.ts
│       │   │   ├── search/         # Search domain logic (pure functions)
│       │   │   │   ├── index.ts
│       │   │   │   └── types.ts
│       │   │   ├── analytics/      # Analytics transform layer (pure functions)
│       │   │   │   ├── index.ts
│       │   │   │   └── types.ts
│       │   │   ├── charts/         # Chart config and abstraction layer
│       │   │   │   ├── config.ts
│       │   │   │   └── types.ts
│       │   │   ├── auth/           # PKCE helpers, token store
│       │   │   │   ├── pkce.ts
│       │   │   │   └── tokens.ts
│       │   │   └── stores/         # Svelte stores for UI state
│       │   │       ├── auth.ts
│       │   │       ├── sync.ts
│       │   │       └── search.ts
│       │   └── components/         # UI components
│       │       ├── charts/
│       │       ├── search/
│       │       └── shared/
│       ├── tests/
│       │   ├── unit/
│       │   └── e2e/
│       ├── static/
│       ├── svelte.config.js
│       ├── vite.config.ts
│       └── package.json
│
├── workers/
│   └── auth/                       # Cloudflare Worker — auth proxy only
│       ├── src/
│       │   └── index.ts
│       ├── wrangler.toml
│       └── package.json
│
├── .env.example                    # Canonical env var reference (see below)
├── package.json                    # Workspace root
└── PROJECT.md
```

---

## Environment Variables

### `.env.example` — canonical reference

```dotenv
# ── Spotify Application ──────────────────────────────────────────
# Create an app at https://developer.spotify.com/dashboard
SPOTIFY_CLIENT_ID=your_spotify_client_id_here

# NEVER put the client secret in the frontend .env or any client-side code.
# It belongs only in the Cloudflare Worker secret store (see Deployment section).
# For local dev, the PKCE flow does not require the client secret in the browser.
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here   # Worker/server only

# ── Redirect URIs ────────────────────────────────────────────────
# Local development
SPOTIFY_REDIRECT_URI_LOCAL=http://localhost:5173/auth/callback

# Cloudflare Pages production (set this after your Pages project is created)
SPOTIFY_REDIRECT_URI_PROD=https://your-app.pages.dev/auth/callback

# ── Cloudflare Worker ────────────────────────────────────────────
# The base URL of your deployed auth Worker (used by the frontend to call it)
AUTH_WORKER_URL=https://spotify-auth.your-account.workers.dev

# ── App ──────────────────────────────────────────────────────────
# Set to 'local' or 'production'; controls which redirect URI is used
APP_ENV=local
```

### Rules for agents
- `SPOTIFY_CLIENT_ID` is safe in the SvelteKit app as a public env var (prefix with `PUBLIC_` per SvelteKit convention: `PUBLIC_SPOTIFY_CLIENT_ID`).
- `SPOTIFY_CLIENT_SECRET` must **never** appear in frontend code, frontend `.env`, or be committed to source control. It is stored only as a Cloudflare Worker secret.
- `AUTH_WORKER_URL` is used by the frontend to reach the Worker during the token exchange step. It is a public value.

---

## Authentication — Full Detail

### Flow: Spotify OAuth 2.0 with PKCE

PKCE (Proof Key for Code Exchange) is the correct flow for public clients (SPAs) because it does not require the client secret in the browser. The Cloudflare Worker's role is **not** to hold secrets for the PKCE flow itself — PKCE is secret-free by design. The Worker's role is to handle the **authorization code → token exchange** on behalf of the frontend, keeping `SPOTIFY_CLIENT_SECRET` out of the browser entirely.

> Note: Spotify's token endpoint requires the client secret even for PKCE exchanges. This is why a backend proxy is needed despite using PKCE.

#### Step-by-step

1. **User clicks "Connect Spotify"** in the SvelteKit app.
2. **Frontend generates PKCE pair:** a cryptographically random `code_verifier` (stored in `sessionStorage`) and its SHA-256 `code_challenge`.
3. **Frontend redirects** the browser to `https://accounts.spotify.com/authorize` with:
   - `client_id`
   - `response_type=code`
   - `redirect_uri` (must exactly match one registered in the Spotify dashboard)
   - `code_challenge` and `code_challenge_method=S256`
   - `scope` (see below)
   - `state` (random nonce stored in `sessionStorage` for CSRF protection)
4. **Spotify redirects back** to `/auth/callback?code=...&state=...`
5. **Frontend callback page** validates `state`, retrieves `code_verifier` from `sessionStorage`, then **POSTs to the Cloudflare Worker** with `{ code, code_verifier, redirect_uri }`.
6. **Cloudflare Worker** exchanges the code with Spotify's token endpoint using `client_id` + `client_secret` (held as a Worker secret). Returns `{ access_token, refresh_token, expires_in }` to the frontend.
7. **Frontend stores tokens** in memory (Svelte store) for the session. `refresh_token` may be stored in `localStorage` to survive page reloads, but must be clearly documented as a deliberate choice.
8. **Token refresh:** When `access_token` is within 60 seconds of expiry, the frontend POSTs `{ refresh_token }` to the Worker's `/refresh` endpoint. Worker calls Spotify and returns a new access token.

#### Token storage decision

| Token | Storage | Rationale |
|---|---|---|
| `access_token` | Svelte in-memory store | Short-lived (1hr); no persistence needed |
| `refresh_token` | `localStorage` | Enables session persistence across reloads; acceptable risk for a personal-use app; document explicitly |
| `code_verifier` | `sessionStorage` | Must not survive the tab; cleared after exchange |

#### Cloudflare Worker API surface (`workers/auth/`)

| Method | Path | Request body | Response |
|---|---|---|---|
| POST | `/exchange` | `{ code, code_verifier, redirect_uri }` | `{ access_token, refresh_token, expires_in }` |
| POST | `/refresh` | `{ refresh_token }` | `{ access_token, expires_in }` |

The Worker exposes **only these two endpoints**. It does not proxy any Spotify API calls. All other Spotify API calls are made directly from the frontend using the access token.

#### Redirect URI configuration

Both URIs below must be registered in the Spotify Developer Dashboard:
- `http://localhost:5173/auth/callback` — local dev
- `https://your-app.pages.dev/auth/callback` — production

The active redirect URI is selected at runtime based on `APP_ENV`.

#### Required Spotify scopes

```ts
// src/lib/spotify/scopes.ts
export const REQUIRED_SCOPES = [
  'user-read-private',        // User profile
  'user-read-email',          // User email
  'playlist-read-private',    // Private playlists
  'playlist-read-collaborative',
  'user-top-read',            // Top artists/tracks
  'user-read-recently-played',
] as const;
```

Request only these scopes. Do not request write scopes.

---

## Data Schema

Agents must implement this schema exactly. Use SQLite types.

```sql
-- Playlists fetched from Spotify
CREATE TABLE playlists (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  owner        TEXT NOT NULL,
  snapshot_id  TEXT NOT NULL,   -- Use to detect remote changes without full refetch
  image_url    TEXT,
  synced_at    INTEGER NOT NULL  -- Unix epoch ms
);

-- Tracks (deduplicated across playlists)
CREATE TABLE tracks (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  name_lower   TEXT NOT NULL,    -- Normalized lowercase for search
  artist_name  TEXT NOT NULL,
  artist_lower TEXT NOT NULL,    -- Normalized lowercase for search
  album_name   TEXT NOT NULL,
  duration_ms  INTEGER,
  popularity   INTEGER,
  release_date TEXT
);

-- N:M join: which tracks are in which playlists
CREATE TABLE playlist_tracks (
  playlist_id  TEXT NOT NULL REFERENCES playlists(id),
  track_id     TEXT NOT NULL REFERENCES tracks(id),
  added_at     INTEGER,          -- Unix epoch ms
  position     INTEGER,
  PRIMARY KEY (playlist_id, track_id)
);

-- App-side recent play log (for local historical analytics)
CREATE TABLE recent_plays (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id     TEXT NOT NULL REFERENCES tracks(id),
  played_at    INTEGER NOT NULL  -- Unix epoch ms
);

-- Required indexes for search performance
CREATE INDEX idx_tracks_name_lower   ON tracks(name_lower);
CREATE INDEX idx_tracks_artist_lower ON tracks(artist_lower);
CREATE INDEX idx_playlist_tracks_track ON playlist_tracks(track_id);
CREATE INDEX idx_recent_plays_played_at ON recent_plays(played_at);
```

### Schema rules for agents
- Lowercase-normalized columns (`name_lower`, `artist_lower`) are populated at insert time and used for all search queries. Never do `LOWER()` in a query without the index.
- `snapshot_id` on playlists enables incremental sync: skip a playlist's tracks if its `snapshot_id` is unchanged since last sync.
- `recent_plays` is app-managed only. Do not conflate it with Spotify's recently-played API response, which is limited to 50 items.

---

## Problem

*(same as original — retained above)*

---

## Users

### Primary user
A single Spotify user exploring their own playlists and listening behavior.

### Assumptions
- Initial version is single-user
- User authenticates with their own Spotify account
- App is not a public social product in v1

---

## Core Behaviors

### 1. High-Performance Library Search
- **Global Index:** Index all tracks across all playlists into the local SQLite table.
- **Query Capabilities:** Instant search by Track, Artist, or Album. Filter playlists containing specific tracks. Identify "Orphaned Tracks" (saved songs present in zero playlists).
- **Command Palette:** Implement a `CMD+K` interface for rapid navigation and search.

### 2. Analytics & Visualizations
- **Standard Metrics:** Top artists, tracks, and albums across Spotify-supported time ranges.
- **Advanced Local Analytics:**
  - **Playlist Overlap:** Matrix visualization showing track commonality between selected playlists.
  - **Genre Distribution:** Tree-map or pie chart of genres within specific playlists.
  - **Era Heatmap:** Histogram of track release years to visualize the "age" of a playlist.
- **Visualization Engine:** LayerChart (Svelte + D3). Use its built-in chart types. Drop to raw D3 only if a needed chart type is not provided.

### 3. Application Experience
- **Zero-Latency UI:** Once the local DB is synced, search and filtering should be instantaneous.
- **Sync States:** Clear visual indicators of "Last Synced" and background ingestion progress.
- **Cloudflare Deployment:** Static frontend on Pages; auth proxy on Workers.

---

## Must-have

### Authentication and Spotify integration
- Authenticate with Spotify via PKCE OAuth (see Auth section)
- Request only the scopes listed in `scopes.ts`
- Support local development callback and deployed callback via `APP_ENV`
- Store tokens per the token storage table above
- Never expose `SPOTIFY_CLIENT_SECRET` in browser code
- Refresh tokens proactively before expiry

### Playlist search
- Fetch the current user's playlists and store in local SQLite
- Use `snapshot_id` to skip unchanged playlists during sync
- Search across playlist contents by: exact track name, partial track title, artist name, album name
- Return matching playlists with: playlist name, owner, match type, matched track title, matched artist, link to playlist
- Support fast repeat searches without refetching (query local DB, not Spotify API)
- Handle pagination for large playlist libraries
- Handle duplicate songs across playlists cleanly (deduplicated in `tracks` table)

### Listening analytics
- Show Spotify-derived listening stats: top tracks, top artists, recently played, top items by time range
- Provide time filters where supported by Spotify API
- If app-side history is implemented via `recent_plays`, support custom date windows over stored data
- Be explicit in UI when data is: live from Spotify / cached locally / historically incomplete

### Visualizations
- Bar chart for top artists/tracks
- Line chart for activity over time
- Pie or donut chart for categorical share
- Histogram for track release year distribution
- Allow chart configuration: chart type, metric, grouping dimension, date range, sorting, top N
- Every chart must have: title, clear axis labels, empty/error state, tooltip on hover

### Application experience
- Run as a local SPA during development (`npm run dev`)
- Deployable via `npm run deploy` or equivalent (Pages + Worker)
- Responsive, fast UI
- Robust for users with many playlists
- Clean loading, empty, and error states throughout

### Testing and quality
*(See required test cases below)*

---

## Required Test Cases

Agents must implement passing tests for all of the following before a phase is considered complete.

### Phase 1 — Auth & Foundation
- [ ] PKCE `code_verifier` / `code_challenge` pair is generated correctly (known-vector test)
- [ ] `state` nonce is validated on callback; mismatched state throws
- [ ] Token exchange calls the Worker `/exchange` endpoint with correct payload
- [ ] Token refresh is triggered when access token is within 60 seconds of expiry
- [ ] Token refresh retries on 401 from Spotify API exactly once, then fails cleanly
- [ ] `wa-sqlite` + OPFS initializes without error and schema migrations run idempotently

### Phase 2 — Playlist Search
- [ ] Partial artist name match returns all playlists containing any track by that artist
- [ ] Case-insensitive track name search returns correct results
- [ ] Combined track + artist search narrows results correctly
- [ ] A track present in multiple playlists appears in all matching results (not deduplicated in results)
- [ ] `snapshot_id` sync skip: a playlist with unchanged `snapshot_id` is not re-fetched from Spotify
- [ ] Pagination: a library with >50 playlists (mocked) is fully indexed
- [ ] Empty search input returns no results (not all playlists)

### Phase 3 — Analytics
- [ ] Top artists transform correctly ranks by play count from local data
- [ ] Time range filter correctly restricts analytics to the specified window
- [ ] `recent_plays` local store correctly rejects entries with invalid `track_id`
- [ ] Chart config transform produces a valid LayerChart-compatible config for each supported chart type
- [ ] Unsupported time ranges are either disabled in UI or labeled clearly — no silent data fabrication

### All phases
- [ ] All Spotify API calls are mocked in unit tests; no live network calls in CI
- [ ] Auth flow E2E test covers: login → callback → token stored → authenticated API call succeeds (Playwright, mocked Spotify)

---

## Data Reality / Important Constraints

The Spotify API does not expose every kind of historical listening data a user might want. The implementation must distinguish:

### Directly feasible from Spotify API
- Current user profile
- Current user playlists and playlist tracks
- Top artists/tracks for Spotify-supported ranges (`short_term`, `medium_term`, `long_term`)
- Recent playback (last 50 items only)

### Not feasible without app-side persistence
- Complete long-term listening history
- Arbitrary historical date slicing
- Exact historical play-count reconstruction over long periods

If richer historical analytics are desired, the app uses the `recent_plays` table to snapshot playback events locally over time. Agents must not assume Spotify alone provides unlimited historical analytics.

---

## User Flows

### Flow 1: Find which playlists contain a song
1. User logs in with Spotify
2. User enters a track title, artist, or both
3. App searches local SQLite index
4. App returns matching playlists and matched tracks
5. User can click through to the playlist in Spotify

### Flow 2: See top artists over time
1. User opens Analytics
2. User chooses metric: Top Artists
3. User chooses time range
4. App shows ranked list and chart
5. User can adjust grouping, top N, and chart type

### Flow 3: Explore recent listening
1. User opens Recent Activity
2. App shows recent plays and summaries
3. User can pivot to track, artist, album, or time-of-day views

---

## Functional Requirements

### Search requirements
- Must support exact and partial text matching via the `name_lower` / `artist_lower` indexed columns
- Must normalize capitalization at insert time, not query time
- Must allow artist-only, track-only, and combined track + artist searches
- Must handle pagination and large playlist libraries efficiently
- Must use local SQLite for all repeat searches — never re-fetch Spotify for a search

### Analytics requirements
- Must define a typed internal metrics layer (`lib/analytics/types.ts`) so UI components never depend on raw Spotify response shapes
- Must separate raw Spotify fetch models from transformed analytic models
- Unsupported metrics must be impossible to reach or clearly labeled in the UI

### Visualization requirements
- Use LayerChart built-in chart types as the default; fall back to raw D3 only when necessary
- Prefer simple, maintainable chart abstractions over one-off bespoke chart code
- Every chart must have: title, clear axis labels, empty/error state, tooltip or hover detail

---

## Cloudflare Deployment

### Architecture

```
Browser (SvelteKit SPA on Cloudflare Pages)
    │
    ├── Direct HTTPS → Spotify API   (all API calls except token exchange)
    │
    └── POST /exchange, POST /refresh → Cloudflare Worker (auth proxy)
                                              │
                                              └── HTTPS → accounts.spotify.com/api/token
```

The Worker is a minimal auth proxy. It holds `SPOTIFY_CLIENT_SECRET` as a Cloudflare secret and exposes exactly two endpoints (`/exchange` and `/refresh`). It proxies nothing else.

### Deployment steps (agents: implement a `deploy` script or README section covering these)

1. **Create Cloudflare Pages project** pointing at `apps/web/` build output.
2. **Create Cloudflare Worker** from `workers/auth/`. Set the following Worker secrets via `wrangler secret put`:
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_CLIENT_ID`
   - `ALLOWED_ORIGIN` (set to your Pages domain to restrict CORS)
3. **Set Pages environment variables:**
   - `PUBLIC_SPOTIFY_CLIENT_ID`
   - `PUBLIC_AUTH_WORKER_URL` (the deployed Worker URL)
   - `PUBLIC_SPOTIFY_REDIRECT_URI` (the Pages callback URL)
4. **Register both redirect URIs** (local + Pages) in the Spotify Developer Dashboard.
5. **Deploy Worker** via `wrangler deploy` from `workers/auth/`.
6. **Deploy frontend** via Cloudflare Pages CI or `wrangler pages deploy`.

### Worker CORS policy
The Worker must only accept requests from the registered Pages origin (set via `ALLOWED_ORIGIN` secret). Reject all other origins with `403`.

### `wrangler.toml` skeleton (agents: expand as needed)
```toml
name = "spotify-auth"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
# Non-secret config here; secrets via `wrangler secret put`
```

---

## Performance Expectations
- Search must feel instantaneous after initial sync (target: <50ms query time in SQLite)
- Avoid repeated full refetches of playlist contents on every search
- Use `snapshot_id` comparison to skip unchanged playlists during sync
- Use incremental loading and memoized transforms where useful
- Support users with large playlist collections (100+ playlists) without UI freezing

---

## Security / Privacy
- `SPOTIFY_CLIENT_SECRET` lives only in the Cloudflare Worker secret store — never in frontend code, never in `.env` committed to source control
- `refresh_token` stored in `localStorage` is a deliberate, documented tradeoff for a personal-use app; it must be cleared on logout
- OPFS data is sandboxed to the app's origin by the browser; no cross-origin access is possible
- On logout: clear all tokens from memory and `localStorage`, and optionally wipe the OPFS database
- Do not collect unnecessary personal data; do not log user data in Worker

---

## Constraints
- **Language:** TypeScript throughout
- **Deployment:** local dev + Cloudflare Pages/Workers
- **UX:** polished, responsive, low-friction
- **Visualization:** LayerChart first; raw D3 only as fallback
- **Testing:** all required test cases must pass; CI must not make live Spotify calls
- **Scope discipline:** v1 prioritizes reliability and usefulness over configurability

---

## Non-goals
- Building a full Spotify replacement
- Social or multi-user collaboration features
- Editing playlists in v1
- A fully general-purpose BI/dashboard builder
- Supporting non-Spotify music services in v1
- Perfect historical analytics beyond what Spotify or app-side persistence actually makes possible

---

## Nice-to-have
- Fuzzy matching with ranking and typo tolerance
- Saved searches and deep-linkable search state
- Export chart data to CSV or JSON
- Playlist overlap analysis and playlist comparison
- Detect tracks present in zero playlists ("orphaned tracks")
- Dark mode
- Background ingestion of listening snapshots for richer historical analytics
- Simple natural-language query interface for common questions

---

## Milestones

### Phase 1 — Foundation
- Auth flow (PKCE + Cloudflare Worker)
- Spotify API client (typed, mocked for tests)
- `wa-sqlite` + OPFS setup and schema migrations
- Basic SPA shell with routing

### Phase 2 — Playlist Search
- Playlist fetch, pagination, and `snapshot_id`-aware sync
- Local SQLite indexing of all playlist tracks
- Search UI and domain logic
- Result rendering with playlist links
- Phase 2 tests passing

### Phase 3 — Analytics
- Top tracks/artists views with time range support
- Recent listening views
- Core charts via LayerChart
- `recent_plays` local store
- Phase 3 tests passing

### Phase 4 — Deployment
- Cloudflare Worker deployment and CORS hardening
- Cloudflare Pages deployment
- Production auth configuration and redirect URI wiring
- `deploy` script or README deployment walkthrough
- Monitoring / error handling
- Final polish
