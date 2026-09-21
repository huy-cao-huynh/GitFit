-- Strava integration: OAuth connection storage, transient OAuth CSRF state,
-- and a provider link table mapping GitFit activities to Strava activities
-- in both directions (import from Strava, export to Strava).
--
-- Deliberately does NOT add columns to cardio_sessions/sessions: provenance
-- and sync state live entirely in strava_activities below, so both cardio
-- and strength share one idempotency/provenance mechanism instead of
-- duplicating columns across two tables. The client joins strava_activities
-- against cardioSessions/sessions client-side (see src/lib/store/derive.ts)
-- to render "Imported from Strava" badges.
--
-- Apply by pasting this whole file into the Supabase dashboard SQL Editor and
-- running it once.

-- ---------------------------------------------------------------------------
-- strava_connections: one row per user's Strava OAuth grant. Tokens are
-- secrets, so this table gets ZERO client-facing policies. Enabling RLS with
-- no policies denies every row to every role except the table owner and
-- roles with BYPASSRLS (Supabase's service_role) -- that's the entire
-- lockdown mechanism; `using (false)` policies would be redundant. Only
-- Edge Functions (using the service-role key) ever read or write this table.
-- The explicit REVOKE below is defense-in-depth on top of RLS, since Supabase
-- grants default table-level privileges to anon/authenticated on new tables.
-- ---------------------------------------------------------------------------
create table public.strava_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  strava_athlete_id bigint not null unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.strava_connections enable row level security;
revoke all on public.strava_connections from anon, authenticated;

-- ---------------------------------------------------------------------------
-- strava_oauth_states: short-lived, single-use anti-CSRF token for the OAuth
-- authorize redirect. Created by strava-oauth-start (user-JWT client, so RLS
-- can check auth.uid()); consumed by strava-oauth-callback (public endpoint,
-- no user session -- reads/deletes it via the service-role client).
-- ---------------------------------------------------------------------------
create table public.strava_oauth_states (
  state text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The app's own final redirect target (e.g. mygymapp://strava-callback in
  -- a standalone build, or an exp://<host>/--/strava-callback proxy URL
  -- under Expo Go) -- computed client-side via Linking.createURL and echoed
  -- back by strava-oauth-callback, since Strava's registered redirect_uri
  -- must be a single fixed HTTPS URL and can't vary by dev/prod like
  -- Supabase's own OAuth proxy does for the Google sign-in flow.
  redirect_to text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

alter table public.strava_oauth_states enable row level security;

create policy "own state insert" on public.strava_oauth_states
  for insert with check ((select auth.uid()) = user_id);

-- No select/update/delete policies for authenticated: only the callback
-- function (service role) ever reads or deletes a state row.

-- ---------------------------------------------------------------------------
-- strava_activities: provider link table. Maps one GitFit activity (cardio or
-- strength) to one Strava activity, in one direction. Single source of truth
-- for import-duplicate-detection, export sync-loop-prevention, and
-- upload-retry idempotency. Holds no secrets, so it gets standard own-row RLS
-- and is read directly by the client (via fetchStoreData) to render
-- provenance badges/links.
-- ---------------------------------------------------------------------------
create table public.strava_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  strava_activity_id bigint,
  gitfit_activity_type text not null check (gitfit_activity_type in ('cardio_session', 'session')),
  gitfit_activity_id uuid not null,
  direction text not null check (direction in ('import', 'export')),
  external_url text,
  upload_status text not null default 'synced'
    check (upload_status in ('pending', 'uploaded', 'failed', 'synced', 'unlinked')),
  upload_error text,
  -- Transient POST /uploads ticket id, distinct from strava_activity_id
  -- (the final resolved activity). Kept for debugging only.
  strava_upload_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz
);

-- At most one row per GitFit activity per direction (one export row, one
-- import row): strava-upload retries UPSERT into the export row via
-- ON CONFLICT targeting this constraint. A partial index (WHERE direction =
-- 'export') was considered instead, but PostgREST/supabase-js's upsert has
-- no way to pass a partial index's WHERE predicate through to the ON
-- CONFLICT clause -- Postgres would reject the upsert as not matching any
-- constraint. A plain 4-column constraint gives the same guarantee (a
-- GitFit activity can only be exported once, and only imported once) and
-- works with a plain `.upsert(row, { onConflict: '...' })` call.
create unique index strava_activities_link_unique_idx
  on public.strava_activities (user_id, gitfit_activity_type, gitfit_activity_id, direction);

-- Strava activity ids are globally unique (Strava's own primary key). This is
-- the lookup index for both import-dedup and the webhook's "is this our own
-- upload echoing back" sync-loop check.
create unique index strava_activities_strava_id_idx
  on public.strava_activities (strava_activity_id)
  where strava_activity_id is not null;

create index strava_activities_user_idx on public.strava_activities (user_id);
create index strava_activities_gitfit_lookup_idx
  on public.strava_activities (gitfit_activity_type, gitfit_activity_id);

alter table public.strava_activities enable row level security;

create policy "own rows select" on public.strava_activities
  for select using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.strava_activities
  for insert with check ((select auth.uid()) = user_id);
create policy "own rows update" on public.strava_activities
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows delete" on public.strava_activities
  for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- get_strava_status(): exposes only non-secret connection fields to the
-- client, mirroring the email_exists() security-definer pattern from
-- 0004_add_email_exists_function.sql. Always returns exactly one row (a left
-- join against a single auth.uid() row), so the client can safely call
-- .single() instead of handling an empty result set.
-- ---------------------------------------------------------------------------
create function public.get_strava_status()
returns table (
  connected boolean,
  strava_athlete_id bigint,
  connected_at timestamptz,
  scope text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (c.user_id is not null) as connected,
    c.strava_athlete_id,
    c.connected_at,
    c.scope,
    c.expires_at
  from (select auth.uid() as uid) u
  left join public.strava_connections c on c.user_id = u.uid;
$$;

grant execute on function public.get_strava_status() to authenticated;
