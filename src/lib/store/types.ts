/**
 * Canonical app data types, shaped like the future Supabase tables so the
 * AsyncStorage-backed store can be swapped for real per-user tables later
 * without changing the screens that consume it.
 */

export interface RoutineExercise {
  id: string;
  name: string;
  sets: number;
  targetReps: number;
  targetWeight: number;
  lastTime: { reps: number; weight: number } | null;
}

export interface Routine {
  id: string;
  name: string;
  level: string;
  durationMinutes: number;
  tileColor: string;
  exercises: RoutineExercise[];
}

export interface SetLog {
  reps: number;
  weight: number;
}

export interface SessionExercise {
  exerciseId: string;
  name: string;
  sets: SetLog[];
}

/** A completed workout, with the sets actually performed. */
export interface Session {
  id: string;
  routineId: string | null;
  routineName: string;
  date: string; // YYYY-MM-DD (local)
  durationMinutes: number;
  calories?: number;
  exercises: SessionExercise[];
}

export interface Goals {
  workoutsPerWeek: number;
  calories: number;
  cardioMinutes: number;
}

/** A daily habit the user checks off (water, supplements, …). */
export interface CheckoffDef {
  id: string;
  name: string;
}

/** date key (YYYY-MM-DD) → ids of the defs completed that day. */
export type CheckoffLog = Record<string, string[]>;

export interface BodyweightEntry {
  date: string;
  weight: number;
}

export interface StepsEntry {
  date: string;
  steps: number;
}

export interface ProgressPoint {
  date: string;
  value: number;
}
