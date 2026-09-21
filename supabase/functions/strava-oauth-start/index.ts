// Authenticated endpoint: mints a single-use anti-CSRF state token tied to
// the caller's own user id, then returns a server-composed Strava authorize
// URL. The client never needs to know the Strava client_id or scopes --
// composing the URL here means zero Strava-specific values ever reach the
// iOS bundle.
import { createUserClient, getAuthenticatedUserId } from '../_shared/supabase-clients.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID')!;

function generateState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

interface StartRequestBody {
  /** The app's own final redirect target, from Linking.createURL('strava-callback') -- see the migration's comment on strava_oauth_states.redirect_to for why this can't be a fixed value. */
  redirectTo: string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const userClient = createUserClient(req);
  const userId = await getAuthenticatedUserId(userClient);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: StartRequestBody;
  try {
    body = await req.json();
  } catch {
    body = { redirectTo: '' };
  }
  if (!body.redirectTo) {
    return new Response(JSON.stringify({ error: 'Missing redirectTo.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const state = generateState();
  // user_id defaults to auth.uid() at the DB layer -- not sent explicitly,
  // matching this project's existing convention of never sending user_id
  // from the client (see AGENTS.md).
  const { error } = await userClient.from('strava_oauth_states').insert({ state, redirect_to: body.redirectTo });
  if (error) {
    console.error('strava-oauth-start: failed to persist state', { userId, error: error.message });
    return new Response(JSON.stringify({ error: 'Could not start Strava connection.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const redirectUri = `${SUPABASE_URL}/functions/v1/strava-oauth-callback`;
  const authorizeUrl = new URL('https://www.strava.com/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', STRAVA_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'activity:read_all,activity:write');
  authorizeUrl.searchParams.set('state', state);

  console.log('strava-oauth-start: issued authorize URL', { userId });

  return new Response(JSON.stringify({ authorizeUrl: authorizeUrl.toString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
