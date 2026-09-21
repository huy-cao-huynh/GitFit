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

Deno.test('buildStrengthDescription summarizes exercises, sets, total weight, and calories', () => {
  const description = buildStrengthDescription(strengthRow());
  assertEquals(
    description,
    'GitFit Strength Training\nPush Day • 42 min • 2 exercises, 5 sets\n4,270 lb total • ~320 kcal',
  );
});

Deno.test('buildStrengthDescription excludes skipped sets from weight and set totals', () => {
  const description = buildStrengthDescription(
    strengthRow({
      exercises: [
        {
          exercise_id: 'bench',
          name: 'Bench Press',
          sets: [
            { weight: 135, reps: 8 },
            { skipped: true },
          ],
        },
      ],
    }),
  );
  assertEquals(description, 'GitFit Strength Training\nPush Day • 42 min • 1 exercise, 1 set\n1,080 lb total • ~320 kcal');
});

Deno.test('buildStrengthDescription omits the calorie clause when calories are unknown', () => {
  const description = buildStrengthDescription(strengthRow({ calories: null }));
  assertStringIncludes(description, '4,270 lb total');
  assertEquals(description.includes('kcal'), false);
});
