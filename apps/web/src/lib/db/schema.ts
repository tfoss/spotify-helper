/**
 * Database schema definition for spotify-helper.
 *
 * The schema is exported as typed constants with a version number so the
 * migration system can track which version has been applied.
 */

/** Current schema version. Bump when adding new migrations. */
export const SCHEMA_VERSION = 1;

/** Name of the SQLite database file stored in OPFS. */
export const DB_NAME = 'spotify-helper.db';

// ---------------------------------------------------------------------------
// Individual CREATE statements — kept separate for readability and reuse
// ---------------------------------------------------------------------------

export const CREATE_PLAYLISTS = `
CREATE TABLE IF NOT EXISTS playlists (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  owner        TEXT NOT NULL,
  snapshot_id  TEXT NOT NULL,
  image_url    TEXT,
  synced_at    INTEGER NOT NULL
);`;

export const CREATE_TRACKS = `
CREATE TABLE IF NOT EXISTS tracks (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  name_lower   TEXT NOT NULL,
  artist_name  TEXT NOT NULL,
  artist_lower TEXT NOT NULL,
  album_name   TEXT NOT NULL,
  duration_ms  INTEGER,
  popularity   INTEGER,
  release_date TEXT
);`;

export const CREATE_PLAYLIST_TRACKS = `
CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id  TEXT NOT NULL REFERENCES playlists(id),
  track_id     TEXT NOT NULL REFERENCES tracks(id),
  added_at     INTEGER,
  position     INTEGER,
  PRIMARY KEY (playlist_id, track_id)
);`;

export const CREATE_RECENT_PLAYS = `
CREATE TABLE IF NOT EXISTS recent_plays (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id     TEXT NOT NULL REFERENCES tracks(id),
  played_at    INTEGER NOT NULL
);`;

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

export const CREATE_IDX_TRACKS_NAME_LOWER = `
CREATE INDEX IF NOT EXISTS idx_tracks_name_lower ON tracks(name_lower);`;

export const CREATE_IDX_TRACKS_ARTIST_LOWER = `
CREATE INDEX IF NOT EXISTS idx_tracks_artist_lower ON tracks(artist_lower);`;

export const CREATE_IDX_PLAYLIST_TRACKS_TRACK = `
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);`;

export const CREATE_IDX_RECENT_PLAYS_PLAYED_AT = `
CREATE INDEX IF NOT EXISTS idx_recent_plays_played_at ON recent_plays(played_at);`;

// ---------------------------------------------------------------------------
// Aggregated schema — all statements in application order
// ---------------------------------------------------------------------------

/** All DDL statements for schema version 1, in order. */
export const SCHEMA_V1_STATEMENTS: readonly string[] = [
  CREATE_PLAYLISTS,
  CREATE_TRACKS,
  CREATE_PLAYLIST_TRACKS,
  CREATE_RECENT_PLAYS,
  CREATE_IDX_TRACKS_NAME_LOWER,
  CREATE_IDX_TRACKS_ARTIST_LOWER,
  CREATE_IDX_PLAYLIST_TRACKS_TRACK,
  CREATE_IDX_RECENT_PLAYS_PLAYED_AT,
] as const;
