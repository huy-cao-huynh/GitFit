import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { StravaActivity, StravaConnectionRow, StravaStreamSet } from './types.ts';

const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID')!;
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET')!;

export class StravaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly rateLimited = false,
  ) {
    super(message);
    this.name = 'StravaApiError';
  }
}

interface TokenExchangeResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  scope?: string;
  /** Only present on the initial authorization_code exchange, not on refresh. */
  athlete?: { id: number };
}

/** Sanitizes an error for logs/user-facing messages -- never echoes tokens or secrets. */
export function sanitizeStravaError(error: unknown): string {
  if (error instanceof StravaApiError) {
    return error.rateLimited ? 'Strava is rate-limited right now.' : `Strava API error (${error.status}).`;
  }
  if (error instanceof Error) {
    // Strip anything that looks like it could be a token/secret rather than
    // trusting arbitrary upstream error text verbatim.
    return error.message.replace(/[A-Za-z0-9_-]{20,}/g, '[redacted]');
  }
  return 'Unknown Strava error.';
}

async function parseStravaResponse<T>(response: Response): Promise<T> {
  if (response.status === 429) {
    throw new StravaApiError('Rate limited by Strava.', 429, true);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new StravaApiError(body || `Strava request failed with status ${response.status}.`, response.status);
  }
  return response.json() as Promise<T>;
}

export async function exchangeAuthorizationCode(code: string): Promise<TokenExchangeResponse> {
  const response = await fetch('https://www.strava.com/api/v3/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });
  return parseStravaResponse<TokenExchangeResponse>(response);
}

async function refreshAccessToken(refreshToken: string): Promise<TokenExchangeResponse> {
  const response = await fetch('https://www.strava.com/api/v3/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  return parseStravaResponse<TokenExchangeResponse>(response);
}

/**
 * Ensures a connection's access token is valid, refreshing (and persisting
 * the result -- Strava may rotate the refresh_token, so whatever comes back
 * is always saved, even if unrotated) when fewer than 5 minutes remain.
 * Returns the access token to use for the caller's next request. Known
 * accepted MVP gap: two near-simultaneous refreshes for the same user (e.g.
 * a webhook and a user-triggered upload racing) could each persist a token,
 * with the loser's write clobbering the winner's rotated refresh_token --
 * low probability for a single/few-user app, not solved with row locking here.
 */
export async function ensureFreshAccessToken(
  serviceClient: SupabaseClient,
  connection: StravaConnectionRow,
): Promise<string> {
  const expiresAt = new Date(connection.expires_at).getTime();
  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
  if (expiresAt > fiveMinutesFromNow) {
    return connection.access_token;
  }

  const refreshed = await refreshAccessToken(connection.refresh_token);
  const { error } = await serviceClient
    .from('strava_connections')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);
  if (error) throw new Error(`Failed to persist refreshed Strava token: ${error.message}`);

  return refreshed.access_token;
}

async function stravaFetch(accessToken: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`https://www.strava.com/api/v3${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
  });
}

export async function getActivity(accessToken: string, activityId: number): Promise<StravaActivity> {
  const response = await stravaFetch(accessToken, `/activities/${activityId}`);
  return parseStravaResponse<StravaActivity>(response);
}

export async function getActivityStreams(accessToken: string, activityId: number): Promise<StravaStreamSet> {
  const response = await stravaFetch(
    accessToken,
    `/activities/${activityId}/streams?keys=latlng,altitude,time&key_by_type=true`,
  );
  if (response.status === 404) return {};
  return parseStravaResponse<StravaStreamSet>(response);
}

interface CreateActivityParams {
  name: string;
  sportType: string;
  startDateLocal: string;
  elapsedTimeSec: number;
  description?: string;
  distanceMeters?: number;
}

export async function createManualActivity(
  accessToken: string,
  params: CreateActivityParams,
): Promise<{ id: number }> {
  const response = await stravaFetch(accessToken, '/activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: params.name,
      sport_type: params.sportType,
      start_date_local: params.startDateLocal,
      elapsed_time: Math.round(params.elapsedTimeSec),
      description: params.description,
      distance: params.distanceMeters,
    }),
  });
  return parseStravaResponse<{ id: number }>(response);
}

export interface UploadResult {
  id: number; // the transient upload ticket id
}

/**
 * POST /uploads with an activity file. GPX carries a recorded route; JSON is
 * Strava's WeightTraining format carrying structured sets. Processing is
 * async either way -- poll the returned ticket with pollUploadUntilResolved.
 */
export async function uploadActivityFile(
  accessToken: string,
  params: {
    file: string;
    dataType: 'gpx' | 'json';
    name: string;
    description?: string;
    sportType: string;
    externalId: string;
  },
): Promise<UploadResult> {
  const contentType = params.dataType === 'gpx' ? 'application/gpx+xml' : 'application/json';
  const form = new FormData();
  form.set('file', new Blob([params.file], { type: contentType }), `${params.externalId}.${params.dataType}`);
  form.set('data_type', params.dataType);
  form.set('name', params.name);
  if (params.description) form.set('description', params.description);
  form.set('sport_type', params.sportType);
  form.set('external_id', params.externalId);

  const response = await fetch('https://www.strava.com/api/v3/uploads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  return parseStravaResponse<UploadResult>(response);
}

export function uploadGpxFile(
  accessToken: string,
  params: { gpx: string; name: string; description?: string; sportType: string; externalId: string },
): Promise<UploadResult> {
  const { gpx, ...rest } = params;
  return uploadActivityFile(accessToken, { ...rest, file: gpx, dataType: 'gpx' });
}

export interface UploadStatus {
  id: number;
  activity_id: number | null;
  error: string | null;
  status: string;
}

export async function getUploadStatus(accessToken: string, uploadId: number): Promise<UploadStatus> {
  const response = await stravaFetch(accessToken, `/uploads/${uploadId}`);
  return parseStravaResponse<UploadStatus>(response);
}

/**
 * Polls GET /uploads/{id} until Strava resolves the async GPX-processing job
 * to either an activity_id or an error, per Strava's documented "typically
 * under 2 seconds, poll at >=1s intervals" guidance. Bounded to ~15s total --
 * long enough for normal processing, short enough to stay well inside an Edge
 * Function's execution limits for a synchronous user-facing upload request.
 */
export async function pollUploadUntilResolved(
  accessToken: string,
  uploadId: number,
  { intervalMs = 1500, maxAttempts = 10 }: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<UploadStatus> {
  let lastStatus: UploadStatus | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    lastStatus = await getUploadStatus(accessToken, uploadId);
    if (lastStatus.activity_id != null || lastStatus.error) return lastStatus;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return lastStatus!;
}

export async function deauthorize(accessToken: string): Promise<void> {
  await fetch(`https://www.strava.com/oauth/deauthorize?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
  });
  // Best-effort: the caller always removes the local connection row
  // regardless of whether this call succeeds (see strava-disconnect).
}
