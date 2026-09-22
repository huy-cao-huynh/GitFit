/**
 * Thin wrappers around the Strava Edge Functions and the get_strava_status
 * RPC. No Strava-specific values (client id, tokens) ever live in this
 * module or anywhere else in the app -- the authorize URL is composed
 * server-side by strava-oauth-start, and tokens never leave Edge Functions.
 */
import type { UnitSystem } from '@/lib/store/types';
import { supabase } from '@/lib/supabase';

export interface StravaStatus {
  connected: boolean;
  stravaAthleteId: number | null;
  connectedAt: string | null;
}

interface StravaStatusRow {
  connected: boolean;
  strava_athlete_id: number | null;
  connected_at: string | null;
  scope: string | null;
  expires_at: string | null;
}

export async function getStravaStatus(): Promise<StravaStatus> {
  const { data, error } = await supabase.rpc('get_strava_status').single<StravaStatusRow>();
  if (error) throw new Error(error.message);
  return {
    connected: data.connected,
    stravaAthleteId: data.strava_athlete_id,
    connectedAt: data.connected_at,
  };
}

export async function startStravaAuthorize(redirectTo: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ authorizeUrl: string }>('strava-oauth-start', {
    body: { redirectTo },
  });
  if (error) throw new Error(error.message);
  return data!.authorizeUrl;
}

export async function disconnectStrava(): Promise<void> {
  const { error } = await supabase.functions.invoke('strava-disconnect', { method: 'POST' });
  if (error) throw new Error(error.message);
}

export type UploadGitfitActivityType = 'cardio_session' | 'session';

export interface UploadResult {
  status: 'uploaded' | 'failed' | 'not_connected';
  externalUrl?: string;
  error?: string;
}

export async function uploadToStrava(params: {
  gitfitActivityType: UploadGitfitActivityType;
  gitfitActivityId: string;
  /** The user's note; the server puts it above its generated description. */
  description?: string;
  unitSystem: UnitSystem;
}): Promise<UploadResult> {
  // GitFit stores dates, not clock times, so the server needs the device's
  // offset to place the workout in the right local day on Strava.
  const utcOffsetSec = -new Date().getTimezoneOffset() * 60;
  const { data, error } = await supabase.functions.invoke<UploadResult>('strava-upload', {
    body: { ...params, utcOffsetSec },
  });
  if (error) throw new Error(error.message);
  return data!;
}
