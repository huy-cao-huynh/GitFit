-- Adds 'bodyweight' to the goals.metric CHECK constraint (Weigh In goal,
-- deriving weekly progress from the count of logged bodyweight entries).
-- Also folds in 'steps', which the app has supported since a later phase but
-- the 0006 constraint never picked up — steps goals were silently failing to
-- write to Supabase.
--
-- Apply by pasting this whole file into the Supabase dashboard SQL Editor and
-- running it once.

alter table public.goals drop constraint if exists goals_metric_check;

alter table public.goals
  add constraint goals_metric_check
  check (metric in ('workouts', 'calories', 'cardio', 'water', 'steps', 'bodyweight', 'manual'));
