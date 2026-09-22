import { workingSets } from './description.ts';
import { stravaExerciseTypeFor } from './exercise-type.ts';
import type { SessionRow } from './types.ts';

const LB_PER_KG = 2.20462;

/** One set in Strava's WeightTraining JSON upload format. */
export interface StravaJsonSet {
  exercise_type: string;
  repetitions?: number;
  weight?: number; // kg
  duration?: number; // seconds
}

/** Strava's WeightTraining JSON upload file (developers.strava.com/docs/uploads, data_type=json). */
export interface StravaStrengthJson {
  version: '1.0';
  start_time: string;
  utc_offset: number;
  elapsed_time: number;
  total_calories?: number;
  creator: { name: string };
  sets: StravaJsonSet[];
}

/**
 * GitFit stores a session's date but not its clock time. A session from
 * (the user's) today most likely just ended, so it's placed ending now;
 * older ones start at local noon. `utcOffsetSec` is seconds east of UTC,
 * e.g. -25200 for PDT. Returns a UTC ISO timestamp.
 */
export function resolveStartTimeUtc(dateKey: string, elapsedSec: number, utcOffsetSec: number, now = new Date()): string {
  const localToday = new Date(now.getTime() + utcOffsetSec * 1000).toISOString().slice(0, 10);
  if (dateKey === localToday) {
    return new Date(now.getTime() - elapsedSec * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  const localNoonAsUtc = Date.parse(`${dateKey}T12:00:00Z`);
  return new Date(localNoonAsUtc - utcOffsetSec * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Builds the JSON file Strava turns into its native strength view (Volume /
 * Sets / Reps stats, the per-exercise set log, and the muscle map). Sends the
 * same working sets the description lists -- no skipped sets and no
 * warm-ups -- so Strava's set count matches the description's. Bodyweight
 * sets omit `weight` rather than sending 0.
 */
export function buildStrengthUploadJson(
  session: SessionRow,
  options: { utcOffsetSec: number; now?: Date },
): StravaStrengthJson {
  const elapsedSec = Math.max(60, Math.round(session.duration_minutes * 60));
  const sets: StravaJsonSet[] = [];
  for (const exercise of session.exercises) {
    const exerciseType = stravaExerciseTypeFor(exercise.name);
    for (const set of workingSets(exercise)) {
      const jsonSet: StravaJsonSet = { exercise_type: exerciseType };
      if (set.kind === 'time') {
        if (set.duration_sec != null && set.duration_sec > 0) jsonSet.duration = Math.round(set.duration_sec);
      } else if (set.reps != null && set.reps > 0) {
        jsonSet.repetitions = Math.round(set.reps);
      }
      if (set.weight != null && set.weight > 0) {
        jsonSet.weight = Math.round((set.weight / LB_PER_KG) * 100) / 100;
      }
      sets.push(jsonSet);
    }
  }

  const upload: StravaStrengthJson = {
    version: '1.0',
    start_time: resolveStartTimeUtc(session.date, elapsedSec, options.utcOffsetSec, options.now),
    utc_offset: options.utcOffsetSec,
    elapsed_time: elapsedSec,
    creator: { name: 'GitFit' },
    sets,
  };
  if (session.calories != null && session.calories > 0) upload.total_calories = Math.round(session.calories);
  return upload;
}
