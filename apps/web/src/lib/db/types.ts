/**
 * TypeScript types for the wa-sqlite database layer.
 *
 * Includes row types for each table, message types for worker
 * communication, and query result types.
 */

// ---------------------------------------------------------------------------
// Row types — one per database table
// ---------------------------------------------------------------------------

/** A Spotify playlist stored locally. */
export interface PlaylistRow {
  id: string;
  name: string;
  owner: string;
  snapshot_id: string;
  image_url: string | null;
  synced_at: number;
}

/** A Spotify track with pre-computed lowercase fields for search. */
export interface TrackRow {
  id: string;
  name: string;
  name_lower: string;
  artist_name: string;
  artist_lower: string;
  album_name: string;
  duration_ms: number | null;
  popularity: number | null;
  release_date: string | null;
}

/** Junction row linking a playlist to a track. */
export interface PlaylistTrackRow {
  playlist_id: string;
  track_id: string;
  added_at: number | null;
  position: number | null;
}

/** A single recent-play entry. */
export interface RecentPlayRow {
  id: number;
  track_id: string;
  played_at: number;
}

/** A genre tag associated with an artist. */
export interface ArtistGenreRow {
  artist_id: string;
  genre: string;
}

/** Internal migration-tracking row. */
export interface MigrationRow {
  version: number;
  applied_at: number;
}

// ---------------------------------------------------------------------------
// Worker message types
// ---------------------------------------------------------------------------

/** Messages sent from the main thread to the worker. */
export type WorkerRequest =
  | WorkerInitRequest
  | WorkerExecRequest
  | WorkerCloseRequest;

export interface WorkerInitRequest {
  type: 'init';
  id: number;
  dbName?: string;
}

export interface WorkerExecRequest {
  type: 'exec';
  id: number;
  sql: string;
  params?: SqlParam[];
}

export interface WorkerCloseRequest {
  type: 'close';
  id: number;
}

/** Primitive types accepted as SQL bind parameters. */
export type SqlParam = string | number | null | Uint8Array;

/** Messages sent from the worker back to the main thread. */
export type WorkerResponse =
  | WorkerSuccessResponse
  | WorkerErrorResponse;

export interface WorkerSuccessResponse {
  type: 'success';
  id: number;
  rows: Record<string, SqlParam>[];
}

export interface WorkerErrorResponse {
  type: 'error';
  id: number;
  error: string;
}

// ---------------------------------------------------------------------------
// Query result helpers
// ---------------------------------------------------------------------------

/**
 * A generic database executor function signature.
 *
 * All query helpers accept an executor rather than importing a global
 * connection, keeping them pure and testable.
 */
export type DbExecutor = (
  sql: string,
  params?: SqlParam[],
) => Promise<Record<string, SqlParam>[]>;
