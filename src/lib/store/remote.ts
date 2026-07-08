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
  GoalDef,
  Goals,
  GoalType,
  MeasurementDef,
  MeasurementEntry,
  Preferences,
  Routine,
  RoutineExercise,
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

interface RoutineExerciseRow {
  id: string;
  routine_id: string;
  position: number;
  name: string;
  kind: ExerciseKind;
  warmup_sets: number | null;
  warmup_target_reps: number | null;
  warmup_target_weight: number | null;
  warmup_target_duration_sec: number | null;
  warmup_rest_sec: number | null;
  sets: number;
  target_reps: number;
  target_weight: number;
  target_duration_sec: number | null;
  target_rest_sec: number | null;
  last_reps: number | null;
  last_weight: number | null;
  last_duration_sec: number | null;
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
  target_distance_miles: number | null;
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
}

interface GoalRow {
  type: GoalType;
  label: string;
  target: number;
  unit: string;
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

// ---------------------------------------------------------------------------
// Row -> app-type mapping
// ---------------------------------------------------------------------------

function byPosition<T extends { position: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.position - b.position);
}

function mapRoutineExercise(row: RoutineExerciseRow): RoutineExercise {
  const hasLastTime =
    row.last_reps !== null || row.last_weight !== null || row.last_duration_sec !== null;
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    warmupSets: row.warmup_sets ?? undefined,
    warmupTargetReps: row.warmup_target_reps ?? undefined,
    warmupTargetWeight: row.warmup_target_weight ?? undefined,
    warmupTargetDurationSec: row.warmup_target_duration_sec ?? undefined,
    warmupRestSec: row.warmup_rest_sec ?? undefined,
    sets: row.sets,
    targetReps: row.target_reps,
    targetWeight: row.target_weight,
    targetDurationSec: row.target_duration_sec ?? undefined,
    targetRestSec: row.target_rest_sec ?? undefined,
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
    activityType: row.activity_type ?? undefined,
    targetDistanceMiles: row.target_distance_miles ?? undefined,
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

function mapCardioSession(row: CardioSessionRow): CardioSession {
  return {
    id: row.id,
    routineId: row.routine_id,
    name: row.name,
    activityType: row.activity_type,
    date: row.date,
    minutes: row.minutes,
    distanceMiles: row.distance_miles ?? undefined,
    calories: row.calories ?? undefined,
  };
}

/** Dashboard renders goal rings in this canonical order. */
const GOAL_ORDER: GoalType[] = ['workouts', 'calories', 'cardio', 'water'];

function mapGoals(rows: GoalRow[]): Goals {
  return [...rows]
    .sort((a, b) => GOAL_ORDER.indexOf(a.type) - GOAL_ORDER.indexOf(b.type))
    .map((row) => ({ id: row.type, type: row.type, label: row.label, target: row.target, unit: row.unit }));
}

function mapCheckoffLog(rows: CheckoffLogRow[]): CheckoffLog {
  const log: CheckoffLog = {};
  for (const row of rows) {
    (log[row.date] ??= []).push(row.checkoff_def_id);
  }
  return log;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('Supabase returned no data');
  return result.data;
}

/** Loads the user's entire store in parallel; throws on the first failure. */
export async function fetchStoreData(): Promise<StoreData> {
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
      .select('*, routine_exercises(*)')
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
    checkoffDefs: unwrap(checkoffDefs).map(({ id, name }) => ({ id, name })),
    checkoffLog: mapCheckoffLog(unwrap(checkoffLog)),
    bodyweight: unwrap(bodyweight),
    steps: unwrap(steps),
    waterEntries: unwrap(waterEntries),
    measurementDefs: unwrap(measurementDefs).map(({ id, label, unit }) => ({ id, label, unit })),
    measurementEntries: unwrap(measurementEntries),
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
    target_distance_miles: routine.targetDistanceMiles ?? null,
  };
}

function routineExerciseToRow(routineId: string, exercise: RoutineExercise, position: number) {
  return {
    id: exercise.id,
    routine_id: routineId,
    position,
    name: exercise.name,
    kind: exercise.kind ?? 'reps',
    warmup_sets: exercise.warmupSets ?? 0,
    warmup_target_reps: exercise.warmupTargetReps ?? null,
    warmup_target_weight: exercise.warmupTargetWeight ?? null,
    warmup_target_duration_sec: exercise.warmupTargetDurationSec ?? null,
    warmup_rest_sec: exercise.warmupRestSec ?? null,
    sets: exercise.sets,
    target_reps: exercise.targetReps,
    target_weight: exercise.targetWeight,
    target_duration_sec: exercise.targetDurationSec ?? null,
    target_rest_sec: exercise.targetRestSec ?? null,
    last_reps: exercise.lastTime?.reps ?? null,
    last_weight: exercise.lastTime?.weight ?? null,
    last_duration_sec: exercise.lastTime?.durationSec ?? null,
  };
}

async function insertRoutineExercises(routine: Routine): Promise<void> {
  if (routine.exercises.length === 0) return;
  const rows = routine.exercises.map((exercise, index) =>
    routineExerciseToRow(routine.id, exercise, index),
  );
  const { error } = await supabase.from('routine_exercises').insert(rows);
  throwIfError(error);
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
  });
  throwIfError(error);
}

export async function setGoals(goals: Goals): Promise<void> {
  const keep = goals.map((goal) => goal.type);
  const remove = supabase.from('goals').delete();
  const { error: deleteError } = keep.length
    ? await remove.not('type', 'in', `(${keep.join(',')})`)
    : await remove.in('type', GOAL_ORDER);
  throwIfError(deleteError);
  if (goals.length === 0) return;
  const { error } = await supabase.from('goals').upsert(
    goals.map((goal) => ({ type: goal.type, label: goal.label, target: goal.target, unit: goal.unit })),
    { onConflict: 'user_id,type' },
  );
  throwIfError(error);
}

/** Upsert + delete-missing; deleting a def cascades its checkoff_log rows. */
export async function setCheckoffDefs(defs: CheckoffDef[]): Promise<void> {
  const remove = supabase.from('checkoff_defs').delete();
  const { error: deleteError } = defs.length
    ? await remove.not('id', 'in', `(${defs.map((def) => def.id).join(',')})`)
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
    ? await remove.not('id', 'in', `(${defs.map((def) => def.id).join(',')})`)
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

export async function updatePreferences(userId: string, preferences: Preferences): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, unit_system: preferences.unitSystem });
  throwIfError(error);
}

/** Written once on first login when the goals table is empty. */
export async function seedDefaultGoals(goals: GoalDef[]): Promise<void> {
  const { error } = await supabase.from('goals').upsert(
    goals.map((goal) => ({ type: goal.type, label: goal.label, target: goal.target, unit: goal.unit })),
    { onConflict: 'user_id,type' },
  );
  throwIfError(error);
}
