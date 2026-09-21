// Authenticated endpoint: disconnects the caller's own Strava account.
// Best-effort revoke against Strava, but the local strava_connections row is
// always deleted regardless of whether the revoke call succeeds -- the
// user's disconnect intent is honored locally even if Strava's endpoint is
// briefly unavailable. strava_activities history rows are left intact so
// past imports/uploads remain visible.
import { createServiceClient, createUserClient, getAuthenticatedUserId } from '../_shared/supabase-clients.ts';
import { deauthorize, sanitizeStravaError } from '../_shared/strava-api.ts';

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

  const serviceClient = createServiceClient();
  const { data: connection } = await serviceClient
    .from('strava_connections')
    .select('access_token')
    .eq('user_id', userId)
    .maybeSingle();

  if (connection) {
    try {
      await deauthorize(connection.access_token);
    } catch (error) {
      console.warn('strava-disconnect: revoke call failed, proceeding with local cleanup', {
        userId,
        error: sanitizeStravaError(error),
      });
    }
  }

  const { error: deleteError } = await serviceClient.from('strava_connections').delete().eq('user_id', userId);
  if (deleteError) {
    console.error('strava-disconnect: failed to delete connection row', { userId, error: deleteError.message });
    return new Response(JSON.stringify({ error: 'Could not disconnect Strava.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log('strava-disconnect: disconnected', { userId });
  return new Response(JSON.stringify({ disconnected: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
