import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RoutineExercise, SessionExercise } from '@/lib/store/types';

/** Mirrors `SessionPhase` in `src/app/workout/[id].tsx`, duplicated to avoid importing a route module. */
export type PersistedSessionPhase = 'exerciseReady' | 'setPending' | 'setActive' | 'setLogging' | 'resting' | 'finished';

export interface PersistedWorkoutExercise extends RoutineExercise {
  restSec: number;
}

export interface WorkoutSessionSnapshot {
  savedAt: number;
  order: PersistedWorkoutExercise[];
  phase: PersistedSessionPhase;
  exerciseIndex: number;
  setIndex: number;
  logged: SessionExercise[];
  startedAt: number | null;
  reps: number;
  weight: number;
  durationSec: number;
  setStartedAt: number | null;
  phaseEndsAt: number | null;
}

const KEY_PREFIX = 'workout-session:';
/** Don't silently resume a session abandoned hours ago. */
const MAX_RESUME_AGE_MS = 6 * 60 * 60 * 1000;

export async function saveWorkoutSession(routineId: string, snapshot: WorkoutSessionSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PREFIX + routineId, JSON.stringify(snapshot));
  } catch {
    // Best-effort — losing a resume snapshot shouldn't break the workout.
  }
}

export async function loadWorkoutSession(routineId: string): Promise<WorkoutSessionSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + routineId);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as WorkoutSessionSnapshot;
    if (snapshot.phase === 'finished') return null;
    if (Date.now() - snapshot.savedAt > MAX_RESUME_AGE_MS) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export async function clearWorkoutSession(routineId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY_PREFIX + routineId);
  } catch {
    // Nothing to do — a stale snapshot will just fail its age check next time.
  }
}
