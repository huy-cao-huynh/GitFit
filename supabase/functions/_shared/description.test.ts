import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildCardioDescription, buildStrengthDescription } from './description.ts';
import type { CardioSessionRow, SessionRow } from './types.ts';

function cardioRow(overrides: Partial<CardioSessionRow> = {}): CardioSessionRow {
  return {
    id: 'c1',
    routine_id: null,
    name: 'Morning Run',
    activity_type: 'run',
    date: '2026-09-06',
    minutes: 42,
    distance_miles: 5.02,
    calories: 480,
    route: null,
    elevation_gain_ft: 312,
    avg_pace_sec_per_mile: 501, // 8:21
    ...overrides,
  };
}

Deno.test('buildCardioDescription includes distance, pace, duration, and elevation', () => {
  const description = buildCardioDescription(cardioRow());
  assertEquals(
    description,
    'GitFit Run\n5.02 mi • 8:21 /mi • 42 min\nElevation: 312 ft',
  );
});

Deno.test('buildCardioDescription omits distance/pace when absent (manual time-only entry)', () => {
  const description = buildCardioDescription(
    cardioRow({ distance_miles: null, avg_pace_sec_per_mile: null, elevation_gain_ft: null }),
  );
  assertEquals(description, 'GitFit Run\n42 min');
});

Deno.test('buildCardioDescription omits the elevation line when zero or absent', () => {
  const description = buildCardioDescription(cardioRow({ elevation_gain_ft: 0 }));
  assertEquals(description.includes('Elevation'), false);
});

Deno.test('buildCardioDescription uses the correct activity label', () => {
  assertStringIncludes(buildCardioDescription(cardioRow({ activity_type: 'hike' })), 'GitFit Hike');
  assertStringIncludes(buildCardioDescription(cardioRow({ activity_type: 'walk' })), 'GitFit Walk');
});

function strengthRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 's1',
    routine_id: 'r1',
    routine_name: 'Push Day',
    date: '2026-09-06',
    duration_minutes: 42,
    calories: 320,
    exercises: [
      {
        exercise_id: 'bench',
        name: 'Bench Press',
        sets: [
          { weight: 135, reps: 8 },
          { weight: 135, reps: 8 },
          { weight: 135, reps: 6 },
        ],
      },
      {
        exercise_id: 'ohp',
        name: 'Overhead Press',
        sets: [
          { weight: 65, reps: 10 },
          { weight: 65, reps: 10 },
        ],
      },
    ],
    ...overrides,
  };
}

Deno.test('buildStrengthDescription lists each exercise as sets x top weight, then a totals footer', () => {
  const description = buildStrengthDescription(strengthRow());
  assertEquals(description, 'Bench Press: 3 x 135\nOverhead Press: 2 x 65\n\n2 exercises, 5 sets, 320 kcal');
});

Deno.test('buildStrengthDescription leaves out the routine name and duration', () => {
  const description = buildStrengthDescription(strengthRow());
  assertEquals(description.includes('Push Day'), false);
  assertEquals(description.includes('min'), false);
});

Deno.test('buildStrengthDescription uses the heaviest working set when loads vary', () => {
  const description = buildStrengthDescription(
    strengthRow({
      exercises: [
        {
          exercise_id: 'idp',
          name: 'Incline Dumbbell Press',
          sets: [
            { weight: 60, reps: 10 },
            { weight: 60, reps: 10 },
            { weight: 65, reps: 8 },
          ],
        },
      ],
    }),
  );
  assertStringIncludes(description, 'Incline Dumbbell Press: 3 x 65');
});

Deno.test('buildStrengthDescription excludes skipped and warm-up sets, and fully-skipped exercises', () => {
  const description = buildStrengthDescription(
    strengthRow({
      exercises: [
        {
          exercise_id: 'bench',
          name: 'Bench Press',
          sets: [
            { weight: 95, reps: 10, is_warmup: true },
            { weight: 135, reps: 8 },
            { skipped: true },
          ],
        },
        { exercise_id: 'fly', name: 'Chest Flys', sets: [{ skipped: true }, { skipped: true }] },
      ],
    }),
  );
  assertEquals(description, 'Bench Press: 1 x 135\n\n1 exercise, 1 set, 320 kcal');
});

Deno.test('buildStrengthDescription prints top reps for bodyweight and longest hold for timed sets', () => {
  const description = buildStrengthDescription(
    strengthRow({
      exercises: [
        { exercise_id: 'pu', name: 'Pull Up', sets: [{ reps: 8 }, { reps: 10 }] },
        {
          exercise_id: 'plank',
          name: 'Plank',
          sets: [
            { kind: 'time', duration_sec: 45 },
            { kind: 'time', duration_sec: 60 },
          ],
        },
      ],
    }),
  );
  assertStringIncludes(description, 'Pull Up: 2 x 10 reps');
  assertStringIncludes(description, 'Plank: 2 x 60s');
});

Deno.test('buildStrengthDescription converts loads for metric users', () => {
  const description = buildStrengthDescription(strengthRow(), 'metric');
  assertStringIncludes(description, 'Bench Press: 3 x 61.2');
  assertStringIncludes(description, 'Overhead Press: 2 x 29.5');
});

Deno.test('buildStrengthDescription omits the calorie clause when calories are unknown', () => {
  const description = buildStrengthDescription(strengthRow({ calories: null }));
  assertStringIncludes(description, '2 exercises, 5 sets');
  assertEquals(description.includes('kcal'), false);
});
