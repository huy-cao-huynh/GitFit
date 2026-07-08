/**
 * Pure selectors over store data, so screens stay declarative. All date keys
 * are local YYYY-MM-DD strings (not UTC) so "today" matches the device.
 */

import type {
  CardioActivityType,
  CardioSession,
  CheckoffDef,
  CheckoffLog,
  GoalDef,
  ProgressPoint,
  Routine,
  Session,
  WaterEntry,
  Weekday,
} from './types';

/** Rough calories/minute per activity — same "placeholder until HealthKit" spirit as the strength session heuristic. */
const CARDIO_CALORIES_PER_MINUTE: Record<CardioActivityType, number> = {
  walk: 4,
  run: 10,
  hike: 7,
  swim: 8,
  cycle: 7,
  sport: 8,
  other: 6,
};

export function estimateCardioCalories(activityType: CardioActivityType, minutes: number): number {
  return Math.round(minutes * CARDIO_CALORIES_PER_MINUTE[activityType]);
}

export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export const WEEKDAY_OPTIONS: { value: Weekday; short: string; label: string }[] = [
  { value: 1, short: 'M', label: 'Monday' },
  { value: 2, short: 'T', label: 'Tuesday' },
  { value: 3, short: 'W', label: 'Wednesday' },
  { value: 4, short: 'T', label: 'Thursday' },
  { value: 5, short: 'F', label: 'Friday' },
  { value: 6, short: 'S', label: 'Saturday' },
  { value: 7, short: 'S', label: 'Sunday' },
];

const CALENDAR_WEEKDAY_OPTIONS: { value: Weekday; short: string; label: string }[] = [
  { value: 7, short: 'S', label: 'Sunday' },
  ...WEEKDAY_OPTIONS.slice(0, 6),
];

function dateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function weekdayForDate(date: Date): Weekday {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

function weekStartKey(): string {
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

  return CALENDAR_WEEKDAY_OPTIONS.map((option, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    const dateKey = toDateKey(date);
    const tasks = scheduledRoutineTasks(routines, sessions, cardioSessions, dateKey);
    return {
      date: dateKey,
      label: option.short,
      dayNumber: date.getDate(),
      isToday: dateKey === todaysKey,
      scheduledCount: tasks.length,
      completedCount: tasks.filter((task) => task.completed).length,
    };
  });
}

export function routineScheduleLabel(routine: Routine): string {
  if (!routine.scheduledDays || routine.scheduledDays.length === 0) return 'No schedule';
  if (routine.scheduledDays.length === 7) return 'Every day';
  return WEEKDAY_OPTIONS.filter((option) => routine.scheduledDays?.includes(option.value))
    .map((option) => option.short)
    .join(', ');
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
): number {
  const startKey = weekStartKey();
  switch (goal.type) {
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
    default:
      return 0;
  }
}

/** Today's logged water, independent of the weekly ring math — the bottle fills daily. */
export function todayWaterOunces(waterEntries: WaterEntry[]): number {
  const key = todayKey();
  return waterEntries.filter((e) => e.date === key).reduce((sum, e) => sum + e.ounces, 0);
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
    const weights = exercise.sets.map((set) => set.weight ?? 0).filter((weight) => weight > 0);
    if (weights.length === 0) continue;
    points.push({ date: session.date, value: Math.max(...weights) });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
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
  const parsed = new Date(birthday);
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
