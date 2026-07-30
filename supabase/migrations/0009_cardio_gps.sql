-- GPS tracking for cardio sessions: a single jsonb column holding the whole
-- recorded route as one blob, since it's always read/written as one unit
-- (never queried point-by-point) -- no child table needed. Elevation gain is
-- a client-computed, moving-average-smoothed approximation from GPS altitude
-- samples, NOT barometer data (see src/lib/cardio-tracking.ts). Pace is
-- likewise computed client-side at save time and stored alongside distance
-- for display without recomputing on every read.
--
-- Apply by pasting this whole file into the Supabase dashboard SQL Editor and
-- running it once.

alter table public.cardio_sessions
  add column route jsonb,
  add column elevation_gain_ft numeric,
  add column avg_pace_sec_per_mile numeric;

-- No new RLS needed: these are plain columns on cardio_sessions, which is
-- already covered by the RLS policies from 0001_initial_schema.sql.
