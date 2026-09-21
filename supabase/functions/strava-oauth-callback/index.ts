// Public endpoint -- Strava's browser redirects here directly after the user
// approves or denies access, so there is no Supabase session to authenticate
// with. The `state` param (minted by strava-oauth-start and tied to a user
// id server-side) is what tells us which GitFit user is completing the flow;
// it's validated and consumed (single-use) via the service-role client.
//
// This function is the first hop of a two-hop redirect: Strava -> this
// HTTPS Edge Function (which can run the server-side token exchange) -> the
// app's custom URL scheme (mygymapp://strava-callback), which is what
// WebBrowser.openAuthSessionAsync's `redirectTo` is actually watching for to
// close the in-app browser and hand control back to the app. Strava's
// registered redirect_uri must be this function's URL, not the app scheme
// directly, since only a server can hold the client_secret.
import { createServiceClient } from '../_shared/supabase-clients.ts';
import { exchangeAuthorizationCode, sanitizeStravaError } from '../_shared/strava-api.ts';

/** Falls back to the standalone-build scheme if no state row was found at all (e.g. an expired/replayed callback), so the in-app browser still has somewhere valid to redirect to and close. */
const FALLBACK_APP_CALLBACK = 'mygymapp://strava-callback';

function redirectToApp(baseUrl: string, success: boolean, reason?: string): Response {
  const url = new URL(baseUrl);
  url.searchParams.set('success', String(success));
  if (reason) url.searchParams.set('reason', reason);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const deniedError = url.searchParams.get('error');

  const serviceClient = createServiceClient();

  // Opportunistic cleanup of expired states -- this table has no cron, so
  // each callback invocation is also a chance to sweep stale rows.
  await serviceClient.from('strava_oauth_states').delete().lt('expires_at', new Date().toISOString());

  if (!state) {
    console.warn('strava-oauth-callback: missing state');
    return redirectToApp(FALLBACK_APP_CALLBACK, false, 'invalid_request');
  }

  const { data: stateRow, error: stateError } = await serviceClient
    .from('strava_oauth_states')
    .select('user_id, redirect_to, expires_at')
    .eq('state', state)
    .maybeSingle();

  if (stateError || !stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) {
    console.warn('strava-oauth-callback: invalid or expired state');
    return redirectToApp(FALLBACK_APP_CALLBACK, false, 'invalid_state');
  }

  // Single-use: consume immediately so a replayed callback can't reuse it.
  await serviceClient.from('strava_oauth_states').delete().eq('state', state);

  const userId = stateRow.user_id as string;
  const redirectTo = stateRow.redirect_to as string;

  if (deniedError) {
    console.log('strava-oauth-callback: user denied authorization', { userId, deniedError });
    return redirectToApp(redirectTo, false, 'denied');
  }

  if (!code) {
    console.warn('strava-oauth-callback: missing code', { userId });
    return redirectToApp(redirectTo, false, 'invalid_request');
  }

  try {
    const tokens = await exchangeAuthorizationCode(code);
    const athleteId = tokens.athlete?.id;
    if (!athleteId) throw new Error('Token exchange response missing athlete id.');

    const { error: upsertError } = await serviceClient.from('strava_connections').upsert(
      {
        user_id: userId,
        strava_athlete_id: athleteId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(tokens.expires_at * 1000).toISOString(),
        scope: tokens.scope ?? 'activity:read_all,activity:write',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (upsertError) throw new Error(upsertError.message);

    console.log('strava-oauth-callback: connection established', { userId, athleteId });
    return redirectToApp(redirectTo, true);
  } catch (error) {
    console.error('strava-oauth-callback: token exchange failed', { userId, error: sanitizeStravaError(error) });
    return redirectToApp(redirectTo, false, 'exchange_failed');
  }
});
