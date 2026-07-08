/**
 * Canonical app data types, shaped like the future Supabase tables so the
 * AsyncStorage-backed store can be swapped for real per-user tables later
 * without changing the screens that consume it.
 */

export type ExerciseKind = 'reps' | 'time';

export interface RoutineExercise {
  id: string;
  name: string;
  kind?: ExerciseKind;
  warmupSets?: number;
  warmupTargetReps?: number;
  warmupTargetWeight?: number;
  warmupTargetDurationSec?: number;
  warmupRestSec?: number;
  sets: number;
  targetReps: number;
  targetWeight: number;
  targetDurationSec?: number;
  targetRestSec?: number;
  lastTime: { reps?: number; weight?: number; durationSec?: number } | null;
}

export type WorkoutCategory = 'strength' | 'cardio';

export type CardioActivityType = 'walk' | 'run' | 'hike' | 'swim' | 'cycle' | 'sport' | 'other';

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Routine {
  id: string;
  category: WorkoutCategory;
  name: string;
  level: string;
  /** Strength: rough estimated session length. Cardio: target duration for the activity. */
  durationMinutes: number;
  tileColor: string;
  /** Scheduled weekdays, Monday = 1 through Sunday = 7. Empty or missing means unscheduled. */
  scheduledDays?: Weekday[];
  /** Strength only; empty for cardio routines. */
  exercises: RoutineExercise[];
  /** Cardio only. */
  activityType?: CardioActivityType;
  /** Cardio only, canonical miles. */
  targetDistanceMiles?: number;
}

export interface SetLog {
  kind?: ExerciseKind;
  reps?: number;
  weight?: number;
  durationSec?: number;
  isWarmup?: boolean;
  skipped?: boolean;
}

export interface SessionExercise {
  exerciseId: string;
  name: string;
  sets: SetLog[];
}

/** A completed strength workout, with the sets actually performed. */
export interface Session {
  id: string;
  routineId: string | null;
  routineName: string;
  date: string; // YYYY-MM-DD (local)
  durationMinutes: number;
  calories?: number;
  exercises: SessionExercise[];
}

/** A completed cardio workout. */
export interface CardioSession {
  id: string;
  routineId: string | null;
  name: string;
  activityType: CardioActivityType;
  date: string; // YYYY-MM-DD (local)
  minutes: number;
  distanceMiles?: number;
  calories?: number;
}

export type GoalType = 'workouts' | 'calories' | 'cardio' | 'water';

/** A single modular weekly-goal slot; the Dashboard renders one ring per active goal. */
export interface GoalDef {
  id: string; // === type ('workouts' | 'calories' | 'cardio' | 'water')
  type: GoalType;
  label: string;
  target: number;
  unit: string;
}

export type Goals = GoalDef[];

/** A daily habit the user checks off (supplements, stretching, …). */
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

/** Ounces of water logged at a point in time; multiple entries per day are summed. */
export interface WaterEntry {
  id: string;
  date: string;
  ounces: number;
}

/** A user-defined body measurement category (Waist, Chest, …) tracked over time. */
export interface MeasurementDef {
  id: string;
  label: string;
  unit: string;
}

export interface MeasurementEntry {
  id: string;
  date: string;
  label: string;
  value: number;
  unit: string;
}

export interface ProgressPoint {
  date: string;
  value: number;
}

export type UnitSystem = 'imperial' | 'metric';

export interface Preferences {
  unitSystem: UnitSystem;
}

/** Everything the store holds for one user; what StoreProvider hydrates. */
export interface StoreData {
  routines: Routine[];
  sessions: Session[];
  cardioSessions: CardioSession[];
  goals: Goals;
  checkoffDefs: CheckoffDef[];
  checkoffLog: CheckoffLog;
  bodyweight: BodyweightEntry[];
  steps: StepsEntry[];
  waterEntries: WaterEntry[];
  measurementDefs: MeasurementDef[];
  measurementEntries: MeasurementEntry[];
  preferences: Preferences;
}
