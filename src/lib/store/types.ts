/**
 * Canonical app data types, shaped like the future Supabase tables so the
 * AsyncStorage-backed store can be swapped for real per-user tables later
 * without changing the screens that consume it.
 */

export type ExerciseKind = 'reps' | 'time';

/** One planned set within a `RoutineExercise`, independently editable so pyramid sets (different weight per set) are possible. */
export interface RoutineSet {
  id: string;
  isWarmup: boolean;
  reps?: number;
  weight?: number;
  durationSec?: number;
}

export interface RoutineExercise {
  id: string;
  name: string;
  kind?: ExerciseKind;
  sets: RoutineSet[];
  restSec?: number;
  lastTime: { reps?: number; weight?: number; durationSec?: number } | null;
  /** Anatome muscle slugs, resolved from the exercise-lookup search or a keyword fallback. */
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
}

export type WorkoutCategory = 'strength' | 'cardio';

/**
 * 'sport' was removed — it covered too many unlike activities to model. Rows
 * still holding it are coerced to 'other' on read (see remote.ts); the 0001
 * CHECK constraint still permits it, which is harmless since nothing writes it.
 */
export type CardioActivityType = 'walk' | 'run' | 'hike' | 'swim' | 'cycle' | 'other';

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
  /** Snapshotted from the routine exercise at session-save time (routines can change/be deleted later). */
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
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

/** One GPS fix recorded during a live-tracked cardio session. */
export interface GpsPoint {
  lat: number;
  lng: number;
  altitude?: number;
  t: number; // ms epoch
  /**
   * Elapsed *moving* ms at this fix — wall-clock time since the session
   * started, minus everything spent paused. Splits and pace read this rather
   * than `t` so a pause doesn't inflate whichever split it lands in. Absent on
   * routes recorded before pause existed; callers fall back to `t` deltas.
   */
  e?: number;
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
  /** Recorded route, present only for GPS-tracked sessions. */
  route?: GpsPoint[];
  /** Approximate — smoothed from GPS altitude samples, not barometer data. */
  elevationGainFt?: number;
  avgPaceSecPerMile?: number;
}

/**
 * How a goal's weekly progress is computed. The built-ins derive from logged
 * data; 'manual' goals count the user's own check-ins (goal_entries).
 */
export type GoalMetric = 'workouts' | 'calories' | 'cardio' | 'water' | 'steps' | 'bodyweight' | 'manual';

/** A single modular weekly-goal slot; the Dashboard renders one ring per active goal. */
export interface GoalDef {
  id: string;
  metric: GoalMetric;
  label: string;
  target: number;
  unit: string;
}

export type Goals = GoalDef[];

/** One manual check-in against a 'manual'-metric goal. */
export interface GoalEntry {
  id: string;
  goalId: string;
  date: string;
  amount: number;
}

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

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Macro totals; also the shape of a day's summed intake. */
export interface Macros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** One logged food (or recipe serving) on a date, nutrients snapshotted at log time. */
export interface FoodLogEntry extends Macros {
  id: string;
  date: string; // YYYY-MM-DD (local)
  meal: MealType;
  name: string;
  brand?: string;
  /** Amount logged, canonical grams; undefined for serving-based entries (recipes). */
  grams?: number;
}

/** Ingredient macros are for the amount used in the whole recipe. */
export interface RecipeIngredient extends Macros {
  id: string;
  name: string;
  grams?: number;
}

/**
 * How a recipe's macros are authored. `ingredients` itemises and sums;
 * `macros` takes the numbers straight off a nutrition label, for a branded
 * item that has nothing to itemise (a specific protein shake, say).
 */
export type RecipeEntryMode = 'ingredients' | 'macros';

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  entryMode: RecipeEntryMode;
  /**
   * Authoritative in `macros` mode — one serving's worth, as printed on the
   * label. Ignored in `ingredients` mode, where `ingredients` is authoritative.
   */
  perServing?: Macros;
  ingredients: RecipeIngredient[];
}

/** Daily intake targets; null until the user sets them. */
export type NutritionGoals = Macros;

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
  goalEntries: GoalEntry[];
  checkoffDefs: CheckoffDef[];
  checkoffLog: CheckoffLog;
  bodyweight: BodyweightEntry[];
  steps: StepsEntry[];
  waterEntries: WaterEntry[];
  measurementDefs: MeasurementDef[];
  measurementEntries: MeasurementEntry[];
  foodLogs: FoodLogEntry[];
  recipes: Recipe[];
  nutritionGoals: NutritionGoals | null;
  preferences: Preferences;
}
