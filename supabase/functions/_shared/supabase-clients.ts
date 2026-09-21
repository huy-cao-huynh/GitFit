import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are all
// auto-injected into every Edge Function's runtime by Supabase -- no
// `supabase secrets set` needed for any of them. Only the Strava-specific
// secrets require manual configuration (see strava-api.ts).
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * A client scoped to the caller's own Supabase session -- built with the
 * anon key and the caller's own Authorization header forwarded, so every
 * query runs under the caller's JWT and is fully RLS-enforced (PostgREST
 * resolves the Postgres role from the JWT in Authorization, not from the
 * apikey header). Use this whenever an authenticated endpoint only needs to
 * read/write the calling user's own rows (e.g. reading their own
 * cardio_sessions row to build an upload, or inserting their own
 * strava_activities export row). Deliberately never holds the service-role
 * key, so it can't be misused to bypass RLS even by mistake.
 */
export function createUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization') ?? '';
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

/**
 * A service-role client that bypasses RLS entirely (service_role has
 * BYPASSRLS). Use ONLY where there is no user session to scope to and the
 * operation has been independently justified as safe -- e.g. reading/writing
 * strava_connections (which grants zero access to any other role by design),
 * or a webhook handler deriving the correct user_id from a
 * strava_connections lookup keyed by Strava's own athlete id rather than
 * from anything the webhook payload itself claims.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/** Returns the authenticated caller's user id, or null if the JWT is missing/invalid. */
export async function getAuthenticatedUserId(userClient: SupabaseClient): Promise<string | null> {
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
