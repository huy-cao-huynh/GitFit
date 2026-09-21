import type { GitfitActivityType, StravaActivityDirection, StravaUploadStatus } from './types.ts';

export interface StravaActivityLinkLookup {
  id: string;
  direction: StravaActivityDirection;
  gitfit_activity_id: string;
  gitfit_activity_type: GitfitActivityType;
}

export type ActivityWebhookDecision =
  | { kind: 'ignore'; reason: 'unsupported-sport-type' }
  /** Our own GitFit -> Strava upload echoing back through the webhook. Sync-loop break: update only this link row's metadata, never touch GitFit's own data. */
  | { kind: 'sync-loop-echo'; linkId: string }
  /** A previously-imported activity changed on Strava's side; update the existing GitFit row in place. */
  | { kind: 'update-import'; linkId: string; gitfitActivityId: string }
  /** No existing link for this Strava activity id -- a brand-new Strava-originated activity. */
  | { kind: 'new-import' };

/**
 * Decides how strava-webhook should react to an activity create/update event,
 * given whether the refetched activity's sport_type is on the import
 * allow-list and whether a strava_activities row already links this Strava
 * activity id to a GitFit activity. Existing links always win over the
 * sport-type check (an already-imported/exported activity that changed sport
 * type on Strava should still sync, not silently orphan) -- the sport-type
 * gate only decides whether a *new* activity gets imported at all.
 */
export function decideActivityWebhookAction(params: {
  isImportableSportType: boolean;
  existingLink: StravaActivityLinkLookup | null;
}): ActivityWebhookDecision {
  const { isImportableSportType, existingLink } = params;
  if (!existingLink) {
    return isImportableSportType ? { kind: 'new-import' } : { kind: 'ignore', reason: 'unsupported-sport-type' };
  }
  if (existingLink.direction === 'export') {
    return { kind: 'sync-loop-echo', linkId: existingLink.id };
  }
  return { kind: 'update-import', linkId: existingLink.id, gitfitActivityId: existingLink.gitfit_activity_id };
}

export interface ExportLinkLookup {
  upload_status: StravaUploadStatus;
  strava_activity_id: number | null;
  external_url: string | null;
}

export type UploadDecision =
  /** Already uploaded successfully -- short-circuit and return the existing result, no re-upload. */
  | { kind: 'already-uploaded'; stravaActivityId: number; externalUrl: string | null }
  /** No successful prior upload (none yet, or a prior attempt failed) -- proceed with a fresh attempt. */
  | { kind: 'proceed' };

/** Decides whether strava-upload should short-circuit a request as already-done, or proceed. */
export function decideUploadAction(existing: ExportLinkLookup | null): UploadDecision {
  if (existing && existing.upload_status === 'uploaded' && existing.strava_activity_id != null) {
    return { kind: 'already-uploaded', stravaActivityId: existing.strava_activity_id, externalUrl: existing.external_url };
  }
  return { kind: 'proceed' };
}

/**
 * Strava's own upload-processing duplicate detection rejects a re-submitted
 * file with a message like "Test_Walk.gpx duplicate of activity 21234316".
 * Treating that as a successful link (rather than a failure) is a second,
 * Strava-side idempotency backstop on top of our own DB-level check --
 * useful if a retry ever races past our own upsert (e.g. a crash between
 * Strava accepting the upload and our status write landing).
 */
export function parseDuplicateActivityId(errorMessage: string): number | null {
  const match = errorMessage.match(/duplicate of activity (\d+)/i);
  return match ? Number(match[1]) : null;
}
