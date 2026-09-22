// Authenticated endpoint: uploads a completed GitFit workout to the caller's
// Strava account. Idempotent -- retries never create a second Strava
// activity for the same GitFit activity, backstopped two ways: (1) a DB-level
// check against the existing strava_activities export row, short-circuiting
// if it's already 'uploaded'; (2) Strava's own upload-processing duplicate
// detection, whose "duplicate of activity N" error is treated as success
// rather than failure.
//
// Transport choice: a cardio session with a recorded GPS route uploads via
// POST /uploads (a GPX file built from GpsPoint[]), because POST /activities
// (manual creation) has no route/map support at all -- using it for a
// GPS-tracked run would silently drop the map on Strava's side. Strength
// sessions also go through POST /uploads, as a WeightTraining JSON file of
// structured sets: that's what Strava builds its native strength view from
// (Volume/Sets/Reps stats, the set log, the muscle map). If Strava rejects
// the JSON, strength falls back to POST /activities with the same text
// description, so the new format can never cost the user an upload. Cardio
// without a route uses POST /activities directly -- nothing to lose there.
import { createServiceClient, createUserClient, getAuthenticatedUserId } from '../_shared/supabase-clients.ts';
import {
  createManualActivity,
  ensureFreshAccessToken,
  pollUploadUntilResolved,
  sanitizeStravaError,
  StravaApiError,
  uploadActivityFile,
  uploadGpxFile,
} from '../_shared/strava-api.ts';
import { decideUploadAction, parseDuplicateActivityId } from '../_shared/idempotency.ts';
import { buildCardioDescription, buildStrengthDescription, type UnitSystem } from '../_shared/description.ts';
import { buildStrengthUploadJson } from '../_shared/strength-json.ts';
import { buildGpx } from '../_shared/gpx.ts';
import { cardioActivityTypeToStravaSportType, STRENGTH_STRAVA_SPORT_TYPE } from '../_shared/sport-type.ts';
import { stravaActivityUrl } from '../_shared/normalize.ts';
import type { CardioSessionRow, SessionRow, SessionExerciseRow, StravaConnectionRow } from '../_shared/types.ts';

interface UploadRequestBody {
  gitfitActivityType: 'cardio_session' | 'session';
  gitfitActivityId: string;
  /** The user's own note; shown above the generated description, never instead of it. */
  description?: string;
  /** Seconds east of UTC on the uploading device, e.g. -25200 for PDT. */
  utcOffsetSec?: number;
  /** Units for the weights printed in the strength description. */
  unitSystem?: UnitSystem;
}

/** Puts the user's note above the generated stats, separated by a blank line. */
function composeDescription(userNote: string | undefined, generated: string): string {
  return [userNote, generated].filter(Boolean).join('\n\n');
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Same-day sessions use "now" as the start time; older ones fall back to local noon. GitFit doesn't persist a session's clock time, only its date -- a documented MVP limitation, not a bug. */
function resolveStartDateLocal(dateKey: string): string {
  const todayKey = new Date().toISOString().slice(0, 10);
  if (dateKey === todayKey) return new Date().toISOString().replace('Z', '');
  return `${dateKey}T12:00:00`;
}

async function fetchSessionRow(userClient: ReturnType<typeof createUserClient>, sessionId: string): Promise<SessionRow | null> {
  const { data: session } = await userClient.from('sessions').select('*').eq('id', sessionId).maybeSingle();
  if (!session) return null;

  const { data: exercises } = await userClient
    .from('session_exercises')
    .select('id, exercise_id, name')
    .eq('session_id', sessionId)
    .order('position');
  const exerciseRows = exercises ?? [];

  const { data: sets } = exerciseRows.length
    ? await userClient
        .from('session_sets')
        .select('session_exercise_id, kind, weight, reps, duration_sec, is_warmup, skipped')
        .in('session_exercise_id', exerciseRows.map((e) => e.id))
        .order('position')
    : { data: [] };

  const exerciseResults: SessionExerciseRow[] = exerciseRows.map((exercise) => ({
    exercise_id: exercise.exercise_id,
    name: exercise.name,
    sets: (sets ?? [])
      .filter((set) => set.session_exercise_id === exercise.id)
      .map((set) => ({
        kind: set.kind ?? undefined,
        weight: set.weight ?? undefined,
        reps: set.reps ?? undefined,
        duration_sec: set.duration_sec ?? undefined,
        is_warmup: set.is_warmup ?? undefined,
        skipped: set.skipped ?? undefined,
      })),
  }));

  return {
    id: session.id,
    routine_id: session.routine_id,
    routine_name: session.routine_name,
    date: session.date,
    duration_minutes: session.duration_minutes,
    calories: session.calories,
    exercises: exerciseResults,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const userClient = createUserClient(req);
  const userId = await getAuthenticatedUserId(userClient);
  if (!userId) return jsonResponse({ error: 'Not authenticated.' }, 401);

  let body: UploadRequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }
  if (
    (body.gitfitActivityType !== 'cardio_session' && body.gitfitActivityType !== 'session') ||
    typeof body.gitfitActivityId !== 'string'
  ) {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }
  const { gitfitActivityType, gitfitActivityId } = body;
  const userNote = typeof body.description === 'string' ? body.description.trim() || undefined : undefined;
  // Real offsets span -12h..+14h; anything else is a bad client value, not a timezone.
  const utcOffsetSec =
    Number.isInteger(body.utcOffsetSec) && Math.abs(body.utcOffsetSec!) <= 14 * 3600 ? body.utcOffsetSec! : 0;
  const unitSystem: UnitSystem = body.unitSystem === 'metric' ? 'metric' : 'imperial';

  const { data: existingLink } = await userClient
    .from('strava_activities')
    .select('upload_status, strava_activity_id, external_url')
    .eq('gitfit_activity_type', gitfitActivityType)
    .eq('gitfit_activity_id', gitfitActivityId)
    .eq('direction', 'export')
    .maybeSingle();

  const decision = decideUploadAction(existingLink ?? null);
  if (decision.kind === 'already-uploaded') {
    console.log('strava-upload: already uploaded, short-circuiting', { userId, gitfitActivityType, gitfitActivityId });
    return jsonResponse({ status: 'uploaded', externalUrl: decision.externalUrl });
  }

  const serviceClient = createServiceClient();
  const { data: connection } = await serviceClient
    .from('strava_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<StravaConnectionRow>();
  if (!connection) return jsonResponse({ status: 'not_connected' }, 409);

  let accessToken: string;
  try {
    accessToken = await ensureFreshAccessToken(serviceClient, connection);
  } catch (error) {
    console.error('strava-upload: token refresh failed', { userId, error: sanitizeStravaError(error) });
    return jsonResponse({ status: 'failed', error: 'Could not refresh Strava access.' });
  }

  // Mark this attempt pending before calling Strava, so a crash mid-upload
  // leaves visible "pending" state rather than nothing, and any concurrent
  // retry sees the row instead of racing a second insert.
  await userClient.from('strava_activities').upsert(
    {
      user_id: userId,
      gitfit_activity_type: gitfitActivityType,
      gitfit_activity_id: gitfitActivityId,
      direction: 'export',
      upload_status: 'pending',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,gitfit_activity_type,gitfit_activity_id,direction' },
  );

  async function markResult(update: { upload_status: 'uploaded' | 'failed'; strava_activity_id?: number; external_url?: string; upload_error?: string }) {
    await userClient
      .from('strava_activities')
      .update({ ...update, updated_at: new Date().toISOString(), last_synced_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('gitfit_activity_type', gitfitActivityType)
      .eq('gitfit_activity_id', gitfitActivityId)
      .eq('direction', 'export');
  }

  /**
   * Records Strava's upload ticket on the link row, then polls it. A
   * "duplicate of activity N" error means an earlier attempt already made
   * it, so it resolves as uploaded. A timeout is kept distinct from an error:
   * the file may still be processing, so the caller must not retry by
   * another route.
   */
  async function resolveUploadTicket(
    uploadId: number,
  ): Promise<{ kind: 'uploaded'; activityId: number } | { kind: 'error'; message: string } | { kind: 'timeout' }> {
    await userClient
      .from('strava_activities')
      .update({ strava_upload_id: uploadId })
      .eq('user_id', userId)
      .eq('gitfit_activity_type', gitfitActivityType)
      .eq('gitfit_activity_id', gitfitActivityId)
      .eq('direction', 'export');

    const status = await pollUploadUntilResolved(accessToken, uploadId);
    if (status.activity_id) return { kind: 'uploaded', activityId: status.activity_id };
    const duplicateId = status.error ? parseDuplicateActivityId(status.error) : null;
    if (duplicateId) return { kind: 'uploaded', activityId: duplicateId };
    if (status.error) return { kind: 'error', message: status.error };
    return { kind: 'timeout' };
  }

  async function succeed(activityId: number, logMessage: string) {
    await markResult({ upload_status: 'uploaded', strava_activity_id: activityId, external_url: stravaActivityUrl(activityId) });
    console.log(`strava-upload: ${logMessage}`, { userId, gitfitActivityType, gitfitActivityId, stravaActivityId: activityId });
    return jsonResponse({ status: 'uploaded', externalUrl: stravaActivityUrl(activityId) });
  }

  try {
    if (gitfitActivityType === 'cardio_session') {
      const { data: session } = await userClient
        .from('cardio_sessions')
        .select('*')
        .eq('id', gitfitActivityId)
        .maybeSingle<CardioSessionRow>();
      if (!session) {
        await markResult({ upload_status: 'failed', upload_error: 'Workout not found.' });
        return jsonResponse({ status: 'failed', error: 'Workout not found.' }, 404);
      }

      const description = composeDescription(userNote, buildCardioDescription(session));
      const sportType = cardioActivityTypeToStravaSportType(session.activity_type);

      if (session.route && session.route.length > 1) {
        const gpx = buildGpx(session.route, session.name);
        const externalId = `gitfit:cardio_session:${gitfitActivityId}`;
        const upload = await uploadGpxFile(accessToken, { gpx, name: session.name, description, sportType, externalId });
        const outcome = await resolveUploadTicket(upload.id);
        if (outcome.kind === 'uploaded') return succeed(outcome.activityId, 'GPX upload succeeded');

        const errorMessage = outcome.kind === 'error' ? outcome.message : 'Upload timed out waiting for Strava to process it.';
        await markResult({ upload_status: 'failed', upload_error: sanitizeStravaError(new Error(errorMessage)) });
        console.error('strava-upload: GPX processing failed', { userId, gitfitActivityId, error: errorMessage });
        return jsonResponse({ status: 'failed' });
      }

      const created = await createManualActivity(accessToken, {
        name: session.name,
        sportType,
        startDateLocal: resolveStartDateLocal(session.date),
        elapsedTimeSec: session.minutes * 60,
        description,
        distanceMeters: session.distance_miles ? session.distance_miles * 1609.34 : undefined,
      });
      return succeed(created.id, 'manual activity created');
    }

    // gitfitActivityType === 'session' (strength): WeightTraining JSON upload, manual activity as the fallback.
    const session = await fetchSessionRow(userClient, gitfitActivityId);
    if (!session) {
      await markResult({ upload_status: 'failed', upload_error: 'Workout not found.' });
      return jsonResponse({ status: 'failed', error: 'Workout not found.' }, 404);
    }

    const description = composeDescription(userNote, buildStrengthDescription(session, unitSystem));
    const uploadJson = buildStrengthUploadJson(session, { utcOffsetSec });

    // Strava requires at least one set; an all-skipped workout goes straight to the fallback.
    if (uploadJson.sets.length > 0) {
      let outcome: Awaited<ReturnType<typeof resolveUploadTicket>>;
      try {
        const upload = await uploadActivityFile(accessToken, {
          file: JSON.stringify(uploadJson),
          dataType: 'json',
          name: session.routine_name,
          description,
          sportType: STRENGTH_STRAVA_SPORT_TYPE,
          externalId: `gitfit:session:${gitfitActivityId}`,
        });
        outcome = await resolveUploadTicket(upload.id);
      } catch (error) {
        // A file Strava refuses outright (400/422) gets the same fallback as one it fails to
        // process. Rate limits and auth failures would sink the fallback too, so they propagate.
        if (!(error instanceof StravaApiError) || error.rateLimited || error.status === 401 || error.status === 403) throw error;
        outcome = { kind: 'error', message: error.message };
      }
      if (outcome.kind === 'uploaded') return succeed(outcome.activityId, 'strength JSON upload succeeded');
      if (outcome.kind === 'timeout') {
        // Still processing on Strava's side -- a manual fallback now could double-post. A retry
        // re-submits the same external_id and resolves via Strava's duplicate detection.
        await markResult({ upload_status: 'failed', upload_error: 'Upload timed out waiting for Strava to process it.' });
        console.error('strava-upload: strength JSON processing timed out', { userId, gitfitActivityId });
        return jsonResponse({ status: 'failed', error: 'Strava is still processing this workout. Try again in a minute.' });
      }
      console.warn('strava-upload: strength JSON rejected, falling back to a manual activity', {
        userId,
        gitfitActivityId,
        error: sanitizeStravaError(new Error(outcome.message)),
      });
    }

    const created = await createManualActivity(accessToken, {
      name: session.routine_name,
      sportType: STRENGTH_STRAVA_SPORT_TYPE,
      startDateLocal: resolveStartDateLocal(session.date),
      elapsedTimeSec: session.duration_minutes * 60,
      description,
    });
    return succeed(created.id, 'manual strength activity created');
  } catch (error) {
    const message = sanitizeStravaError(error);
    await markResult({ upload_status: 'failed', upload_error: message });
    console.error('strava-upload: upload failed', { userId, gitfitActivityType, gitfitActivityId, error: message });
    return jsonResponse({ status: 'failed' });
  }
});
