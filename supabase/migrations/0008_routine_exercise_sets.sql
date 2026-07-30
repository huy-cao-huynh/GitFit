-- Per-set routine editing: replace routine_exercises' uniform "N sets of one
-- target" fields with a child table of independently-editable sets, so
-- pyramid sets (different weight per set) are possible. Mirrors the existing
-- session_sets shape used for logged sets. The warm-up/working rest split
-- collapses into a single rest_sec per exercise.
--
-- Apply by pasting this whole file into the Supabase dashboard SQL Editor and
-- running it once.

alter table public.routine_exercises
  add column rest_sec integer;

create table public.routine_exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_exercise_id uuid not null references public.routine_exercises (id) on delete cascade,
  position integer not null default 0,
  is_warmup boolean not null default false,
  reps smallint,
  weight numeric,
  duration_sec integer
);

create index routine_exercise_sets_user_idx on public.routine_exercise_sets (user_id);
create index routine_exercise_sets_exercise_idx on public.routine_exercise_sets (routine_exercise_id, position);

-- ---------------------------------------------------------------------------
-- Backfill: expand each routine_exercises row's flat "warmup_sets of one
-- target, sets of one target" shape into individual routine_exercise_sets
-- rows, then collapse target_rest_sec/warmup_rest_sec into one rest_sec.
-- ---------------------------------------------------------------------------
insert into public.routine_exercise_sets (user_id, routine_exercise_id, position, is_warmup, reps, weight, duration_sec)
select
  re.user_id,
  re.id,
  gs.i - 1,
  true,
  re.warmup_target_reps,
  re.warmup_target_weight,
  re.warmup_target_duration_sec
from public.routine_exercises re
cross join lateral generate_series(1, coalesce(re.warmup_sets, 0)) as gs(i);

insert into public.routine_exercise_sets (user_id, routine_exercise_id, position, is_warmup, reps, weight, duration_sec)
select
  re.user_id,
  re.id,
  coalesce(re.warmup_sets, 0) + gs.i - 1,
  false,
  re.target_reps,
  re.target_weight,
  re.target_duration_sec
from public.routine_exercises re
cross join lateral generate_series(1, greatest(re.sets, 0)) as gs(i);

update public.routine_exercises
set rest_sec = coalesce(target_rest_sec, warmup_rest_sec, 60);

alter table public.routine_exercises
  drop column sets,
  drop column target_reps,
  drop column target_weight,
  drop column target_duration_sec,
  drop column target_rest_sec,
  drop column warmup_sets,
  drop column warmup_target_reps,
  drop column warmup_target_weight,
  drop column warmup_target_duration_sec,
  drop column warmup_rest_sec;

-- ---------------------------------------------------------------------------
-- Row Level Security (same pattern as 0001; the loop there doesn't cover
-- tables added later, so repeat it here).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'routine_exercise_sets'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows select" on public.%I for select using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows insert" on public.%I for insert with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows update" on public.%I for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows delete" on public.%I for delete using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;
