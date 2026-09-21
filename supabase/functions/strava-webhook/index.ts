// Public endpoint -- Strava calls this directly, with no Supabase session.
// GET handles the one-time subscription verification challenge. POST
// delivers activity/athlete events and MUST be acknowledged with 200 within
// 2 seconds (Strava's docs state this applies to every event, not just the
// initial verification) -- so the handler does only cheap, synchronous shape
// validation before responding, then finishes the real work (token refresh,
// fetching the activity/streams from Strava, writing to Postgres) inside
// EdgeRuntime.waitUntil so it keeps running after the response is sent.
import { createServiceClient } from '../_shared/supabase-clients.ts';
import { ensureFreshAccessToken, getActivity, getActivityStreams, sanitizeStravaError } from '../_shared/strava-api.ts';
import { decideActivityWebhookAction } from '../_shared/idempotency.ts';
import { isImportableStravaActivity } from '../_shared/sport-type.ts';
import { normalizeStravaActivity, stravaActivityUrl } from '../_shared/normalize.ts';
import type { StravaConnectionRow, StravaWebhookEvent } from '../_shared/types.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const WEBHOOK_VERIFY_TOKEN = Deno.env.get('STRAVA_WEBHOOK_VERIFY_TOKEN')!;

function isValidEventShape(value: unknown): value is StravaWebhookEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    (event.object_type === 'activity' || event.object_type === 'athlete') &&
    typeof event.object_id === 'number' &&
    (event.aspect_type === 'create' || event.aspect_type === 'update' || event.aspect_type === 'delete') &&
    typeof event.owner_id === 'number'
  );
}

async function handleDeauthorization(event: StravaWebhookEvent): Promise<void> {
  const serviceClient = createServiceClient();
  const { error } = await serviceClient.from('strava_connections').delete().eq('strava_athlete_id', event.owner_id);
  if (error) {
    console.error('strava-webhook: failed to remove connection on deauthorization', {
      athleteId: event.owner_id,
      error: error.message,
    });
    return;
  }
  console.log('strava-webhook: athlete deauthorized', { athleteId: event.owner_id });
}

async function handleActivityDelete(event: StravaWebhookEvent): Promise<void> {
  const serviceClient = createServiceClient();
  // Never hard-delete the GitFit-side record -- Strava's "delete" can also
  // mean the activity's visibility toggled to "Only Me", not true deletion,
  // and GitFit stays the system of record for what the user actually did
  // regardless of what happens on Strava's side. Mark the link unlinked and
  // leave cardio_sessions untouched; a genuinely new activity later gets a
  // new Strava id and is handled as an ordinary new import.
  const { error } = await serviceClient
    .from('strava_activities')
    .update({ upload_status: 'unlinked', updated_at: new Date().toISOString() })
    .eq('strava_activity_id', event.object_id);
  if (error) {
    console.error('strava-webhook: failed to mark activity unlinked', {
      stravaActivityId: event.object_id,
      error: error.message,
    });
    return;
  }
  console.log('strava-webhook: activity marked unlinked', { stravaActivityId: event.object_id });
}

async function handleActivityCreateOrUpdate(event: StravaWebhookEvent): Promise<void> {
  const serviceClient = createServiceClient();

  const { data: connection } = await serviceClient
    .from('strava_connections')
    .select('*')
    .eq('strava_athlete_id', event.owner_id)
    .maybeSingle<StravaConnectionRow>();

  if (!connection) {
    console.log('strava-webhook: no connection for athlete, ignoring event', { athleteId: event.owner_id });
    return;
  }

  let accessToken: string;
  try {
    accessToken = await ensureFreshAccessToken(serviceClient, connection);
  } catch (error) {
    console.error('strava-webhook: token refresh failed', { athleteId: event.owner_id, error: sanitizeStravaError(error) });
    return;
  }

  // Never trust the webhook payload's own fields for content -- Strava's
  // docs warn one athlete action can fire multiple webhook events, so always
  // refetch the current, authoritative activity state.
  let activity;
  try {
    activity = await getActivity(accessToken, event.object_id);
  } catch (error) {
    console.error('strava-webhook: failed to fetch activity', {
      stravaActivityId: event.object_id,
      error: sanitizeStravaError(error),
    });
    return;
  }

  const sportType = activity.sport_type || activity.type;

  const { data: existingLink } = await serviceClient
    .from('strava_activities')
    .select('id, direction, gitfit_activity_id, gitfit_activity_type')
    .eq('strava_activity_id', event.object_id)
    .maybeSingle();

  const decision = decideActivityWebhookAction({
    isImportableSportType: isImportableStravaActivity(sportType),
    existingLink: existingLink ?? null,
  });

  const nowIso = new Date().toISOString();
  const externalUrl = stravaActivityUrl(event.object_id);

  if (decision.kind === 'ignore') {
    console.log('strava-webhook: ignoring unsupported sport type', { stravaActivityId: event.object_id, sportType });
    return;
  }

  if (decision.kind === 'sync-loop-echo') {
    // Our own GitFit -> Strava upload echoing back through the webhook.
    // Update only this link row's sync metadata -- never touch the
    // GitFit-side cardio_sessions/sessions data, which stays authoritative.
    await serviceClient
      .from('strava_activities')
      .update({ upload_status: 'synced', external_url: externalUrl, last_synced_at: nowIso, updated_at: nowIso })
      .eq('id', decision.linkId);
    console.log('strava-webhook: sync-loop echo recognized, no duplicate created', { stravaActivityId: event.object_id });
    return;
  }

  let streams = {};
  try {
    streams = await getActivityStreams(accessToken, event.object_id);
  } catch (error) {
    console.warn('strava-webhook: failed to fetch streams, continuing without route', {
      stravaActivityId: event.object_id,
      error: sanitizeStravaError(error),
    });
  }
  const normalized = normalizeStravaActivity(activity, streams);

  if (decision.kind === 'update-import') {
    await serviceClient.from('cardio_sessions').update(normalized).eq('id', decision.gitfitActivityId);
    await serviceClient
      .from('strava_activities')
      .update({ upload_status: 'synced', external_url: externalUrl, last_synced_at: nowIso, updated_at: nowIso })
      .eq('id', decision.linkId);
    console.log('strava-webhook: updated imported activity', { stravaActivityId: event.object_id });
    return;
  }

  // decision.kind === 'new-import'
  const newId = crypto.randomUUID();
  const { error: insertSessionError } = await serviceClient
    .from('cardio_sessions')
    .insert({ id: newId, routine_id: null, user_id: connection.user_id, ...normalized });
  if (insertSessionError) {
    console.error('strava-webhook: failed to insert imported cardio session', {
      stravaActivityId: event.object_id,
      error: insertSessionError.message,
    });
    return;
  }

  const { error: insertLinkError } = await serviceClient.from('strava_activities').insert({
    user_id: connection.user_id,
    strava_activity_id: event.object_id,
    gitfit_activity_type: 'cardio_session',
    gitfit_activity_id: newId,
    direction: 'import',
    external_url: externalUrl,
    upload_status: 'synced',
    last_synced_at: nowIso,
  });
  if (insertLinkError) {
    console.error('strava-webhook: failed to insert strava_activities link', {
      stravaActivityId: event.object_id,
      error: insertLinkError.message,
    });
    return;
  }

  console.log('strava-webhook: imported new activity', { stravaActivityId: event.object_id, cardioSessionId: newId });
}

async function processEvent(event: StravaWebhookEvent): Promise<void> {
  if (event.object_type === 'athlete') {
    if (event.updates?.authorized === 'false') {
      await handleDeauthorization(event);
    }
    return;
  }

  if (event.aspect_type === 'delete') {
    await handleActivityDelete(event);
    return;
  }

  await handleActivityCreateOrUpdate(event);
}

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode !== 'subscribe' || token !== WEBHOOK_VERIFY_TOKEN || !challenge) {
      console.warn('strava-webhook: verification challenge failed');
      return new Response('Forbidden', { status: 403 });
    }

    return new Response(JSON.stringify({ 'hub.challenge': challenge }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'POST') {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      console.error('strava-webhook: malformed JSON payload');
      return new Response('EVENT_RECEIVED', { status: 200 });
    }

    if (!isValidEventShape(payload)) {
      console.error('strava-webhook: unrecognized payload shape', { payload });
      return new Response('EVENT_RECEIVED', { status: 200 });
    }

    const event = payload;
    console.log('strava-webhook: received event', {
      objectType: event.object_type,
      aspectType: event.aspect_type,
      objectId: event.object_id,
    });

    EdgeRuntime.waitUntil(
      processEvent(event).catch((error) => {
        console.error('strava-webhook: unhandled processing error', { error: sanitizeStravaError(error) });
      }),
    );

    return new Response('EVENT_RECEIVED', { status: 200 });
  }

  return new Response('Method not allowed', { status: 405 });
});
