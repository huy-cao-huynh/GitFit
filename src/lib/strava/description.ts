import { ACTIVITY_LABELS } from '@/lib/activity-icons';
import type { CardioSession, Session, SessionExercise, SetLog, UnitSystem } from '@/lib/store/types';
import { toDisplayWeight } from '@/lib/units';

// Mirrors supabase/functions/_shared/description.ts, which builds what actually
// gets posted -- this copy only feeds the upload sheet's preview. Edge Functions
// can't import from src/, so keep the two in sync by hand.

/** "GitFit Run" / "5.02 mi • 8:21 /mi • 42 min" / "Elevation: 312 ft". Always imperial, like the server. */
export function buildCardioDescription(session: CardioSession): string {
  // The server labels "other" as "Cardio", not the picker's "Other".
  const label = session.activityType === 'other' ? 'Cardio' : ACTIVITY_LABELS[session.activityType];
  const statParts: string[] = [];
  if (session.distanceMiles != null && session.distanceMiles > 0) {
    statParts.push(`${session.distanceMiles.toFixed(2)} mi`);
  }
  if (session.avgPaceSecPerMile != null && session.avgPaceSecPerMile > 0) {
    const minutes = Math.floor(session.avgPaceSecPerMile / 60);
    const seconds = Math.round(session.avgPaceSecPerMile % 60);
    statParts.push(`${minutes}:${seconds.toString().padStart(2, '0')} /mi`);
  }
  statParts.push(`${session.minutes} min`);

  const lines = [`GitFit ${label}`, statParts.join(' • ')];
  if (session.elevationGainFt != null && session.elevationGainFt > 0) {
    lines.push(`Elevation: ${Math.round(session.elevationGainFt)} ft`);
  }
  return lines.join('\n');
}

function workingSets(exercise: SessionExercise): SetLog[] {
  return exercise.sets.filter((set) => !set.skipped && !set.isWarmup);
}

function formatLoad(lbs: number, unitSystem: UnitSystem): string {
  const value = toDisplayWeight(lbs, unitSystem);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatExerciseLine(exercise: SessionExercise, unitSystem: UnitSystem): string | null {
  const sets = workingSets(exercise);
  if (sets.length === 0) return null;

  const topWeight = Math.max(0, ...sets.map((set) => set.weight ?? 0));
  let load: string;
  if (topWeight > 0) {
    load = formatLoad(topWeight, unitSystem);
  } else if (sets.every((set) => set.kind === 'time')) {
    load = `${Math.max(0, ...sets.map((set) => set.durationSec ?? 0))}s`;
  } else {
    load = `${Math.max(0, ...sets.map((set) => set.reps ?? 0))} reps`;
  }
  return `${exercise.name}: ${sets.length} x ${load}`;
}

/** "Name: N x W" per exercise, then "E exercises, S sets, K kcal". */
export function buildStrengthDescription(session: Session, unitSystem: UnitSystem): string {
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
