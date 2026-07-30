/**
 * Supabase-backed persistence for the store: fetches the whole per-user
 * dataset on hydrate and mirrors each StoreProvider mutator with a write.
 * Row shapes are snake_case (see supabase/migrations/0001_initial_schema.sql);
 * the app-facing types in ./types are unchanged.
 */

import { supabase } from '@/lib/supabase';

import { makeId } from './id';
import type {
  BodyweightEntry,
  CardioActivityType,
  CardioSession,
  CheckoffDef,
  CheckoffLog,
  ExerciseKind,
  FoodLogEntry,
  GoalDef,
  GoalEntry,
  GoalMetric,
  Goals,
  GpsPoint,
  MealType,
  MeasurementDef,
  MeasurementEntry,
  NutritionGoals,
  Preferences,
  Recipe,
  RecipeIngredient,
  Routine,
  RoutineExercise,
  RoutineSet,
  Session,
  SetLog,
  StepsEntry,
  StoreData,
  UnitSystem,
  WaterEntry,
  Weekday,
} from './types';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

interface RoutineExerciseSetRow {
  id: string;
  routine_exercise_id: string;
  position: number;
  is_warmup: boolean;
  reps: number | null;
  weight: number | null;
  duration_sec: number | null;
}

interface RoutineExerciseRow {
  id: string;
  routine_id: string;
  position: number;
  name: string;
  kind: ExerciseKind;
  rest_sec: number | null;
  last_reps: number | null;
  last_weight: number | null;
  last_duration_sec: number | null;
  routine_exercise_sets: RoutineExerciseSetRow[];
}

interface RoutineRow {
  id: string;
  category: 'strength' | 'cardio';
  name: string;
  level: string;
  duration_minutes: number;
  tile_color: string;
  scheduled_days: number[] | null;
  activity_type: CardioActivityType | null;
  routine_exercises: RoutineExerciseRow[];
}

interface SessionSetRow {
  id: string;
  session_exercise_id: string;
  position: number;
  kind: ExerciseKind | null;
  reps: number | null;
  weight: number | null;
  duration_sec: number | null;
  is_warmup: boolean;
  skipped: boolean;
}

interface SessionExerciseRow {
  id: string;
  session_id: string;
  position: number;
  exercise_id: string;
  name: string;
  session_sets: SessionSetRow[];
}

interface SessionRow {
  id: string;
  routine_id: string | null;
  routine_name: string;
  date: string;
  duration_minutes: number;
  calories: number | null;
  session_exercises: SessionExerciseRow[];
}

interface CardioSessionRow {
  id: string;
  routine_id: string | null;
  name: string;
  activity_type: CardioActivityType;
  date: string;
  minutes: number;
  distance_miles: number | null;
  calories: number | null;
  route: GpsPoint[] | null;
  elevation_gain_ft: number | null;
  avg_pace_sec_per_mile: number | null;
}

interface GoalRow {
  id?: string;
  metric?: GoalMetric;
  label: string;
  target: number;
  unit: string;
  position?: number;
  /** Pre-0006 rows only: the enum word that was both the id and the metric. */
  type?: string;
}

interface GoalEntryRow {
  id: string;
  goal_id: string;
  date: string;
  amount: number;
}

interface CheckoffDefRow {
  id: string;
  name: string;
}

interface CheckoffLogRow {
  date: string;
  checkoff_def_id: string;
}

interface WaterEntryRow {
  id: string;
  date: string;
  ounces: number;
}

interface MeasurementDefRow {
  id: string;
  label: string;
  unit: string;
}

interface MeasurementEntryRow {
  id: string;
  date: string;
  label: string;
  value: number;
  unit: string;
}

interface FoodLogRow {
  id: string;
  date: string;
  meal: MealType;
  name: string;
  brand: string | null;
  grams: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface RecipeIngredientRow {
  id: string;
  recipe_id: string;
  position: number;
  name: string;
  grams: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface RecipeRow {
  id: string;
  name: string;
  servings: number;
  recipe_ingredients: RecipeIngredientRow[];
}

interface NutritionGoalsRow {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

// ---------------------------------------------------------------------------
// Row -> app-type mapping
// ---------------------------------------------------------------------------

function byPosition<T extends { position: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.position - b.position);
}

function mapRoutineSet(row: RoutineExerciseSetRow): RoutineSet {
  return {
    id: row.id,
    isWarmup: row.is_warmup,
    reps: row.reps ?? undefined,
    weight: row.weight ?? undefined,
    durationSec: row.duration_sec ?? undefined,
  };
}

function mapRoutineExercise(row: RoutineExerciseRow): RoutineExercise {
  const hasLastTime =
    row.last_reps !== null || row.last_weight !== null || row.last_duration_sec !== null;
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    sets: byPosition(row.routine_exercise_sets).map(mapRoutineSet),
    restSec: row.rest_sec ?? undefined,
    lastTime: hasLastTime
      ? {
          reps: row.last_reps ?? undefined,
          weight: row.last_weight ?? undefined,
          durationSec: row.last_duration_sec ?? undefined,
        }
      : null,
  };
}

function mapRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    level: row.level,
    durationMinutes: row.duration_minutes,
    tileColor: row.tile_color,
    scheduledDays: row.scheduled_days ? (row.scheduled_days as Weekday[]) : undefined,
    exercises: byPosition(row.routine_exercises).map(mapRoutineExercise),
    activityType: row.activity_type ? normalizeActivityType(row.activity_type) : undefined,
  };
}

function mapSetLog(row: SessionSetRow): SetLog {
  return {
    kind: row.kind ?? undefined,
    reps: row.reps ?? undefined,
    weight: row.weight ?? undefined,
    durationSec: row.duration_sec ?? undefined,
    isWarmup: row.is_warmup || undefined,
    skipped: row.skipped || undefined,
  };
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    routineId: row.routine_id,
    routineName: row.routine_name,
    date: row.date,
    durationMinutes: row.duration_minutes,
    calories: row.calories ?? undefined,
    exercises: byPosition(row.session_exercises).map((exercise) => ({
      exerciseId: exercise.exercise_id,
      name: exercise.name,
      sets: byPosition(exercise.session_sets).map(mapSetLog),
    })),
  };
}

const KNOWN_ACTIVITY_TYPES: readonly CardioActivityType[] = ['walk', 'run', 'hike', 'swim', 'cycle', 'other'];

/**
 * Coerce retired activity types to 'other'. 'sport' was removed from the app
 * but the 0001 CHECK constraint still permits it, so old rows can still come
 * back holding it — and an unrecognised value would index straight past
 * ACTIVITY_ICONS and the calorie table into undefined.
 */
function normalizeActivityType(value: CardioActivityType): CardioActivityType {
  return KNOWN_ACTIVITY_TYPES.includes(value) ? value : 'other';
}

function mapCardioSession(row: CardioSessionRow): CardioSession {
  return {
    id: row.id,
    routineId: row.routine_id,
    name: row.name,
    activityType: normalizeActivityType(row.activity_type),
    date: row.date,
    minutes: row.minutes,
    distanceMiles: row.distance_miles ?? undefined,
    calories: row.calories ?? undefined,
    route: row.route ?? undefined,
    elevationGainFt: row.elevation_gain_ft ?? undefined,
    avgPaceSecPerMile: row.avg_pace_sec_per_mile ?? undefined,
  };
}

/** Ordering/metric fallback for rows from before migration 0006. */
const LEGACY_GOAL_ORDER = ['workouts', 'calories', 'cardio', 'water'];

function isGoalMetric(value: string | undefined): value is GoalMetric {
  return value !== undefined && (LEGACY_GOAL_ORDER.includes(value) || value === 'manual');
}

/**
 * Tolerates pre-0006 rows (no id/metric/position, an enum-word `type`) so a
 * project that hasn't applied the migration still reads its goals; writes to
 * the old shape fail with a warn, matching the fire-and-forget contract.
 */
function mapGoals(rows: GoalRow[]): Goals {
  const order = (row: GoalRow) => row.position ?? LEGACY_GOAL_ORDER.indexOf(row.type ?? '');
  return [...rows].sort((a, b) => order(a) - order(b)).map((row) => ({
    id: row.id ?? row.type ?? makeId(),
    metric: row.metric ?? (isGoalMetric(row.type) ? row.type : 'manual'),
    label: row.label,
    target: row.target,
    unit: row.unit,
  }));
}

function mapCheckoffLog(rows: CheckoffLogRow[]): CheckoffLog {
  const log: CheckoffLog = {};
  for (const row of rows) {
    (log[row.date] ??= []).push(row.checkoff_def_id);
  }
  return log;
}

function mapFoodLog(row: FoodLogRow): FoodLogEntry {
  return {
    id: row.id,
    date: row.date,
    meal: row.meal,
    name: row.name,
    brand: row.brand ?? undefined,
    grams: row.grams ?? undefined,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
  };
}

function mapRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    name: row.name,
    servings: row.servings,
    ingredients: byPosition(row.recipe_ingredients).map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      grams: ingredient.grams ?? undefined,
      calories: ingredient.calories,
      proteinG: ingredient.protein_g,
      carbsG: ingredient.carbs_g,
      fatG: ingredient.fat_g,
    })),
  };
}

function mapNutritionGoals(row: NutritionGoalsRow | null): NutritionGoals | null {
  if (!row) return null;
  return { calories: row.calories, proteinG: row.protein_g, carbsG: row.carbs_g, fatG: row.fat_g };
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('Supabase returned no data');
  return result.data;
}

/**
 * Nutrition tables arrived in migration 0005; fetch them separately so a
 * project that hasn't applied it yet degrades to empty nutrition slices
 * instead of failing the whole hydration.
 */
async function fetchNutritionData(): Promise<
  Pick<StoreData, 'foodLogs' | 'recipes' | 'nutritionGoals'>
> {
  try {
    const [foodLogs, recipes, nutritionGoals] = await Promise.all([
      supabase
        .from('food_logs')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at')
        .returns<FoodLogRow[]>(),
      supabase
        .from('recipes')
        .select('*, recipe_ingredients(*)')
        .order('position')
        .returns<RecipeRow[]>(),
      supabase.from('nutrition_goals').select('*').maybeSingle<NutritionGoalsRow>(),
    ]);
    return {
      foodLogs: unwrap(foodLogs).map(mapFoodLog),
      recipes: unwrap(recipes).map(mapRecipe),
      nutritionGoals: mapNutritionGoals(nutritionGoals.error ? null : nutritionGoals.data),
    };
  } catch (error) {
    console.warn('Failed to fetch nutrition data (migration 0005 applied?)', error);
    return { foodLogs: [], recipes: [], nutritionGoals: null };
  }
}

/**
 * goal_entries arrived in migration 0006; fetch it separately so a project
 * that hasn't applied it yet degrades to no check-ins instead of failing
 * hydration (the goals select itself tolerates the old shape via mapGoals).
 */
async function fetchGoalEntries(): Promise<GoalEntry[]> {
  try {
    const rows = unwrap(
      await supabase
        .from('goal_entries')
        .select('id, goal_id, date, amount')
        .order('date', { ascending: false })
        .returns<GoalEntryRow[]>(),
    );
    return rows.map((row) => ({ id: row.id, goalId: row.goal_id, date: row.date, amount: row.amount }));
  } catch (error) {
    console.warn('Failed to fetch goal entries (migration 0006 applied?)', error);
    return [];
  }
}

/** Loads the user's entire store in parallel; throws on the first failure. */
export async function fetchStoreData(): Promise<StoreData> {
  const nutritionPromise = fetchNutritionData();
  const goalEntriesPromise = fetchGoalEntries();
  const [
    profile,
    routines,
    sessions,
    cardioSessions,
    goals,
    checkoffDefs,
    checkoffLog,
    bodyweight,
    steps,
    waterEntries,
    measurementDefs,
    measurementEntries,
  ] = await Promise.all([
    supabase.from('profiles').select('unit_system').maybeSingle<{ unit_system: UnitSystem }>(),
    supabase
      .from('routines')
      .select('*, routine_exercises(*, routine_exercise_sets(*))')
      .order('created_at')
      .returns<RoutineRow[]>(),
    supabase
      .from('sessions')
      .select('*, session_exercises(*, session_sets(*))')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<SessionRow[]>(),
    supabase
      .from('cardio_sessions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<CardioSessionRow[]>(),
    supabase.from('goals').select('*').returns<GoalRow[]>(),
    supabase.from('checkoff_defs').select('*').order('position').returns<CheckoffDefRow[]>(),
    supabase.from('checkoff_log').select('date, checkoff_def_id').returns<CheckoffLogRow[]>(),
    supabase.from('bodyweight_entries').select('date, weight').order('date').returns<BodyweightEntry[]>(),
    supabase.from('steps_entries').select('date, steps').order('date').returns<StepsEntry[]>(),
    supabase
      .from('water_entries')
      .select('id, date, ounces')
      .order('date', { ascending: false })
      .returns<WaterEntryRow[]>(),
    supabase.from('measurement_defs').select('*').order('position').returns<MeasurementDefRow[]>(),
    supabase
      .from('measurement_entries')
      .select('*')
      .order('date', { ascending: false })
      .returns<MeasurementEntryRow[]>(),
  ]);

  return {
    routines: unwrap(routines).map(mapRoutine),
    sessions: unwrap(sessions).map(mapSession),
    cardioSessions: unwrap(cardioSessions).map(mapCardioSession),
    goals: mapGoals(unwrap(goals)),
    goalEntries: await goalEntriesPromise,
    checkoffDefs: unwrap(checkoffDefs).map(({ id, name }) => ({ id, name })),
    checkoffLog: mapCheckoffLog(unwrap(checkoffLog)),
    bodyweight: unwrap(bodyweight),
    steps: unwrap(steps),
    waterEntries: unwrap(waterEntries),
    measurementDefs: unwrap(measurementDefs).map(({ id, label, unit }) => ({ id, label, unit })),
    measurementEntries: unwrap(measurementEntries),
    ...(await nutritionPromise),
    // The migration's trigger/backfill guarantees a profile row; fall back
    // to the default rather than failing hydration if it's somehow missing.
    preferences: { unitSystem: profile.data?.unit_system ?? 'imperial' },
  };
}

// ---------------------------------------------------------------------------
// Writes (one per StoreProvider mutator). All throw on failure; the provider
// treats them as fire-and-forget and only warns, matching the old saveJSON.
// ---------------------------------------------------------------------------

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function routineToRow(routine: Routine) {
  return {
    id: routine.id,
    category: routine.category,
    name: routine.name,
    level: routine.level,
    duration_minutes: routine.durationMinutes,
    tile_color: routine.tileColor,
    scheduled_days: routine.scheduledDays ?? null,
    activity_type: routine.activityType ?? null,
  };
}

function routineExerciseToRow(routineId: string, exercise: RoutineExercise, position: number) {
  return {
    id: exercise.id,
    routine_id: routineId,
    position,
    name: exercise.name,
    kind: exercise.kind ?? 'reps',
    rest_sec: exercise.restSec ?? null,
    last_reps: exercise.lastTime?.reps ?? null,
    last_weight: exercise.lastTime?.weight ?? null,
    last_duration_sec: exercise.lastTime?.durationSec ?? null,
  };
}

function routineExerciseSetToRow(routineExerciseId: string, set: RoutineSet, position: number) {
  return {
    id: set.id,
    routine_exercise_id: routineExerciseId,
    position,
    is_warmup: set.isWarmup,
    reps: set.reps ?? null,
    weight: set.weight ?? null,
    duration_sec: set.durationSec ?? null,
  };
}

async function insertRoutineExercises(routine: Routine): Promise<void> {
  if (routine.exercises.length === 0) return;
  const rows = routine.exercises.map((exercise, index) =>
    routineExerciseToRow(routine.id, exercise, index),
  );
  const { error } = await supabase.from('routine_exercises').insert(rows);
  throwIfError(error);

  const setRows = routine.exercises.flatMap((exercise) =>
    exercise.sets.map((set, setIndex) => routineExerciseSetToRow(exercise.id, set, setIndex)),
  );
  if (setRows.length === 0) return;
  const { error: setsError } = await supabase.from('routine_exercise_sets').insert(setRows);
  throwIfError(setsError);
}

export async function insertRoutine(routine: Routine): Promise<void> {
  const { error } = await supabase.from('routines').insert(routineToRow(routine));
  throwIfError(error);
  await insertRoutineExercises(routine);
}

export async function updateRoutine(routine: Routine): Promise<void> {
  const { error } = await supabase.from('routines').update(routineToRow(routine)).eq('id', routine.id);
  throwIfError(error);
  // Replace strategy: exercises are few and ids are preserved by the editor.
  const { error: deleteError } = await supabase
    .from('routine_exercises')
    .delete()
    .eq('routine_id', routine.id);
  throwIfError(deleteError);
  await insertRoutineExercises(routine);
}

export async function deleteRoutine(id: string): Promise<void> {
  const { error } = await supabase.from('routines').delete().eq('id', id);
  throwIfError(error);
}

export async function insertSession(session: Session): Promise<void> {
  // Three dependent inserts (session -> exercises -> sets); not atomic, which
  // is acceptable for a single-user app — a mid-write failure leaves a
  // partial session rather than corrupting anything.
  const { error } = await supabase.from('sessions').insert({
    id: session.id,
    routine_id: session.routineId,
    routine_name: session.routineName,
    date: session.date,
    duration_minutes: session.durationMinutes,
    calories: session.calories ?? null,
  });
  throwIfError(error);

  const exerciseRows = session.exercises.map((exercise, index) => ({
    id: makeId(),
    session_id: session.id,
    position: index,
    exercise_id: exercise.exerciseId,
    name: exercise.name,
  }));
  if (exerciseRows.length === 0) return;
  const { error: exerciseError } = await supabase.from('session_exercises').insert(exerciseRows);
  throwIfError(exerciseError);

  const setRows = session.exercises.flatMap((exercise, exerciseIndex) =>
    exercise.sets.map((set, setIndex) => ({
      id: makeId(),
      session_exercise_id: exerciseRows[exerciseIndex].id,
      position: setIndex,
      kind: set.kind ?? null,
      reps: set.reps ?? null,
      weight: set.weight ?? null,
      duration_sec: set.durationSec ?? null,
      is_warmup: set.isWarmup ?? false,
      skipped: set.skipped ?? false,
    })),
  );
  if (setRows.length === 0) return;
  const { error: setsError } = await supabase.from('session_sets').insert(setRows);
  throwIfError(setsError);
}

export async function insertCardioSession(session: CardioSession): Promise<void> {
  const { error } = await supabase.from('cardio_sessions').insert({
    id: session.id,
    routine_id: session.routineId,
    name: session.name,
    activity_type: session.activityType,
    date: session.date,
    minutes: session.minutes,
    distance_miles: session.distanceMiles ?? null,
    calories: session.calories ?? null,
    route: session.route ?? null,
    elevation_gain_ft: session.elevationGainFt ?? null,
    avg_pace_sec_per_mile: session.avgPaceSecPerMile ?? null,
  });
  throwIfError(error);
}

/** PostgREST `in` list with each value quoted, so arbitrary ids can't break the filter. */
function quotedIdList(ids: string[]): string {
  return `(${ids.map((id) => `"${id.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`).join(',')})`;
}

function goalToRow(goal: GoalDef, position: number) {
  return {
    id: goal.id,
    metric: goal.metric,
    label: goal.label,
    target: goal.target,
    unit: goal.unit,
    position,
  };
}

/** Upsert + delete-missing; deleting a goal cascades its goal_entries rows. */
export async function setGoals(goals: Goals): Promise<void> {
  const remove = supabase.from('goals').delete();
  const { error: deleteError } = goals.length
    ? await remove.not('id', 'in', quotedIdList(goals.map((goal) => goal.id)))
    : await remove.gte('position', 0);
  throwIfError(deleteError);
  if (goals.length === 0) return;
  const { error } = await supabase.from('goals').upsert(goals.map(goalToRow));
  throwIfError(error);
}

export async function insertGoalEntry(entry: GoalEntry): Promise<void> {
  const { error } = await supabase
    .from('goal_entries')
    .upsert({ id: entry.id, goal_id: entry.goalId, date: entry.date, amount: entry.amount });
  throwIfError(error);
}

/** Upsert + delete-missing; deleting a def cascades its checkoff_log rows. */
export async function setCheckoffDefs(defs: CheckoffDef[]): Promise<void> {
  const remove = supabase.from('checkoff_defs').delete();
  const { error: deleteError } = defs.length
    ? await remove.not('id', 'in', quotedIdList(defs.map((def) => def.id)))
    : await remove.gte('position', 0);
  throwIfError(deleteError);
  if (defs.length === 0) return;
  const { error } = await supabase
    .from('checkoff_defs')
    .upsert(defs.map((def, index) => ({ id: def.id, name: def.name, position: index })));
  throwIfError(error);
}

export async function setCheckoff(date: string, defId: string, checked: boolean): Promise<void> {
  if (checked) {
    const { error } = await supabase
      .from('checkoff_log')
      .upsert({ date, checkoff_def_id: defId }, { onConflict: 'user_id,date,checkoff_def_id' });
    throwIfError(error);
  } else {
    const { error } = await supabase
      .from('checkoff_log')
      .delete()
      .eq('date', date)
      .eq('checkoff_def_id', defId);
    throwIfError(error);
  }
}

export async function upsertBodyweight(entry: BodyweightEntry): Promise<void> {
  const { error } = await supabase
    .from('bodyweight_entries')
    .upsert({ date: entry.date, weight: entry.weight }, { onConflict: 'user_id,date' });
  throwIfError(error);
}

export async function insertWaterEntry(entry: WaterEntry): Promise<void> {
  const { error } = await supabase
    .from('water_entries')
    .upsert({ id: entry.id, date: entry.date, ounces: entry.ounces });
  throwIfError(error);
}

export async function setMeasurementDefs(defs: MeasurementDef[]): Promise<void> {
  const remove = supabase.from('measurement_defs').delete();
  const { error: deleteError } = defs.length
    ? await remove.not('id', 'in', quotedIdList(defs.map((def) => def.id)))
    : await remove.gte('position', 0);
  throwIfError(deleteError);
  if (defs.length === 0) return;
  const { error } = await supabase
    .from('measurement_defs')
    .upsert(defs.map((def, index) => ({ id: def.id, label: def.label, unit: def.unit, position: index })));
  throwIfError(error);
}

export async function insertMeasurementEntry(entry: MeasurementEntry): Promise<void> {
  const { error } = await supabase.from('measurement_entries').upsert({
    id: entry.id,
    date: entry.date,
    label: entry.label,
    value: entry.value,
    unit: entry.unit,
  });
  throwIfError(error);
}

function foodLogToRow(entry: FoodLogEntry) {
  return {
    id: entry.id,
    date: entry.date,
    meal: entry.meal,
    name: entry.name,
    brand: entry.brand ?? null,
    grams: entry.grams ?? null,
    calories: entry.calories,
    protein_g: entry.proteinG,
    carbs_g: entry.carbsG,
    fat_g: entry.fatG,
  };
}

export async function insertFoodLog(entry: FoodLogEntry): Promise<void> {
  const { error } = await supabase.from('food_logs').insert(foodLogToRow(entry));
  throwIfError(error);
}

export async function updateFoodLog(entry: FoodLogEntry): Promise<void> {
  const { error } = await supabase.from('food_logs').update(foodLogToRow(entry)).eq('id', entry.id);
  throwIfError(error);
}

export async function deleteFoodLog(id: string): Promise<void> {
  const { error } = await supabase.from('food_logs').delete().eq('id', id);
  throwIfError(error);
}

function recipeIngredientToRow(recipeId: string, ingredient: RecipeIngredient, position: number) {
  return {
    id: ingredient.id,
    recipe_id: recipeId,
    position,
    name: ingredient.name,
    grams: ingredient.grams ?? null,
    calories: ingredient.calories,
    protein_g: ingredient.proteinG,
    carbs_g: ingredient.carbsG,
    fat_g: ingredient.fatG,
  };
}

async function insertRecipeIngredients(recipe: Recipe): Promise<void> {
  if (recipe.ingredients.length === 0) return;
  const rows = recipe.ingredients.map((ingredient, index) =>
    recipeIngredientToRow(recipe.id, ingredient, index),
  );
  const { error } = await supabase.from('recipe_ingredients').insert(rows);
  throwIfError(error);
}

export async function insertRecipe(recipe: Recipe, position: number): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .insert({ id: recipe.id, name: recipe.name, servings: recipe.servings, position });
  throwIfError(error);
  await insertRecipeIngredients(recipe);
}

export async function updateRecipe(recipe: Recipe): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .update({ name: recipe.name, servings: recipe.servings })
    .eq('id', recipe.id);
  throwIfError(error);
  // Replace strategy, matching updateRoutine: ingredients are few.
  const { error: deleteError } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', recipe.id);
  throwIfError(deleteError);
  await insertRecipeIngredients(recipe);
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  throwIfError(error);
}

export async function upsertNutritionGoals(userId: string, goals: NutritionGoals): Promise<void> {
  const { error } = await supabase.from('nutrition_goals').upsert({
    user_id: userId,
    calories: goals.calories,
    protein_g: goals.proteinG,
    carbs_g: goals.carbsG,
    fat_g: goals.fatG,
  });
  throwIfError(error);
}

export async function updatePreferences(userId: string, preferences: Preferences): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, unit_system: preferences.unitSystem });
  throwIfError(error);
}

/** Written once on first login when the goals table is empty. */
export async function seedDefaultGoals(goals: Goals): Promise<void> {
  const { error } = await supabase.from('goals').upsert(goals.map(goalToRow));
  throwIfError(error);
}
