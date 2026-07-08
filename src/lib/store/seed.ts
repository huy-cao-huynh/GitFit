/**
 * First-run data written to AsyncStorage so the app has believable content
 * before real logging accumulates. Replaced by Supabase sync later.
 */

import type {
  BodyweightEntry,
  CheckoffDef,
  CheckoffLog,
  Goals,
  Routine,
  Session,
  StepsEntry,
} from './types';

function localDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export const seedRoutines: Routine[] = [
  {
    id: 'upper-body-push',
    name: 'Upper Body Push',
    level: 'Beginner',
    durationMinutes: 20,
    tileColor: 'rgba(118,120,237,0.25)',
    exercises: [
      { id: 'bench-press', name: 'Bench Press', sets: 3, targetReps: 8, targetWeight: 135, lastTime: { reps: 8, weight: 130 } },
      { id: 'overhead-press', name: 'Overhead Press', sets: 3, targetReps: 10, targetWeight: 65, lastTime: { reps: 8, weight: 60 } },
      { id: 'bodyweight-w-fly', name: 'Bodyweight W Fly', sets: 3, targetReps: 12, targetWeight: 35, lastTime: { reps: 10, weight: 30 } },
      { id: 'adductor-rock-back', name: 'Adductor Rock Back', sets: 3, targetReps: 15, targetWeight: 0, lastTime: { reps: 12, weight: 0 } },
    ],
  },
  {
    id: 'leg-day',
    name: 'Leg Day',
    level: 'Intermediate',
    durationMinutes: 35,
    tileColor: 'rgba(247,184,1,0.22)',
    exercises: [
      { id: 'squat', name: 'Squat', sets: 4, targetReps: 6, targetWeight: 185, lastTime: { reps: 6, weight: 175 } },
      { id: 'romanian-deadlift', name: 'Romanian Deadlift', sets: 3, targetReps: 8, targetWeight: 155, lastTime: { reps: 8, weight: 145 } },
      { id: 'leg-press', name: 'Leg Press', sets: 3, targetReps: 10, targetWeight: 270, lastTime: { reps: 10, weight: 260 } },
      { id: 'walking-lunge', name: 'Walking Lunge', sets: 3, targetReps: 12, targetWeight: 30, lastTime: { reps: 12, weight: 25 } },
      { id: 'calf-raise', name: 'Calf Raise', sets: 3, targetReps: 15, targetWeight: 90, lastTime: { reps: 15, weight: 90 } },
    ],
  },
  {
    id: 'full-body-circuit',
    name: 'Full Body Circuit',
    level: 'Advanced',
    durationMinutes: 45,
    tileColor: 'rgba(241,135,1,0.22)',
    exercises: [
      { id: 'push-up', name: 'Push-up', sets: 3, targetReps: 15, targetWeight: 0, lastTime: { reps: 14, weight: 0 } },
      { id: 'goblet-squat', name: 'Goblet Squat', sets: 3, targetReps: 12, targetWeight: 45, lastTime: { reps: 12, weight: 40 } },
      { id: 'bent-over-row', name: 'Bent-over Row', sets: 3, targetReps: 10, targetWeight: 95, lastTime: { reps: 10, weight: 90 } },
      { id: 'plank', name: 'Plank', sets: 3, targetReps: 1, targetWeight: 0, lastTime: null },
      { id: 'mountain-climbers', name: 'Mountain Climbers', sets: 3, targetReps: 20, targetWeight: 0, lastTime: null },
      { id: 'burpee', name: 'Burpee', sets: 3, targetReps: 10, targetWeight: 0, lastTime: null },
    ],
  },
];

const historySeeds = [
  { routineId: 'upper-body-push', daysAgo: 1, durationMinutes: 22 },
  { routineId: 'leg-day', daysAgo: 2, durationMinutes: 38 },
  { routineId: 'full-body-circuit', daysAgo: 4, durationMinutes: 45 },
  { routineId: 'upper-body-push', daysAgo: 8, durationMinutes: 20 },
  { routineId: 'leg-day', daysAgo: 11, durationMinutes: 35 },
];

/** Past sessions with synthesized per-set logs so History detail has content. */
export function buildSeedSessions(): Session[] {
  return historySeeds.map((seed, index) => {
    const routine = seedRoutines.find((r) => r.id === seed.routineId)!;
    const weeksAgo = Math.floor(seed.daysAgo / 7);
    return {
      id: `seed-session-${index}`,
      routineId: routine.id,
      routineName: routine.name,
      date: localDaysAgo(seed.daysAgo),
      durationMinutes: seed.durationMinutes,
      calories: seed.durationMinutes * 8,
      exercises: routine.exercises.map((exercise, exerciseIndex) => ({
        exerciseId: exercise.id,
        name: exercise.name,
        sets: Array.from({ length: exercise.sets }, (_, setIndex) => ({
          reps: Math.max(1, exercise.targetReps + ((exerciseIndex + setIndex + index) % 3) - 1),
          weight: Math.max(0, exercise.targetWeight - 5 * weeksAgo),
        })),
      })),
    };
  });
}

/** Deterministic 90-day walk between ~6k and ~12k steps, until HealthKit lands. */
export function buildSeedSteps(): StepsEntry[] {
  const entries: StepsEntry[] = [];
  let value = 9000;
  for (let daysAgo = 89; daysAgo >= 0; daysAgo -= 1) {
    value += Math.sin(daysAgo * 1.7) * 1400 + (((daysAgo * 37) % 7) - 3) * 250;
    value = Math.min(12000, Math.max(6000, value));
    entries.push({ date: localDaysAgo(daysAgo), steps: Math.round(value) });
  }
  return entries;
}

export const seedBodyweight: BodyweightEntry[] = [
  { date: localDaysAgo(42), weight: 182 },
  { date: localDaysAgo(35), weight: 181 },
  { date: localDaysAgo(28), weight: 180 },
  { date: localDaysAgo(21), weight: 179 },
  { date: localDaysAgo(14), weight: 179 },
  { date: localDaysAgo(7), weight: 178 },
  { date: localDaysAgo(1), weight: 177 },
];

export const seedGoals: Goals = {
  workoutsPerWeek: 5,
  calories: 600,
  cardioMinutes: 30,
};

export const seedCheckoffDefs: CheckoffDef[] = [
  { id: 'water', name: 'Drink water' },
  { id: 'supplements', name: 'Take supplements' },
];

export function buildSeedCheckoffLog(sessions: Session[]): CheckoffLog {
  const log: CheckoffLog = {};
  for (const session of sessions) {
    log[session.date] = seedCheckoffDefs.map((def) => def.id);
  }
  return log;
}
