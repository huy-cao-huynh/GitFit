import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildStrengthUploadJson, resolveStartTimeUtc } from './strength-json.ts';
import type { SessionRow } from './types.ts';

const PDT = -7 * 3600;

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 's1',
    routine_id: 'r1',
    routine_name: 'Push Day',
    date: '2026-09-06',
    duration_minutes: 42,
    calories: 300,
    exercises: [
      {
        exercise_id: 'idp',
        name: 'Incline Dumbell Press',
        sets: [
          { weight: 40, reps: 12, is_warmup: true },
          { weight: 60, reps: 10 },
          { weight: 60, reps: 8 },
          { skipped: true },
        ],
      },
      { exercise_id: 'pu', name: 'Push Up', sets: [{ reps: 20 }] },
      { exercise_id: 'plank', name: 'Plank', sets: [{ kind: 'time', duration_sec: 60 }] },
    ],
    ...overrides,
  };
}

Deno.test('buildStrengthUploadJson sends working sets with kg weights and Strava exercise types', () => {
  const json = buildStrengthUploadJson(session(), { utcOffsetSec: PDT, now: new Date('2026-09-22T20:00:00Z') });
  assertEquals(json.sets, [
    { exercise_type: 'INCLINE_DUMBBELL_BENCH_PRESS', repetitions: 10, weight: 27.22 },
    { exercise_type: 'INCLINE_DUMBBELL_BENCH_PRESS', repetitions: 8, weight: 27.22 },
    { exercise_type: 'PUSH_UP_GENERIC', repetitions: 20 },
    { exercise_type: 'PLANK_GENERIC', duration: 60 },
  ]);
  assertEquals(json.version, '1.0');
  assertEquals(json.elapsed_time, 42 * 60);
  assertEquals(json.utc_offset, PDT);
  assertEquals(json.total_calories, 300);
});

Deno.test('buildStrengthUploadJson omits calories when unknown', () => {
  const json = buildStrengthUploadJson(session({ calories: null }), { utcOffsetSec: 0 });
  assertEquals('total_calories' in json, false);
});

Deno.test('resolveStartTimeUtc places a past session at local noon', () => {
  assertEquals(resolveStartTimeUtc('2026-09-06', 2520, PDT, new Date('2026-09-22T20:00:00Z')), '2026-09-06T19:00:00Z');
});

Deno.test("resolveStartTimeUtc ends today's session now, judging 'today' in the user's timezone", () => {
  // 03:00 UTC on the 23rd is still the evening of the 22nd in PDT.
  const now = new Date('2026-09-23T03:00:00Z');
  assertEquals(resolveStartTimeUtc('2026-09-22', 1800, PDT, now), '2026-09-23T02:30:00Z');
});
