/**
 * Pure selectors over store data, so screens stay declarative. All date keys
 * are local YYYY-MM-DD strings (not UTC) so "today" matches the device.
 */

import type { Goals, ProgressPoint, Routine, Session } from './types';

export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** Day offsets from today shown as "planned" — placeholder until real scheduling exists. */
export const plannedDayOffsets = [0, 2, 4];

export function plannedDates(): Set<string> {
  return new Set(
    plannedDayOffsets.map((offset) => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return toDateKey(date);
    }),
  );
}

export interface WeekDay {
  date: string;
  label: string;
  done: boolean;
  isToday: boolean;
}

/** The current Sunday-to-Saturday week, with workout completion per day. */
export function weekStreak(sessions: Session[]): WeekDay[] {
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const doneDates = new Set(sessions.map((session) => session.date));
  const todaysKey = toDateKey(today);

  return labels.map((label, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const key = toDateKey(date);
    return { date: key, label, done: doneDates.has(key), isToday: key === todaysKey };
  });
}

export function weeklyProgress(sessions: Session[]): Goals {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const startKey = toDateKey(weekStart);
  const thisWeek = sessions.filter((session) => session.date >= startKey);

  return {
    workoutsPerWeek: thisWeek.length,
    calories: thisWeek.reduce((sum, session) => sum + (session.calories ?? 0), 0),
    cardioMinutes: 0, // cardio logging isn't tracked yet
  };
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
    points.push({ date: session.date, value: Math.max(...exercise.sets.map((set) => set.weight)) });
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
  | { status: 'completed'; session: Session }
  | { status: 'planned'; routine: Routine }
  | { status: 'rest' };

export function todayPlan(routines: Routine[], sessions: Session[]): TodayPlan {
  const key = todayKey();
  const session = sessions.find((s) => s.date === key);
  if (session) return { status: 'completed', session };
  if (plannedDates().has(key) && routines.length > 0) return { status: 'planned', routine: routines[0] };
  return { status: 'rest' };
}
