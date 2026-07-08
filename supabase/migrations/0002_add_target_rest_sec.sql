-- Per-exercise rest duration, configurable in the routine editor (previously
-- a hardcoded 30s constant in the active-workout screen).
alter table public.routine_exercises
  add column target_rest_sec integer;
