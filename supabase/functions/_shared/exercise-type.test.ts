import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { FALLBACK_EXERCISE_TYPE, stravaExerciseTypeFor } from './exercise-type.ts';

const CASES: [string, string][] = [
  // The push-day example, misspelling included.
  ['Incline Dumbell Press', 'INCLINE_DUMBBELL_BENCH_PRESS'],
  ['Shoulder Press', 'SHOULDER_PRESS_GENERIC'],
  ['Chest Flys', 'DUMBBELL_FLYE'],
  ['Lateral Raises', 'LATERAL_RAISE_GENERIC'],
  ['Tricep Extension', 'TRICEPS_EXTENSION_GENERIC'],
  // Specific-before-generic ordering.
  ['Bench Press', 'BARBELL_BENCH_PRESS'],
  ['Dumbbell Bench Press', 'DUMBBELL_BENCH_PRESS'],
  ['Incline Bench Press', 'INCLINE_BARBELL_BENCH_PRESS'],
  ['Incline Push Up', 'INCLINE_PUSH_UP'],
  ['Incline Dumbbell Curl', 'INCLINE_DUMBBELL_BICEPS_CURL'],
  ['Incline Dumbbell Fly', 'INCLINE_DUMBBELL_FLYE'],
  ['Bench Dip', 'BENCH_DIP'],
  ['Chest Supported Row', 'CHEST_SUPPORTED_ROW'],
  ['Leg Extension', 'MACHINE_LEG_EXTENSION'],
  ['Seated Leg Curl', 'MACHINE_LEG_CURL_SEATED'],
  ['Hammer Curl', 'DUMBBELL_HAMMER_CURL'],
  ['Barbell Curl', 'BARBELL_BICEPS_CURL'],
  ['Rear Delt Fly', 'DUMBBELL_REAR_DELT_FLY'],
  ['Cable Fly', 'CABLE_CROSSOVER'],
  ['Upright Row', 'BARBELL_UPRIGHT_ROW'],
  ['Face Pulls', 'FACE_PULL'],
  ['Overhead Press', 'OVERHEAD_BARBELL_PRESS'],
  ['Seated Dumbbell Shoulder Press', 'SEATED_DUMBBELL_SHOULDER_PRESS'],
  ['Dumbbell Press', 'DUMBBELL_BENCH_PRESS'],
  ['Tricep Pushdown', 'CABLE_TRICEPS_PUSHDOWN'],
  ['Overhead Cable Tricep Extension', 'CABLE_OVERHEAD_TRICEPS_EXTENSION'],
  ['Lat Pulldown', 'LAT_PULLDOWN'],
  ['Pull-Ups', 'PULL_UP_GENERIC'],
  ['Seated Cable Row', 'SEATED_CABLE_ROW'],
  ['Barbell Row', 'BENT_OVER_BARBELL_ROW'],
  ['One Arm Row', 'DUMBBELL_ROW'],
  ['Back Squat', 'BARBELL_BACK_SQUAT'],
  ['Bulgarian Split Squat', 'DUMBBELL_BULGARIAN_SPLIT_SQUATS'],
  ['Leg Press', 'MACHINE_LEG_PRESS'],
  ['RDL', 'BARBELL_ROMANIAN_DEADLIFT'],
  ['Deadlift', 'BARBELL_DEADLIFT'],
  ['Hip Thrust', 'BARBELL_HIP_THRUST'],
  ['Calf Raises', 'STANDING_CALF_RAISE'],
  ['Walking Lunges', 'WALKING_LUNGE'],
  ['Plank', 'PLANK_GENERIC'],
  ['Hanging Leg Raise', 'LEG_RAISE_GENERIC'],
  ['Kettlebell Swing', 'HIP_SWING_GENERIC'],
];

Deno.test('stravaExerciseTypeFor maps common gym names to Strava exercise types', () => {
  for (const [name, expected] of CASES) {
    assertEquals(stravaExerciseTypeFor(name), expected, name);
  }
});

Deno.test('stravaExerciseTypeFor falls back to a total-body type for unknown names', () => {
  assertEquals(stravaExerciseTypeFor('Grandma Carry-In Groceries'), 'CARRY_GENERIC');
  assertEquals(stravaExerciseTypeFor('Mystery Machine'), FALLBACK_EXERCISE_TYPE);
});
