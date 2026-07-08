-- MyGymApp initial schema: per-user tables mirroring src/lib/store/types.ts,
-- with RLS so each user can only touch their own rows.
--
-- Apply by pasting this whole file into the Supabase dashboard SQL Editor and
-- running it once. Idempotent-ish: assumes a fresh project (no gymapp tables).

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user; absorbs the Preferences store slice.
-- Display name & birthday stay in auth.users.user_metadata (managed by the app).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  unit_system text not null default 'imperial' check (unit_system in ('imperial', 'metric')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row for every new signup.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- routines + routine_exercises (exercises are per-routine, no global catalog)
-- ---------------------------------------------------------------------------
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (category in ('strength', 'cardio')),
  name text not null,
  level text not null default '',
  duration_minutes integer not null default 0,
  tile_color text not null default '',
  -- Scheduled weekdays, Monday = 1 through Sunday = 7. Null/empty = unscheduled.
  scheduled_days smallint[],
  -- Cardio only.
  activity_type text check (activity_type in ('walk', 'run', 'hike', 'swim', 'cycle', 'sport', 'other')),
  target_distance_miles numeric,
  created_at timestamptz not null default now()
);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  position integer not null default 0,
  name text not null,
  kind text not null default 'reps' check (kind in ('reps', 'time')),
  sets smallint not null default 3,
  target_reps smallint not null default 0,
  target_weight numeric not null default 0,
  target_duration_sec integer,
  -- "Last time" snapshot shown while building/starting a workout.
  last_reps smallint,
  last_weight numeric,
  last_duration_sec integer,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Completed strength sessions: sessions -> session_exercises -> session_sets
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id uuid references public.routines (id) on delete set null,
  routine_name text not null,
  date date not null,
  duration_minutes integer not null default 0,
  calories integer,
  created_at timestamptz not null default now()
);

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  position integer not null default 0,
  -- Snapshot of the routine-exercise id at logging time (text: not a FK, the
  -- routine exercise may be edited or deleted later).
  exercise_id text not null default '',
  name text not null
);

create table public.session_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_exercise_id uuid not null references public.session_exercises (id) on delete cascade,
  position integer not null default 0,
  kind text check (kind in ('reps', 'time')),
  reps smallint,
  weight numeric,
  duration_sec integer,
  skipped boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Completed cardio sessions (flat, no child rows)
-- ---------------------------------------------------------------------------
create table public.cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id uuid references public.routines (id) on delete set null,
  name text not null,
  activity_type text not null check (activity_type in ('walk', 'run', 'hike', 'swim', 'cycle', 'sport', 'other')),
  date date not null,
  minutes integer not null default 0,
  distance_miles numeric,
  calories integer,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Weekly goals: one row per active goal slot; GoalDef.id === type in the app.
-- ---------------------------------------------------------------------------
create table public.goals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('workouts', 'calories', 'cardio', 'water')),
  label text not null,
  target numeric not null,
  unit text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, type)
);

-- ---------------------------------------------------------------------------
-- Daily check-offs: definitions + one log row per (day, def) checked.
-- ---------------------------------------------------------------------------
create table public.checkoff_defs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.checkoff_log (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  checkoff_def_id uuid not null references public.checkoff_defs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, date, checkoff_def_id)
);

-- ---------------------------------------------------------------------------
-- Health tracking series
-- ---------------------------------------------------------------------------
create table public.bodyweight_entries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  weight numeric not null,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- Empty until HealthKit lands; the Progress Steps chart reads this series.
create table public.steps_entries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  steps integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  ounces numeric not null,
  created_at timestamptz not null default now()
);

create table public.measurement_defs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null,
  unit text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- label/unit are snapshots (not FKs) so history survives def edits/deletes,
-- matching the local store shape.
create table public.measurement_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  label text not null,
  value numeric not null,
  unit text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index routines_user_idx on public.routines (user_id);
create index routine_exercises_user_idx on public.routine_exercises (user_id);
create index routine_exercises_routine_idx on public.routine_exercises (routine_id, position);
create index sessions_user_date_idx on public.sessions (user_id, date desc);
create index session_exercises_user_idx on public.session_exercises (user_id);
create index session_exercises_session_idx on public.session_exercises (session_id, position);
create index session_sets_user_idx on public.session_sets (user_id);
create index session_sets_exercise_idx on public.session_sets (session_exercise_id, position);
create index cardio_sessions_user_date_idx on public.cardio_sessions (user_id, date desc);
create index checkoff_defs_user_idx on public.checkoff_defs (user_id, position);
create index water_entries_user_date_idx on public.water_entries (user_id, date desc);
create index measurement_defs_user_idx on public.measurement_defs (user_id, position);
create index measurement_entries_user_date_idx on public.measurement_entries (user_id, date desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: users can only select/insert/update/delete their own rows.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'routines',
    'routine_exercises',
    'sessions',
    'session_exercises',
    'session_sets',
    'cardio_sessions',
    'goals',
    'checkoff_defs',
    'checkoff_log',
    'bodyweight_entries',
    'steps_entries',
    'water_entries',
    'measurement_defs',
    'measurement_entries'
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

-- profiles keys on id instead of user_id (no delete policy: rows live and die
-- with the auth user via the trigger + cascade).
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using ((select auth.uid()) = id);
create policy "own profile insert" on public.profiles for insert with check ((select auth.uid()) = id);
create policy "own profile update" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Backfill profiles for users who signed up before this migration.
-- ---------------------------------------------------------------------------
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
