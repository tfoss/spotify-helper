/**
 * Typed query helpers for the spotify-helper database.
 *
 * Every function is pure — it takes a `DbExecutor` as its first argument
 * rather than depending on a global connection. This makes the helpers
 * composable, testable, and safe to call from any context.
 *
 * Lowercase normalisation happens at insert/upsert time so that queries
 * can compare directly against stored lowercase columns.
 */

import type {
  DbExecutor,
  PlaylistRow,
  PlaylistTrackRow,
  RecentPlayRow,
  TrackRow,
} from './types.js';

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

/**
 * Insert or update a playlist.
 *
 * @param exec     - Database executor.
 * @param playlist - Playlist data (all fields except auto-generated ones).
 */
export async function upsertPlaylist(
  exec: DbExecutor,
  playlist: PlaylistRow,
): Promise<void> {
  const sql = `
    INSERT INTO playlists (id, name, owner, snapshot_id, image_url, synced_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name        = excluded.name,
      owner       = excluded.owner,
      snapshot_id = excluded.snapshot_id,
      image_url   = excluded.image_url,
      synced_at   = excluded.synced_at;`;

  await exec(sql, [
    playlist.id,
    playlist.name,
    playlist.owner,
    playlist.snapshot_id,
    playlist.image_url,
    playlist.synced_at,
  ]);
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

/**
 * Insert or update a track.
 *
 * `name_lower` and `artist_lower` are derived automatically at insert time
 * from `name` and `artist_name` respectively.
 *
 * @param exec  - Database executor.
 * @param track - Track data. `name_lower` and `artist_lower` are optional;
 *                they will be computed if not provided.
 */
export async function upsertTrack(
  exec: DbExecutor,
  track: Omit<TrackRow, 'name_lower' | 'artist_lower'>,
): Promise<void> {
  const nameLower = track.name.toLowerCase();
  const artistLower = track.artist_name.toLowerCase();

  const sql = `
    INSERT INTO tracks
      (id, name, name_lower, artist_name, artist_lower, artist_id, album_name,
       duration_ms, popularity, release_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name         = excluded.name,
      name_lower   = excluded.name_lower,
      artist_name  = excluded.artist_name,
      artist_lower = excluded.artist_lower,
      artist_id    = excluded.artist_id,
      album_name   = excluded.album_name,
      duration_ms  = excluded.duration_ms,
      popularity   = excluded.popularity,
      release_date = excluded.release_date;`;

  await exec(sql, [
    track.id,
    track.name,
    nameLower,
    track.artist_name,
    artistLower,
    track.artist_id ?? null,
    track.album_name,
    track.duration_ms ?? null,
    track.popularity ?? null,
    track.release_date ?? null,
  ]);
}

// ---------------------------------------------------------------------------
// Playlist <-> Track links
// ---------------------------------------------------------------------------

/**
 * Link a track to a playlist (or update the link metadata).
 *
 * @param exec       - Database executor.
 * @param playlistId - Playlist ID.
 * @param trackId    - Track ID.
 * @param addedAt    - Unix timestamp (ms) when the track was added.
 * @param position   - Position in the playlist.
 */
export async function linkPlaylistTrack(
  exec: DbExecutor,
  playlistId: string,
  trackId: string,
  addedAt: number | null,
  position: number | null,
): Promise<void> {
  const sql = `
    INSERT INTO playlist_tracks (playlist_id, track_id, added_at, position)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(playlist_id, track_id) DO UPDATE SET
      added_at = excluded.added_at,
      position = excluded.position;`;

  await exec(sql, [playlistId, trackId, addedAt, position]);
}

// ---------------------------------------------------------------------------
// Search helpers
// ---------------------------------------------------------------------------

/**
 * Case-insensitive search for tracks by name.
 *
 * Compares against the pre-computed `name_lower` column using LIKE,
 * so no runtime lowercasing is needed.
 *
 * @param exec  - Database executor.
 * @param query - Search string (will be lowercased and wrapped in `%`).
 * @returns Matching track rows.
 */
export async function searchTracksByName(
  exec: DbExecutor,
  query: string,
): Promise<TrackRow[]> {
  const sql = `SELECT * FROM tracks WHERE name_lower LIKE ? ORDER BY name_lower;`;
  const pattern = `%${query.toLowerCase()}%`;
  const rows = await exec(sql, [pattern]);
  return rows as unknown as TrackRow[];
}

/**
 * Case-insensitive search for tracks by artist name.
 *
 * @param exec  - Database executor.
 * @param query - Search string (will be lowercased and wrapped in `%`).
 * @returns Matching track rows.
 */
export async function searchTracksByArtist(
  exec: DbExecutor,
  query: string,
): Promise<TrackRow[]> {
  const sql = `SELECT * FROM tracks WHERE artist_lower LIKE ? ORDER BY artist_lower;`;
  const pattern = `%${query.toLowerCase()}%`;
  const rows = await exec(sql, [pattern]);
  return rows as unknown as TrackRow[];
}

// ---------------------------------------------------------------------------
// Playlist lookups
// ---------------------------------------------------------------------------

/**
 * Get all playlists that contain a given track.
 *
 * @param exec    - Database executor.
 * @param trackId - Track ID to look up.
 * @returns Playlist rows that include the track.
 */
export async function getPlaylistsForTrack(
  exec: DbExecutor,
  trackId: string,
): Promise<PlaylistRow[]> {
  const sql = `
    SELECT p.*
    FROM playlists p
    INNER JOIN playlist_tracks pt ON pt.playlist_id = p.id
    WHERE pt.track_id = ?
    ORDER BY p.name;`;

  const rows = await exec(sql, [trackId]);
  return rows as unknown as PlaylistRow[];
}

// ---------------------------------------------------------------------------
// Recent plays
// ---------------------------------------------------------------------------

/**
 * Record a recent play event.
 *
 * @param exec     - Database executor.
 * @param trackId  - ID of the track that was played.
 * @param playedAt - Unix timestamp (ms) of the play event.
 */
export async function addRecentPlay(
  exec: DbExecutor,
  trackId: string,
  playedAt: number,
): Promise<void> {
  const sql = `INSERT INTO recent_plays (track_id, played_at) VALUES (?, ?);`;
  await exec(sql, [trackId, playedAt]);
}

/**
 * Retrieve recent plays, optionally filtered by a minimum timestamp.
 *
 * @param exec  - Database executor.
 * @param since - Only return plays after this Unix timestamp (ms). Defaults to 0.
 * @param limit - Maximum number of rows to return. Defaults to 50.
 * @returns Recent play rows joined with track data, newest first.
 */
export async function getRecentPlays(
  exec: DbExecutor,
  since: number = 0,
  limit: number = 50,
): Promise<RecentPlayRow[]> {
  const sql = `
    SELECT * FROM recent_plays
    WHERE played_at > ?
    ORDER BY played_at DESC
    LIMIT ?;`;

  const rows = await exec(sql, [since, limit]);
  return rows as unknown as RecentPlayRow[];
}

// ---------------------------------------------------------------------------
// Recent plays with track details (JOIN)
// ---------------------------------------------------------------------------

/** A recent play row enriched with track metadata. */
export interface RecentPlayWithTrack {
  id: number;
  track_id: string;
  played_at: number;
  track_name: string;
  artist_name: string;
  album_name: string;
}

/**
 * Retrieve recent plays joined with track metadata.
 *
 * @param exec  - Database executor.
 * @param since - Only return plays after this Unix timestamp (ms). Defaults to 0.
 * @param limit - Maximum number of rows to return. Defaults to 100.
 * @returns Recent play rows with track details, newest first.
 */
export async function getRecentPlaysWithTracks(
  exec: DbExecutor,
  since: number = 0,
  limit: number = 100,
): Promise<RecentPlayWithTrack[]> {
  const sql = `
    SELECT rp.id, rp.track_id, rp.played_at,
           t.name AS track_name, t.artist_name, t.album_name
    FROM recent_plays rp
    INNER JOIN tracks t ON t.id = rp.track_id
    WHERE rp.played_at > ?
    ORDER BY rp.played_at DESC
    LIMIT ?;`;

  const rows = await exec(sql, [since, limit]);
  return rows as unknown as RecentPlayWithTrack[];
}

/**
 * Count plays per artist from the local recent_plays table within a time window.
 *
 * @param exec  - Database executor.
 * @param since - Only count plays after this Unix timestamp (ms).
 * @returns Array of { artist_name, play_count } sorted by play_count descending.
 */
export async function countPlaysByArtist(
  exec: DbExecutor,
  since: number = 0,
): Promise<{ artist_name: string; play_count: number }[]> {
  const sql = `
    SELECT t.artist_name, COUNT(*) AS play_count
    FROM recent_plays rp
    INNER JOIN tracks t ON t.id = rp.track_id
    WHERE rp.played_at > ?
    GROUP BY t.artist_name
    ORDER BY play_count DESC;`;

  const rows = await exec(sql, [since]);
  return rows as unknown as { artist_name: string; play_count: number }[];
}

/**
 * Count plays per hour-of-day from the local recent_plays table.
 *
 * Uses SQLite datetime functions to extract the hour from the played_at
 * timestamp (stored as Unix ms).
 *
 * @param exec  - Database executor.
 * @param since - Only count plays after this Unix timestamp (ms).
 * @returns Array of { hour, play_count } for hours that have plays.
 */
export async function countPlaysByHour(
  exec: DbExecutor,
  since: number = 0,
): Promise<{ hour: number; play_count: number }[]> {
  const sql = `
    SELECT CAST(strftime('%H', played_at / 1000, 'unixepoch', 'localtime') AS INTEGER) AS hour,
           COUNT(*) AS play_count
    FROM recent_plays
    WHERE played_at > ?
    GROUP BY hour
    ORDER BY hour;`;

  const rows = await exec(sql, [since]);
  return rows as unknown as { hour: number; play_count: number }[];
}

// ---------------------------------------------------------------------------
// Orphaned tracks
// ---------------------------------------------------------------------------

/** A track that is not linked to any playlist. */
export interface OrphanedTrack {
  id: string;
  name: string;
  artist_name: string;
  album_name: string;
}

/**
 * Return all tracks that have no row in `playlist_tracks`.
 *
 * These are tracks that were synced (e.g. from recent plays) but are not
 * part of any saved playlist.
 *
 * @param exec - Database executor.
 * @returns Orphaned track rows sorted by name.
 */
export async function getOrphanedTracks(exec: DbExecutor): Promise<OrphanedTrack[]> {
  const sql = `
    SELECT t.id, t.name, t.artist_name, t.album_name
    FROM tracks t
    LEFT JOIN playlist_tracks pt ON pt.track_id = t.id
    WHERE pt.track_id IS NULL
    ORDER BY t.name_lower;`;

  const rows = await exec(sql, []);
  return rows as unknown as OrphanedTrack[];
}
