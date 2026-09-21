// Minimal, self-contained mirrors of the GitFit domain types this backend
// needs. Edge Functions run on Deno and don't share a module graph with the
// Expo app in src/, so these are intentionally duplicated rather than
// imported across the boundary. Keep in sync with src/lib/store/types.ts by
// hand if either shape changes.

export type CardioActivityType = 'walk' | 'run' | 'hike' | 'swim' | 'cycle' | 'other';

/** One GPS fix recorded during a live-tracked cardio session. */
export interface GpsPoint {
  lat: number;
  lng: number;
  altitude?: number;
  t: number; // ms epoch
  e?: number;
}

/** A completed cardio workout, as stored in cardio_sessions. */
export interface CardioSessionRow {
  id: string;
  routine_id: string | null;
  name: string;
  activity_type: CardioActivityType;
  date: string; // YYYY-MM-DD
  minutes: number;
  distance_miles: number | null;
  calories: number | null;
  route: GpsPoint[] | null;
  elevation_gain_ft: number | null;
  avg_pace_sec_per_mile: number | null;
}

export interface SetLogRow {
  kind?: 'reps' | 'time';
  reps?: number;
  weight?: number;
  duration_sec?: number;
  is_warmup?: boolean;
  skipped?: boolean;
}

export interface SessionExerciseRow {
  exercise_id: string;
  name: string;
  sets: SetLogRow[];
}

/** A completed strength workout, as stored in sessions/session_exercises/session_sets. */
export interface SessionRow {
  id: string;
  routine_id: string | null;
  routine_name: string;
  date: string;
  duration_minutes: number;
  calories: number | null;
  exercises: SessionExerciseRow[];
}

export type StravaActivityDirection = 'import' | 'export';
export type StravaUploadStatus = 'pending' | 'uploaded' | 'failed' | 'synced' | 'unlinked';
export type GitfitActivityType = 'cardio_session' | 'session';

export interface StravaActivityRow {
  id: string;
  user_id: string;
  strava_activity_id: number | null;
  gitfit_activity_type: GitfitActivityType;
  gitfit_activity_id: string;
  direction: StravaActivityDirection;
  external_url: string | null;
  upload_status: StravaUploadStatus;
  upload_error: string | null;
  strava_upload_id: number | null;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
}

export interface StravaConnectionRow {
  id: string;
  user_id: string;
  strava_athlete_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
  connected_at: string;
  updated_at: string;
}

/** Fields Strava returns from GET /activities/{id} that we actually use. */
export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // meters
  start_date: string; // ISO 8601 UTC
  start_date_local: string; // ISO 8601 local
  private: boolean;
  calories?: number;
}

export interface StravaStreamSet {
  latlng?: { data: [number, number][] };
  altitude?: { data: number[] };
  time?: { data: number[] };
}

export interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete';
  object_id: number;
  aspect_type: 'create' | 'update' | 'delete';
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates?: Record<string, string>;
}
