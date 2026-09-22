import type { CardioSessionRow, SessionExerciseRow, SessionRow, SetLogRow } from './types.ts';

// Strength formatting is mirrored client-side in src/lib/strava/description.ts
// (for the upload sheet's preview) -- keep the two in sync by hand.

// Mirrors src/lib/activity-icons.ts's ACTIVITY_LABELS -- kept duplicated per
// this directory's self-contained-Edge-Function convention (see types.ts).
const ACTIVITY_LABELS: Record<CardioSessionRow['activity_type'], string> = {
  walk: 'Walk',
  run: 'Run',
  hike: 'Hike',
  swim: 'Swim',
  cycle: 'Cycle',
  other: 'Cardio',
};

function formatPaceSecPerMile(secPerMile: number): string {
  const minutes = Math.floor(secPerMile / 60);
  const seconds = Math.round(secPerMile % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} /mi`;
}

/**
 * Builds the default Strava description for a cardio session, e.g.
 * "GitFit Run\n5.02 mi • 8:21 /mi • 42 min\nElevation: 312 ft". Uses whole
 * minutes (not mm:ss) because cardio_sessions.minutes is stored rounded --
 * GitFit never persists exact elapsed seconds for a cardio session, so a
 * clock-format duration here would imply false precision. Omits any line
 * whose underlying data is absent.
 */
export function buildCardioDescription(session: CardioSessionRow): string {
  const label = ACTIVITY_LABELS[session.activity_type];
  const statParts: string[] = [];
  if (session.distance_miles != null && session.distance_miles > 0) {
    statParts.push(`${session.distance_miles.toFixed(2)} mi`);
  }
  if (session.avg_pace_sec_per_mile != null && session.avg_pace_sec_per_mile > 0) {
    statParts.push(formatPaceSecPerMile(session.avg_pace_sec_per_mile));
  }
  statParts.push(`${session.minutes} min`);

  const lines = [`GitFit ${label}`, statParts.join(' • ')];
  if (session.elevation_gain_ft != null && session.elevation_gain_ft > 0) {
    lines.push(`Elevation: ${Math.round(session.elevation_gain_ft)} ft`);
  }
  return lines.join('\n');
}

export type UnitSystem = 'imperial' | 'metric';

// Mirrors src/lib/units.ts -- canonical storage is always lbs.
const LB_PER_KG = 2.20462;

/** Whole numbers print bare ("60"), fractional loads keep one decimal ("62.5"). */
function formatLoad(lbs: number, unitSystem: UnitSystem): string {
  const value = unitSystem === 'metric' ? lbs / LB_PER_KG : lbs;
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Sets that count toward what was actually done: not skipped, not a warm-up. */
export function workingSets(exercise: SessionExerciseRow): SetLogRow[] {
  return exercise.sets.filter((set) => !set.skipped && !set.is_warmup);
}

/**
 * One "Name: N x W" line. W is the heaviest working weight (mixed loads read
 * as the top set), falling back to the top reps for bodyweight work and the
 * longest hold for timed sets. Null when every set was skipped.
 */
function formatExerciseLine(exercise: SessionExerciseRow, unitSystem: UnitSystem): string | null {
  const sets = workingSets(exercise);
  if (sets.length === 0) return null;

  const topWeight = Math.max(0, ...sets.map((set) => set.weight ?? 0));
  let load: string;
  if (topWeight > 0) {
    load = formatLoad(topWeight, unitSystem);
  } else if (sets.every((set) => set.kind === 'time')) {
    load = `${Math.max(0, ...sets.map((set) => set.duration_sec ?? 0))}s`;
  } else {
    load = `${Math.max(0, ...sets.map((set) => set.reps ?? 0))} reps`;
  }
  return `${exercise.name}: ${sets.length} x ${load}`;
}

/**
 * Builds the default Strava description for a strength session, e.g.
 * "Incline Dumbbell Press: 3 x 60\nShoulder Press: 3 x 50\n\n2 exercises, 6 sets, 300 kcal".
 * Leaves out the routine name (it's the activity title) and the duration
 * (it's the activity's elapsed time). Warm-ups don't count, so the footer's
 * set total always equals the sum of the per-exercise counts above it.
 */
export function buildStrengthDescription(session: SessionRow, unitSystem: UnitSystem = 'imperial'): string {
  const lines = session.exercises
    .map((exercise) => formatExerciseLine(exercise, unitSystem))
    .filter((line): line is string => line != null);
  const exerciseCount = lines.length;
  const setCount = session.exercises.reduce((sum, exercise) => sum + workingSets(exercise).length, 0);

  const footerParts = [
    `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}`,
    `${setCount} set${setCount === 1 ? '' : 's'}`,
  ];
  if (session.calories != null && session.calories > 0) {
    footerParts.push(`${Math.round(session.calories)} kcal`);
  }

  return [...lines, '', footerParts.join(', ')].join('\n').trim();
}
