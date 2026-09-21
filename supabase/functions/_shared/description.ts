import type { CardioSessionRow, SessionRow } from './types.ts';

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

function totalWeightLifted(session: SessionRow): number {
  let total = 0;
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (set.skipped || set.weight == null || set.reps == null) continue;
      total += set.weight * set.reps;
    }
  }
  return total;
}

function totalSetCount(session: SessionRow): number {
  return session.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => !set.skipped).length,
    0,
  );
}

/**
 * Builds the default Strava description for a strength session, e.g.
 * "GitFit Strength Training\nPush Day • 42 min • 5 exercises, 18 sets\n412 lb total • ~320 kcal".
 * Omits the calorie clause when calories weren't estimated for the session.
 */
export function buildStrengthDescription(session: SessionRow): string {
  const exerciseCount = session.exercises.length;
  const setCount = totalSetCount(session);
  const totalWeight = totalWeightLifted(session);

  const summaryParts = [
    session.routine_name,
    `${session.duration_minutes} min`,
    `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}, ${setCount} set${setCount === 1 ? '' : 's'}`,
  ];

  const statParts = [`${Math.round(totalWeight).toLocaleString('en-US')} lb total`];
  if (session.calories != null && session.calories > 0) {
    statParts.push(`~${Math.round(session.calories)} kcal`);
  }

  return ['GitFit Strength Training', summaryParts.join(' • '), statParts.join(' • ')].join('\n');
}
