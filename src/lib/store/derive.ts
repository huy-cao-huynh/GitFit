/**
 * Pure selectors over store data, so screens stay declarative. All date keys
 * are local YYYY-MM-DD strings (not UTC) so "today" matches the device.
 */

import type {
  BodyweightEntry,
  CardioActivityType,
  CardioSession,
  CheckoffDef,
  CheckoffLog,
  FoodLogEntry,
  GoalDef,
  GoalEntry,
  GoalMetric,
  Macros,
  MealType,
  MeasurementEntry,
  ProgressPoint,
  Recipe,
  Routine,
  RoutineExercise,
  Session,
  SessionExercise,
  SetLog,
  StepsEntry,
  UnitSystem,
  WaterEntry,
  Weekday,
} from './types';
import { formatDuration } from '@/lib/format';
import { muscleGroupsFor } from '@/lib/muscles';
import {
  formatWeight,
  toDisplayDistance,
  toDisplayElevation,
  toDisplayWeight,
  weightUnitLabel,
} from '@/lib/units';

/** Rough calories/minute per activity — same "placeholder until HealthKit" spirit as the strength session heuristic. */
const CARDIO_CALORIES_PER_MINUTE: Record<CardioActivityType, number> = {
  walk: 4,
  run: 10,
  hike: 7,
  swim: 8,
  cycle: 7,
  other: 6,
};

/**
 * Activities where a GPS trace means something. Swimming traces a pool wall or
 * nothing at all, and 'other' is a catch-all that's as likely to be a rowing
 * machine as a road — recording either would burn battery to produce a route
 * nobody wants, and would skip the manual distance entry they do need.
 */
const GPS_TRACKED_ACTIVITIES: readonly CardioActivityType[] = ['walk', 'run', 'hike', 'cycle'];

export function tracksLocation(activityType: CardioActivityType): boolean {
  return GPS_TRACKED_ACTIVITIES.includes(activityType);
}

export function estimateCardioCalories(activityType: CardioActivityType, minutes: number): number {
  return Math.round(minutes * CARDIO_CALORIES_PER_MINUTE[activityType]);
}

/**
 * Gross cost of covering ground, per kg of body mass per km. Roughly
 * speed-independent for running; walking and hiking are cheaper per km but
 * take longer, which is why distance-based beats minutes-based here.
 */
const KCAL_PER_KG_PER_KM: Partial<Record<CardioActivityType, number>> = {
  run: 1.036,
  walk: 0.53,
  hike: 0.62,
};

/** Climbing work: m·g·h at ~22% muscular efficiency, converted joules → kcal. */
const KCAL_PER_KG_PER_METER_CLIMBED = 0.0105;

/** Compendium-of-physical-activities METs, bucketed by cycling speed in mph. */
function cyclingMet(mph: number): number {
  if (mph < 10) return 4;
  if (mph < 12) return 6.8;
  if (mph < 14) return 8;
  if (mph < 16) return 10;
  if (mph < 19) return 12;
  return 15.8;
}

export interface CardioCalorieInput {
  activityType: CardioActivityType;
  minutes: number;
  distanceMiles?: number;
  elevationGainFt?: number;
  /** Canonical lbs, from the most recent bodyweight entry. */
  bodyweightLb?: number;
}

/**
 * Burn for a *completed* GPS-tracked session, using how far you actually went
 * and how much you climbed rather than minutes × a constant.
 *
 * Falls back to `estimateCardioCalories` whenever the inputs can't support
 * better — no distance (treadmill, denied permission), no bodyweight on
 * record, or an activity GPS says nothing useful about (swimming, court
 * sports). A calorie figure derived from a guessed body mass would be fiction
 * dressed up as precision.
 */
export function estimateCardioCaloriesDetailed({
  activityType,
  minutes,
  distanceMiles,
  elevationGainFt,
  bodyweightLb,
}: CardioCalorieInput): number {
  if (!bodyweightLb || !distanceMiles || minutes <= 0) {
    return estimateCardioCalories(activityType, minutes);
  }

  const kg = toDisplayWeight(bodyweightLb, 'metric');
  const km = toDisplayDistance(distanceMiles, 'metric');
  const climb = elevationGainFt
    ? toDisplayElevation(elevationGainFt, 'metric') * kg * KCAL_PER_KG_PER_METER_CLIMBED
    : 0;

  const perKgPerKm = KCAL_PER_KG_PER_KM[activityType];
  if (perKgPerKm) return Math.round(kg * km * perKgPerKm + climb);

  if (activityType === 'cycle') {
    const hours = minutes / 60;
    return Math.round(cyclingMet(distanceMiles / hours) * kg * hours + climb);
  }

  return estimateCardioCalories(activityType, minutes);
}

/** Most recent logged bodyweight in canonical lbs. `bodyweight` arrives date-ascending. */
export function latestBodyweightLb(bodyweight: BodyweightEntry[]): number | undefined {
  return bodyweight.length ? bodyweight[bodyweight.length - 1].weight : undefined;
}

/** Placeholder-until-HealthKit heuristic for strength sessions, and the fallback rate for any exercise `muscleGroupsFor` can't classify. */
export const STRENGTH_CALORIES_PER_MINUTE = 8;

/**
 * Rough calories/minute by muscle group, so a leg-heavy routine reads
 * higher than an arm-heavy one of the same duration instead of both hitting
 * the flat `STRENGTH_CALORIES_PER_MINUTE`. Same "placeholder until
 * HealthKit" spirit as the cardio table above — ordered roughly by how much
 * muscle mass (and therefore work) a group represents.
 */
const MUSCLE_GROUP_CALORIES_PER_MINUTE: Record<string, number> = {
  'Full body': 11,
  Quads: 9,
  Hamstrings: 9,
  Glutes: 9,
  Cardio: 10,
  Back: 8,
  Chest: 7.5,
  Shoulders: 6.5,
  Calves: 6,
  Core: 6,
  Biceps: 5,
  Triceps: 5,
};

/** Averages the per-muscle-group rate across whatever `muscleGroupsFor` matched, or the flat fallback if it matched nothing. */
function caloriesPerMinuteFor(exerciseName: string): number {
  const groups = muscleGroupsFor(exerciseName);
  if (groups.length === 0) return STRENGTH_CALORIES_PER_MINUTE;
  const sum = groups.reduce((total, group) => total + (MUSCLE_GROUP_CALORIES_PER_MINUTE[group] ?? STRENGTH_CALORIES_PER_MINUTE), 0);
  return sum / groups.length;
}

/**
 * Splits `minutes` across exercises by their share of total sets, weights
 * each share by that exercise's muscle-group rate, and sums the result —
 * so a squat-and-deadlift session estimates higher than a curl-and-pushdown
 * one of the same length. Falls back to the flat rate when there are no
 * sets to weight by (e.g. an empty routine preview).
 */
function weightedCalories(exercises: { name: string; sets: unknown[] }[], minutes: number): number {
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  if (totalSets === 0) return Math.round(minutes * STRENGTH_CALORIES_PER_MINUTE);

  const calories = exercises.reduce((sum, exercise) => {
    const share = exercise.sets.length / totalSets;
    return sum + share * minutes * caloriesPerMinuteFor(exercise.name);
  }, 0);
  return Math.round(calories);
}

/**
 * Estimated burn for a strength routine before it's been run — what the
 * dashboard previews. Cardio has no pre-set duration to estimate from, so
 * callers only ever invoke this for strength routines.
 */
export function estimateRoutineCalories(routine: Routine): number {
  return weightedCalories(routine.exercises, routine.durationMinutes);
}

/** Same weighting as `estimateRoutineCalories`, but over the sets actually logged so far — for the live in-session estimate and the saved session's calorie total. */
export function estimateSessionCalories(exercises: { name: string; sets: unknown[] }[], minutes: number): number {
  return weightedCalories(exercises, minutes);
}

export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** Sunday-first — every weekday picker/calendar in the app (schedule days, the Log tab strip) reads this same order. */
export const WEEKDAY_OPTIONS: { value: Weekday; short: string; label: string }[] = [
  { value: 7, short: 'S', label: 'Sunday' },
  { value: 1, short: 'M', label: 'Monday' },
  { value: 2, short: 'T', label: 'Tuesday' },
  { value: 3, short: 'W', label: 'Wednesday' },
  { value: 4, short: 'T', label: 'Thursday' },
  { value: 5, short: 'F', label: 'Friday' },
  { value: 6, short: 'S', label: 'Saturday' },
];

/** Sunday-first 3-letter weekday abbreviations for the calendar strip, index-aligned with `WEEKDAY_OPTIONS`. */
const CALENDAR_WEEKDAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * Parses a `YYYY-MM-DD` key as local midnight. `new Date(dateKey)` parses
 * date-only ISO strings as UTC midnight instead, which silently rolls back a
 * day in any timezone behind UTC — always go through this, never the bare
 * constructor, for a stored date key.
 */
export function dateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function weekdayForDate(date: Date): Weekday {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

export function weekStartKey(): string {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  return toDateKey(weekStart);
}

export interface ScheduledRoutineTask {
  routine: Routine;
  completed: boolean;
}

export interface CalendarDay {
  date: string;
  label: string;
  dayNumber: number;
  isToday: boolean;
  scheduledCount: number;
  completedCount: number;
}

export function scheduledRoutinesForDate(routines: Routine[] = [], dateKey: string): Routine[] {
  const weekday = weekdayForDate(dateFromKey(dateKey));
  return routines.filter((routine) => routine.scheduledDays?.includes(weekday));
}

export function routineCompletedOnDate(
  routineId: string,
  dateKey: string,
  sessions: Session[] = [],
  cardioSessions: CardioSession[] = [],
): boolean {
  return (
    sessions.some((session) => session.date === dateKey && session.routineId === routineId) ||
    cardioSessions.some((session) => session.date === dateKey && session.routineId === routineId)
  );
}

export function scheduledRoutineTasks(
  routines: Routine[] = [],
  sessions: Session[] = [],
  cardioSessions: CardioSession[] = [],
  dateKey: string,
): ScheduledRoutineTask[] {
  return scheduledRoutinesForDate(routines, dateKey).map((routine) => ({
    routine,
    completed: routineCompletedOnDate(routine.id, dateKey, sessions, cardioSessions),
  }));
}

export interface UnscheduledCompletedWorkout {
  id: string;
  name: string;
  category: 'strength' | 'cardio';
  minutes: number;
  calories: number;
}

/**
 * Completed sessions/cardio sessions on a date whose routine wasn't scheduled
 * for that day — e.g. an ad-hoc workout, or a routine run on an off day.
 * `scheduledRoutineTasks` already covers scheduled-and-completed routines,
 * so these are the extra ones a day's schedule wouldn't otherwise surface.
 */
export function unscheduledCompletedWorkouts(
  routines: Routine[] = [],
  sessions: Session[] = [],
  cardioSessions: CardioSession[] = [],
  dateKey: string,
): UnscheduledCompletedWorkout[] {
  const scheduledIds = new Set(scheduledRoutinesForDate(routines, dateKey).map((routine) => routine.id));
  const strength = sessions
    .filter((session) => session.date === dateKey && !(session.routineId && scheduledIds.has(session.routineId)))
    .map((session) => ({
      id: session.id,
      name: session.routineName,
      category: 'strength' as const,
      minutes: session.durationMinutes,
      calories: session.calories ?? estimateSessionCalories(session.exercises, session.durationMinutes),
    }));
  const cardio = cardioSessions
    .filter((session) => session.date === dateKey && !(session.routineId && scheduledIds.has(session.routineId)))
    .map((session) => ({
      id: session.id,
      name: session.name,
      category: 'cardio' as const,
      minutes: session.minutes,
      calories: session.calories ?? estimateCardioCalories(session.activityType, session.minutes),
    }));
  return [...strength, ...cardio];
}

export type WorkoutHistoryEntry =
  | { type: 'strength'; session: Session }
  | { type: 'cardio'; session: CardioSession };

/**
 * Strength + cardio sessions from the last `days` days, newest first. Each
 * source array is already fetched newest-first, but interleaving two
 * separately-sorted arrays by date still needs its own sort. Kept as tagged
 * original objects (not flattened, unlike `unscheduledCompletedWorkouts`)
 * since row rendering (`CardioRow`, history detail links) needs the full
 * session shape.
 */
export function recentWorkoutHistory(sessions: Session[], cardioSessions: CardioSession[], days: number): WorkoutHistoryEntry[] {
  const cutoff = shiftDateKey(todayKey(), -days);
  const strength: WorkoutHistoryEntry[] = sessions
    .filter((session) => session.date >= cutoff)
    .map((session) => ({ type: 'strength', session }));
  const cardio: WorkoutHistoryEntry[] = cardioSessions
    .filter((session) => session.date >= cutoff)
    .map((session) => ({ type: 'cardio', session }));
  return [...strength, ...cardio].sort((a, b) => b.session.date.localeCompare(a.session.date));
}

export function calendarWeekDays(
  routines: Routine[] = [],
  sessions: Session[] = [],
  cardioSessions: CardioSession[] = [],
  anchorDate = new Date(),
): CalendarDay[] {
  const sunday = new Date(anchorDate);
  const weekday = weekdayForDate(anchorDate);
  sunday.setDate(anchorDate.getDate() - (weekday === 7 ? 0 : weekday));
  const todaysKey = todayKey();

  return WEEKDAY_OPTIONS.map((option, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    const dateKey = toDateKey(date);
    const scheduledCount = scheduledRoutinesForDate(routines, dateKey).length;
    const completedCount =
      sessions.filter((session) => session.date === dateKey).length +
      cardioSessions.filter((session) => session.date === dateKey).length;
    return {
      date: dateKey,
      label: CALENDAR_WEEKDAY_ABBR[index],
      dayNumber: date.getDate(),
      isToday: dateKey === todaysKey,
      scheduledCount,
      completedCount,
    };
  });
}

export interface CheckoffDay {
  date: string;
  label: string;
  isToday: boolean;
  done: boolean;
}

/**
 * A single check-off definition's current week, Sunday-anchored to line up with
 * `calendarWeekDays` and the weekly goal window. Reads straight out of
 * `checkoffLog`, so the streak strip costs no extra storage or writes.
 */
export function checkoffWeek(
  checkoffLog: CheckoffLog,
  defId: string,
  anchorDate = new Date(),
): CheckoffDay[] {
  const sunday = new Date(anchorDate);
  const weekday = weekdayForDate(anchorDate);
  sunday.setDate(anchorDate.getDate() - (weekday === 7 ? 0 : weekday));
  const todaysKey = todayKey();

  return WEEKDAY_OPTIONS.map((option, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    const dateKey = toDateKey(date);
    return {
      date: dateKey,
      label: option.short,
      isToday: dateKey === todaysKey,
      done: (checkoffLog[dateKey] ?? []).includes(defId),
    };
  });
}

/**
 * Consecutive days on which *every* current check-off goal was completed.
 * Today only breaks the streak once it's over, so an unfinished today counts
 * back from yesterday rather than resetting to zero mid-morning.
 *
 * Note this measures today's goal list against history — a goal added today
 * can shorten the streak, because there's no record of it on earlier days.
 */
export function allGoalsStreak(defs: CheckoffDef[], checkoffLog: CheckoffLog, anchorDate = new Date()): number {
  if (defs.length === 0) return 0;

  const allDoneOn = (dateKey: string) => {
    const done = checkoffLog[dateKey] ?? [];
    return defs.every((def) => done.includes(def.id));
  };

  const cursor = new Date(anchorDate);
  if (!allDoneOn(toDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (allDoneOn(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function routineScheduleLabel(routine: Routine): string {
  if (!routine.scheduledDays || routine.scheduledDays.length === 0) return 'No schedule';
  if (routine.scheduledDays.length === 7) return 'Every day';
  return WEEKDAY_OPTIONS.filter((option) => routine.scheduledDays?.includes(option.value))
    .map((option) => option.short)
    .join(', ');
}

/**
 * One condensed summary line for a routine exercise's sets, e.g.
 * "3 sets · 135–175 lbs × 8" (pyramid) or "3 sets · 45s" (time-kind). Shared
 * by the routine editor's condensed exercise rows, the today-workout card,
 * and the live session screen so they never drift out of sync.
 */
export function describeExerciseSets(exercise: RoutineExercise, unitSystem: UnitSystem): string {
  const working = exercise.sets.filter((set) => !set.isWarmup);
  const warmupCount = exercise.sets.length - working.length;
  const warmupLabel = warmupCount > 0 ? `${warmupCount} warm-up + ` : '';

  if (working.length === 0) {
    return warmupCount > 0 ? `${warmupCount} warm-up set${warmupCount === 1 ? '' : 's'}` : 'No sets yet';
  }

  const countLabel = `${working.length} set${working.length === 1 ? '' : 's'}`;

  if ((exercise.kind ?? 'reps') === 'time') {
    const durations = working.map((set) => set.durationSec ?? 0);
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const durationLabel = min === max ? formatDuration(min) : `${formatDuration(min)}–${formatDuration(max)}`;
    return `${warmupLabel}${countLabel} · ${durationLabel}`;
  }

  const weights = working.map((set) => set.weight ?? 0);
  const reps = working.map((set) => set.reps ?? 0);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const minReps = Math.min(...reps);
  const maxReps = Math.max(...reps);
  const repsLabel = minReps === maxReps ? `${minReps}` : `${minReps}-${maxReps}`;
  const weightLabel =
    maxWeight > 0
      ? minWeight === maxWeight
        ? formatWeight(minWeight, unitSystem)
        : `${toDisplayWeight(minWeight, unitSystem)}–${toDisplayWeight(maxWeight, unitSystem)} ${weightUnitLabel(unitSystem)}`
      : '';

  return `${warmupLabel}${countLabel} · ${weightLabel ? `${weightLabel} × ` : ''}${repsLabel} reps`;
}

/** The fixed chip set for the Workouts main page's "trained this week" coverage bar — the catch-all `muscleGroupsFor` groups (Full body, Cardio) are excluded since they don't map to a single body part. */
export const MUSCLE_COVERAGE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
] as const;

/** Which of `MUSCLE_COVERAGE_GROUPS` have been hit by a logged strength session so far this week (Sunday-anchored). */
export function muscleCoverageThisWeek(sessions: Session[]): Set<string> {
  const startKey = weekStartKey();
  const hit = new Set<string>();
  for (const session of sessions) {
    if (session.date < startKey) continue;
    for (const exercise of session.exercises) {
      for (const group of muscleGroupsFor(exercise.name)) {
        hit.add(group);
      }
    }
  }
  return hit;
}

export type DayStatus = 'none' | 'partial' | 'all';

export interface WeekDay {
  date: string;
  label: string;
  status: DayStatus;
  isToday: boolean;
}

/**
 * The current Sunday-to-Saturday week, with a per-day completion status
 * across both the planned workout and the daily check-offs.
 */
export function weekStreak(
  routines: Routine[] = [],
  sessions: Session[] = [],
  cardioSessions: CardioSession[] = [],
  checkoffDefs: CheckoffDef[] = [],
  checkoffLog: CheckoffLog = {},
): WeekDay[] {
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const todaysKey = toDateKey(today);

  return labels.map((label, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const key = toDateKey(date);
    const scheduledTasks = scheduledRoutineTasks(routines, sessions, cardioSessions, key);
    const totalGoals = scheduledTasks.length + checkoffDefs.length;
    const doneCount = scheduledTasks.filter((task) => task.completed).length + (checkoffLog[key]?.length ?? 0);
    const status: DayStatus =
      doneCount === 0 ? 'none' : totalGoals === 0 || doneCount >= totalGoals ? 'all' : 'partial';
    return { date: key, label, status, isToday: key === todaysKey };
  });
}

/** This week's current value for a single modular goal. */
export function currentGoalValue(
  goal: GoalDef,
  sessions: Session[],
  cardioSessions: CardioSession[],
  waterEntries: WaterEntry[],
  goalEntries: GoalEntry[] = [],
  steps: StepsEntry[] = [],
  bodyweight: BodyweightEntry[] = [],
): number {
  const startKey = weekStartKey();
  switch (goal.metric) {
    case 'workouts':
      return sessions.filter((s) => s.date >= startKey).length;
    case 'calories': {
      const fromStrength = sessions
        .filter((s) => s.date >= startKey)
        .reduce((sum, s) => sum + (s.calories ?? 0), 0);
      const fromCardio = cardioSessions
        .filter((s) => s.date >= startKey)
        .reduce((sum, s) => sum + (s.calories ?? 0), 0);
      return fromStrength + fromCardio;
    }
    case 'cardio':
      return cardioSessions.filter((s) => s.date >= startKey).reduce((sum, s) => sum + s.minutes, 0);
    case 'water':
      return waterEntries.filter((e) => e.date >= startKey).reduce((sum, e) => sum + e.ounces, 0);
    case 'steps':
      return steps.filter((s) => s.date >= startKey).reduce((sum, s) => sum + s.steps, 0);
    case 'bodyweight':
      return bodyweight.filter((e) => e.date >= startKey).length;
    case 'manual':
      return goalEntries
        .filter((e) => e.goalId === goal.id && e.date >= startKey)
        .reduce((sum, e) => sum + e.amount, 0);
  }
}

/** Today's logged water, independent of the weekly ring math — the bottle fills daily. */
export function todayWaterOunces(waterEntries: WaterEntry[]): number {
  const key = todayKey();
  return waterEntries.filter((e) => e.date === key).reduce((sum, e) => sum + e.ounces, 0);
}

/** Today's logged steps, independent of the weekly ring math. */
export function todayStepsCount(steps: StepsEntry[]): number {
  const key = todayKey();
  return steps.filter((s) => s.date === key).reduce((sum, s) => sum + s.steps, 0);
}

/** One card in the dashboard's swipeable metric deck. */
export interface DashboardMetric {
  key: string;
  /** Chip text beside the icon ("Calories Eaten"). */
  label: string;
  /** Serif headline ("Your Daily Calories"). */
  title: string;
  metric: GoalMetric | 'intake';
  value: number;
  target: number;
  unit: string;
  period: 'today' | 'this week';
  /** Water is stored in canonical ounces and needs converting for display. */
  isVolume: boolean;
}

/**
 * Deck order. Calories eaten opens the deck (it's the metric you touch most
 * often), and the calories-burned goal is deliberately placed away from it so
 * two similarly-named cards never sit next to each other.
 */
const DECK_ORDER: (GoalMetric | 'intake')[] = ['intake', 'steps', 'workouts', 'cardio', 'water', 'calories'];

/**
 * The dashboard metric deck: every goal, plus a calories-eaten card sourced
 * from the Nutrition tab. Each metric reports over the period that actually
 * makes sense for it — intake and water are daily, everything else is the
 * weekly goal window.
 */
export function dashboardMetrics(
  goals: GoalDef[],
  sessions: Session[],
  cardioSessions: CardioSession[],
  waterEntries: WaterEntry[],
  goalEntries: GoalEntry[],
  foodLogs: FoodLogEntry[],
  nutritionGoals: Macros | null,
  dateKey: string,
  steps: StepsEntry[] = [],
): DashboardMetric[] {
  const cards: DashboardMetric[] = [];

  // Falls back to the shared default rather than dropping the card, so the
  // deck always agrees with the target the Nutrition tab displays.
  const intakeTarget = (nutritionGoals ?? DEFAULT_NUTRITION_GOALS).calories;
  if (intakeTarget > 0) {
    cards.push({
      key: 'intake',
      label: 'Calories Eaten',
      title: 'Your Daily Calories Eaten',
      metric: 'intake',
      value: Math.round(nutritionForDate(foodLogs, dateKey).totals.calories),
      target: intakeTarget,
      unit: 'kcal',
      period: 'today',
      isVolume: false,
    });
  }

  for (const goal of goals) {
    // Manual check-ins have no natural chart; bodyweight goals target a
    // weekday, not a count, so they don't fit the deck's progress-ring shape.
    if (goal.metric === 'manual' || goal.metric === 'bodyweight') continue;
    // "Calories" alone sits next to the intake card and reads ambiguously, so
    // the default label is spelled out. A renamed goal is left alone.
    const label = goal.metric === 'calories' && goal.label === 'Calories' ? 'Calories Burned' : goal.label;
    const isSteps = goal.metric === 'steps';
    cards.push({
      key: goal.id,
      label,
      title: `Your ${isSteps ? 'Daily' : 'Weekly'} ${label}`,
      metric: goal.metric,
      // Steps reads daily, like intake — there is still no daily steps target
      // in the data model, so the weekly one is divided down.
      value: isSteps
        ? todayStepsCount(steps)
        : currentGoalValue(goal, sessions, cardioSessions, waterEntries, goalEntries, steps),
      target: isSteps ? Math.max(1, Math.round(goal.target / 7)) : goal.target,
      // Both calorie cards read in kcal so the deck doesn't switch units
      // between "eaten" and "burned".
      unit: goal.metric === 'calories' ? 'kcal' : goal.unit || goal.label,
      period: isSteps ? 'today' : 'this week',
      isVolume: goal.metric === 'water',
    });
  }

  return cards.sort((a, b) => DECK_ORDER.indexOf(a.metric) - DECK_ORDER.indexOf(b.metric));
}

/** Unique exercise names across sessions, most-logged first. */
export function exerciseNames(sessions: Session[]): string[] {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      counts.set(exercise.name, (counts.get(exercise.name) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/** Max weight lifted for an exercise per session date, oldest first. */
export function strengthSeries(sessions: Session[], name: string): ProgressPoint[] {
  const points: ProgressPoint[] = [];
  for (const session of sessions) {
    const exercise = session.exercises.find((e) => e.name === name);
    if (!exercise || exercise.sets.length === 0) continue;
    const weights = exercise.sets
      .filter((set) => !set.isWarmup)
      .map((set) => set.weight ?? 0)
      .filter((weight) => weight > 0);
    if (weights.length === 0) continue;
    points.push({ date: session.date, value: Math.max(...weights) });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Chartable trend for one measurement label: the latest value per date,
 * oldest first (entries are stored newest-first).
 */
export function measurementSeries(entries: MeasurementEntry[], label: string): ProgressPoint[] {
  const byDate = new Map<string, number>();
  for (const entry of entries) {
    if (entry.label !== label || byDate.has(entry.date)) continue;
    byDate.set(entry.date, entry.value);
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));
}

export function sessionsByDate(sessions: Session[]): Record<string, Session[]> {
  const map: Record<string, Session[]> = {};
  for (const session of sessions) {
    (map[session.date] ??= []).push(session);
  }
  return map;
}

export type TodayPlan =
  | { status: 'completed'; label: string; detail: string }
  | { status: 'planned'; routine: Routine }
  | { status: 'rest' };

export function todayPlan(routines: Routine[], sessions: Session[], cardioSessions: CardioSession[]): TodayPlan {
  const key = todayKey();
  const scheduled = scheduledRoutineTasks(routines, sessions, cardioSessions, key);
  const incomplete = scheduled.find((task) => !task.completed);
  if (incomplete) return { status: 'planned', routine: incomplete.routine };

  const completed = scheduled.find((task) => task.completed);
  if (completed) return { status: 'completed', label: completed.routine.name, detail: 'Completed today' };
  return { status: 'rest' };
}

/** BMI from canonical lbs/inches; null when either input is missing. */
export function bmi(weightLbs: number | null | undefined, heightInches: number | null | undefined): number | null {
  if (!weightLbs || !heightInches) return null;
  const weightKg = weightLbs / 2.20462;
  const heightM = heightInches * 0.0254;
  return round1(weightKg / (heightM * heightM));
}

export function ageFromBirthday(birthday: string | null | undefined): number | null {
  if (!birthday) return null;
  const parsed = dateFromKey(birthday);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > parsed.getMonth() ||
    (today.getMonth() === parsed.getMonth() && today.getDate() >= parsed.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age >= 0 ? age : null;
}

export type Sex = 'male' | 'female';

/**
 * Rough Deurenberg-formula body-fat estimate. Explicitly a placeholder per
 * the roadmap — real body-composition tracking comes later.
 */
export function bodyFatPercent(bmiValue: number | null, ageYears: number | null, sex: Sex | null): number | null {
  if (bmiValue === null || ageYears === null || sex === null) return null;
  const sexFactor = sex === 'male' ? 1 : 0;
  return Math.max(0, round1(1.2 * bmiValue + 0.23 * ageYears - 10.8 * sexFactor - 5.4));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------------
// Exercise history
// ---------------------------------------------------------------------------

/**
 * The most recent logged working sets for an exercise (matched by name,
 * case-insensitive). Sessions are stored newest-first, so the first hit wins.
 */
export function lastExercisePerformance(
  sessions: Session[],
  exerciseName: string,
): { date: string; sets: SetLog[] } | null {
  const target = exerciseName.trim().toLowerCase();
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.name.trim().toLowerCase() !== target) continue;
      const sets = exercise.sets.filter((set) => !set.isWarmup && !set.skipped);
      if (sets.length > 0) return { date: session.date, sets };
    }
  }
  return null;
}

/** Best-ever working-set weight for an exercise, with the reps it was hit for. */
/** Weight first, reps as the tiebreaker at equal weight — matches `beatsRecord`'s comparison order. */
export function exercisePR(
  sessions: Session[],
  exerciseName: string,
): { weight: number; reps?: number; date: string } | null {
  const target = exerciseName.trim().toLowerCase();
  let best: { weight: number; reps?: number; date: string } | null = null;
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.name.trim().toLowerCase() !== target) continue;
      for (const set of exercise.sets) {
        if (set.isWarmup || set.skipped || !set.weight) continue;
        if (beatsRecord(set.weight, set.reps, best)) {
          best = { weight: set.weight, reps: set.reps, date: session.date };
        }
      }
    }
  }
  return best;
}

/**
 * Best working set for an exercise among the sets logged *so far in the
 * current session* — the half of the record `exercisePR` can't see, since the
 * in-progress session isn't in the store until it's saved.
 *
 * Without folding this in, a PR on set 1 leaves the stored record stale for
 * sets 2..n, so an identical set still "beats" it and re-fires every PR
 * affordance. Same filter as `exercisePR`: working sets with a real weight.
 */
export function sessionBestSet(
  logged: SessionExercise[],
  exerciseName: string,
): { weight: number; reps?: number } | null {
  const target = exerciseName.trim().toLowerCase();
  let best: { weight: number; reps?: number } | null = null;
  for (const exercise of logged) {
    if (exercise.name.trim().toLowerCase() !== target) continue;
    for (const set of exercise.sets) {
      if (set.isWarmup || set.skipped || !set.weight) continue;
      if (beatsRecord(set.weight, set.reps, best)) best = { weight: set.weight, reps: set.reps };
    }
  }
  return best;
}

/** Weight-primary, reps-secondary PR comparison: a heavier weight always wins; at equal weight, more reps wins. */
export function beatsRecord(weight: number, reps: number | undefined, prior: { weight: number; reps?: number } | null): boolean {
  if (!prior) return true;
  if (weight > prior.weight) return true;
  return weight === prior.weight && (reps ?? 0) > (prior.reps ?? 0);
}

/** Most recent cardio session logged against this routine. Relies on the caller's `cardioSessions` being sorted most-recent-first, same contract as `lastExercisePerformance`. */
export function lastCardioPerformance(
  cardioSessions: CardioSession[],
  routineId: string,
): { date: string; minutes: number; distanceMiles?: number } | null {
  const match = cardioSessions.find((session) => session.routineId === routineId);
  return match ? { date: match.date, minutes: match.minutes, distanceMiles: match.distanceMiles } : null;
}

/** Longest distance ever logged for this routine, with the date it happened. Mirrors `exercisePR`'s shape. */
export function cardioRoutinePR(
  cardioSessions: CardioSession[],
  routineId: string,
): { distanceMiles: number; date: string } | null {
  let best: { distanceMiles: number; date: string } | null = null;
  for (const session of cardioSessions) {
    if (session.routineId !== routineId || !session.distanceMiles) continue;
    if (!best || session.distanceMiles > best.distanceMiles) {
      best = { distanceMiles: session.distanceMiles, date: session.date };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export const EMPTY_MACROS: Macros = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

/**
 * Daily intake targets shown until the user sets their own. Shared so the
 * Nutrition tab and the dashboard's intake card never disagree about what
 * today's calorie target is.
 */
export const DEFAULT_NUTRITION_GOALS: Macros = { calories: 2000, proteinG: 140, carbsG: 220, fatG: 65 };

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
  };
}

export function scaleMacros(macros: Macros, factor: number): Macros {
  return {
    calories: round1(macros.calories * factor),
    proteinG: round1(macros.proteinG * factor),
    carbsG: round1(macros.carbsG * factor),
    fatG: round1(macros.fatG * factor),
  };
}

/** Condensed macro line for a summary row, e.g. "24p · 30c · 8f". */
export function macroSummary(macros: Macros): string {
  return `${Math.round(macros.proteinG)}p · ${Math.round(macros.carbsG)}c · ${Math.round(macros.fatG)}f`;
}

/** A day's food logs grouped by meal, plus summed macro totals for the day and per meal. */
export function nutritionForDate(
  foodLogs: FoodLogEntry[],
  date: string,
): { totals: Macros; byMeal: Record<MealType, FoodLogEntry[]>; mealTotals: Record<MealType, Macros> } {
  const byMeal: Record<MealType, FoodLogEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
  const mealTotals: Record<MealType, Macros> = {
    breakfast: EMPTY_MACROS,
    lunch: EMPTY_MACROS,
    dinner: EMPTY_MACROS,
    snack: EMPTY_MACROS,
  };
  let totals = EMPTY_MACROS;
  for (const entry of foodLogs) {
    if (entry.date !== date) continue;
    byMeal[entry.meal].push(entry);
    mealTotals[entry.meal] = addMacros(mealTotals[entry.meal], entry);
    totals = addMacros(totals, entry);
  }
  return { totals, byMeal, mealTotals };
}

/** A distinct previously-logged food, normalized back to per-100g so it can feed the same amount math as a fresh search result. */
export interface RecentFood {
  name: string;
  brand?: string;
  /** Amount logged last time, for defaulting the portion picker. */
  grams: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

/**
 * Distinct foods the user has logged before (by name+brand), most recent
 * first, for quick re-logging. Relies on `foodLogs` already being
 * newest-first (remote fetch orders by date desc; `addFoodLog` prepends).
 * Serving-based entries (recipes, no `grams`) are skipped — there's no
 * per-gram rate to normalize them to.
 */
export function recentFoods(foodLogs: FoodLogEntry[], limit = 6): RecentFood[] {
  const seen = new Set<string>();
  const out: RecentFood[] = [];
  for (const entry of foodLogs) {
    if (entry.grams === undefined || entry.grams <= 0) continue;
    const key = `${entry.name.toLowerCase()}|${entry.brand?.toLowerCase() ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const factor = 100 / entry.grams;
    out.push({
      name: entry.name,
      brand: entry.brand,
      grams: entry.grams,
      caloriesPer100g: entry.calories * factor,
      proteinPer100g: entry.proteinG * factor,
      carbsPer100g: entry.carbsG * factor,
      fatPer100g: entry.fatG * factor,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Macros for one serving of a recipe. In `macros` mode the stored numbers
 * already describe one serving (they're copied off a label); in `ingredients`
 * mode the itemised total is divided by the serving count.
 */
export function recipePerServing(recipe: Recipe): Macros {
  if (recipe.entryMode === 'macros') return recipe.perServing ?? EMPTY_MACROS;
  return scaleMacros(recipeTotals(recipe), 1 / Math.max(1, recipe.servings));
}

/** Whole-recipe macro totals — the sum of ingredients, or one serving scaled up. */
export function recipeTotals(recipe: Recipe): Macros {
  if (recipe.entryMode === 'macros') {
    return scaleMacros(recipe.perServing ?? EMPTY_MACROS, Math.max(1, recipe.servings));
  }
  return recipe.ingredients.reduce<Macros>((sum, ingredient) => addMacros(sum, ingredient), EMPTY_MACROS);
}

/** Date key shifted by whole days (negative = past). */
export function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** "Today", "Yesterday", or a short weekday+date label for the day header. */
export function dayLabel(dateKey: string): string {
  const today = todayKey();
  if (dateKey === today) return 'Today';
  if (dateKey === shiftDateKey(today, -1)) return 'Yesterday';
  if (dateKey === shiftDateKey(today, 1)) return 'Tomorrow';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
