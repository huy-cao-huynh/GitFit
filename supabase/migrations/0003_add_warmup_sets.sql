-- Separate warm-up targets per routine exercise plus a marker on logged sets.
alter table public.routine_exercises
  add column warmup_sets smallint not null default 0,
  add column warmup_target_reps smallint,
  add column warmup_target_weight numeric,
  add column warmup_target_duration_sec integer,
  add column warmup_rest_sec integer;

alter table public.session_sets
  add column is_warmup boolean not null default false;
