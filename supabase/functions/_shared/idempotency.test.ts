import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { decideActivityWebhookAction, decideUploadAction, parseDuplicateActivityId } from './idempotency.ts';

Deno.test('decideActivityWebhookAction: no link, importable sport type -> new import', () => {
  const decision = decideActivityWebhookAction({ isImportableSportType: true, existingLink: null });
  assertEquals(decision, { kind: 'new-import' });
});

Deno.test('decideActivityWebhookAction: no link, unsupported sport type -> ignore', () => {
  const decision = decideActivityWebhookAction({ isImportableSportType: false, existingLink: null });
  assertEquals(decision, { kind: 'ignore', reason: 'unsupported-sport-type' });
});

Deno.test('decideActivityWebhookAction: existing export link -> sync-loop echo, regardless of sport type', () => {
  const existingLink = {
    id: 'link-1',
    direction: 'export' as const,
    gitfit_activity_id: 'gitfit-1',
    gitfit_activity_type: 'cardio_session' as const,
  };
  assertEquals(
    decideActivityWebhookAction({ isImportableSportType: false, existingLink }),
    { kind: 'sync-loop-echo', linkId: 'link-1' },
  );
  assertEquals(
    decideActivityWebhookAction({ isImportableSportType: true, existingLink }),
    { kind: 'sync-loop-echo', linkId: 'link-1' },
  );
});

Deno.test('decideActivityWebhookAction: existing import link -> update in place', () => {
  const existingLink = {
    id: 'link-2',
    direction: 'import' as const,
    gitfit_activity_id: 'gitfit-2',
    gitfit_activity_type: 'cardio_session' as const,
  };
  assertEquals(
    decideActivityWebhookAction({ isImportableSportType: true, existingLink }),
    { kind: 'update-import', linkId: 'link-2', gitfitActivityId: 'gitfit-2' },
  );
});

Deno.test('decideUploadAction: no existing row -> proceed', () => {
  assertEquals(decideUploadAction(null), { kind: 'proceed' });
});

Deno.test('decideUploadAction: prior failure -> proceed (retry)', () => {
  assertEquals(
    decideUploadAction({ upload_status: 'failed', strava_activity_id: null, external_url: null }),
    { kind: 'proceed' },
  );
});

Deno.test('decideUploadAction: already uploaded -> short-circuit with existing result', () => {
  assertEquals(
    decideUploadAction({ upload_status: 'uploaded', strava_activity_id: 999, external_url: 'https://strava.com/activities/999' }),
    { kind: 'already-uploaded', stravaActivityId: 999, externalUrl: 'https://strava.com/activities/999' },
  );
});

Deno.test('decideUploadAction: uploaded status but missing id is treated as not-yet-done (defensive)', () => {
  assertEquals(
    decideUploadAction({ upload_status: 'uploaded', strava_activity_id: null, external_url: null }),
    { kind: 'proceed' },
  );
});

Deno.test('parseDuplicateActivityId extracts the id from Strava\'s duplicate error message', () => {
  assertEquals(parseDuplicateActivityId('Test_Walk.gpx duplicate of activity 21234316'), 21234316);
});

Deno.test('parseDuplicateActivityId returns null for unrelated errors', () => {
  assertEquals(parseDuplicateActivityId('Invalid file format'), null);
});
