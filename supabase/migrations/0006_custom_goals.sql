-- Custom goals (Phase 4): the goals table loses its fixed 4-type shape.
-- Rows get a uuid primary key, a free label, a `metric` that says how weekly
-- progress is computed ('workouts' | 'calories' | 'cardio' | 'water' are the
-- old built-ins; 'manual' goals are counted from user check-ins), and a
-- position for ordering. goal_entries holds those manual check-ins.
--
-- Apply by pasting this whole file into the Supabase dashboard SQL Editor and
-- running it once. Existing goal rows are carried over (the old `type` becomes
-- both the metric and the ordering).

-- ---------------------------------------------------------------------------
-- Rebuild goals: old PK was (user_id, type) with a CHECK on type.
-- ---------------------------------------------------------------------------
alter table public.goals rename to goals_old;

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  metric text not null default 'manual' check (metric in ('workouts', 'calories', 'cardio', 'water', 'manual')),
  label text not null,
  target numeric not null,
  unit text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.goals (user_id, metric, label, target, unit, position, created_at)
select
  user_id,
  type,
  label,
  target,
  unit,
  case type when 'workouts' then 0 when 'calories' then 1 when 'cardio' then 2 when 'water' then 3 else 4 end,
  created_at
from public.goals_old;

-- Dropping the old table also drops its RLS policies.
drop table public.goals_old;

create index goals_user_idx on public.goals (user_id, position);

-- ---------------------------------------------------------------------------
-- goal_entries: one row per manual check-in on a goal (amount defaults to 1).
-- ---------------------------------------------------------------------------
create table public.goal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  date date not null,
  amount numeric not null default 1,
  created_at timestamptz not null default now()
);

create index goal_entries_user_date_idx on public.goal_entries (user_id, date desc);

-- ---------------------------------------------------------------------------
-- Row Level Security (same pattern as 0001; the loop there doesn't cover
-- tables added later, so repeat it here — goals needs it again after the
-- rebuild).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'goals',
    'goal_entries'
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
