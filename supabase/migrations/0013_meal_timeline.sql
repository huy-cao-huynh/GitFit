-- Food timeline: foods are grouped into timed meal events instead of the four
-- fixed meal categories, and water entries carry the time they were drunk.
--
-- BEFORE RUNNING: set `tz` in the backfill block below to your IANA timezone
-- (e.g. 'America/Los_Angeles'). Supabase runs in UTC, and existing logs are
-- placed at default local clock times per old meal (breakfast 08:00, lunch
-- 12:30, snack 15:30, dinner 18:30).
--
-- Apply by pasting this whole file into the Supabase dashboard SQL Editor and
-- running it once.

-- ---------------------------------------------------------------------------
-- meal_events: one row per moment on the timeline; food_logs hang off it.
-- ---------------------------------------------------------------------------
create table public.meal_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  logged_at timestamptz not null,
  title text,
  created_at timestamptz not null default now()
);

create index meal_events_user_date_idx on public.meal_events (user_id, date desc);

alter table public.food_logs
  add column event_id uuid references public.meal_events (id) on delete cascade;

-- `meal` is kept for rollback/legacy reads; new rows don't write it.
alter table public.food_logs alter column meal drop not null;

create index food_logs_event_idx on public.food_logs (event_id);

-- ---------------------------------------------------------------------------
-- water_entries: when the water was logged. Existing rows use created_at.
-- ---------------------------------------------------------------------------
alter table public.water_entries
  add column logged_at timestamptz not null default now();

update public.water_entries set logged_at = created_at;

-- ---------------------------------------------------------------------------
-- Backfill: one event per existing (user, date, meal) group.
-- ---------------------------------------------------------------------------
do $$
declare
  tz text := 'America/Los_Angeles'; -- EDIT ME
  g record;
  new_id uuid;
begin
  for g in
    select user_id, date, meal
    from public.food_logs
    where event_id is null
    group by user_id, date, meal
  loop
    new_id := gen_random_uuid();
    insert into public.meal_events (id, user_id, date, logged_at, title)
    values (
      new_id,
      g.user_id,
      g.date,
      (g.date + case g.meal
        when 'breakfast' then time '08:00'
        when 'lunch' then time '12:30'
        when 'dinner' then time '18:30'
        else time '15:30'
      end) at time zone tz,
      case g.meal
        when 'breakfast' then 'Breakfast'
        when 'lunch' then 'Lunch'
        when 'dinner' then 'Dinner'
        else 'Snacks'
      end
    );
    update public.food_logs
    set event_id = new_id
    where user_id = g.user_id and date = g.date and meal is not distinct from g.meal and event_id is null;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security (same pattern as 0001/0005).
-- ---------------------------------------------------------------------------
alter table public.meal_events enable row level security;
create policy "own rows select" on public.meal_events for select using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.meal_events for insert with check ((select auth.uid()) = user_id);
create policy "own rows update" on public.meal_events for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows delete" on public.meal_events for delete using ((select auth.uid()) = user_id);
