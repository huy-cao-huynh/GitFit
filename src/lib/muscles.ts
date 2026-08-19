import type { MuscleLayers } from '@/lib/anatome/layers';
import type { Routine, RoutineExercise, SessionExercise } from '@/lib/store/types';

/**
 * Keyword-based mapping from exercise names to targeted muscle groups, used
 * for the chips on the workout-session screens. First matching rule wins, so
 * specific patterns (leg curl, leg extension) come before generic ones
 * (curl, extension). Purely cosmetic — unknown names return no groups.
 *
 * `secondary` marks which of `groups` is the assisting muscle for diagram
 * coloring (e.g. bench press: Chest is the primary mover, Triceps assists) —
 * `muscleGroupsFor`/the chip row don't care about the split and keep using
 * the full `groups` list.
 */

const RULES: { pattern: RegExp; groups: string[]; secondary?: string[] }[] = [
  { pattern: /leg curl|hamstring|nordic/i, groups: ['Hamstrings'] },
  { pattern: /leg extension/i, groups: ['Quads'] },
  { pattern: /calf|calves/i, groups: ['Calves'] },
  { pattern: /squat|leg press|lunge|step[- ]?up|pistol/i, groups: ['Quads', 'Glutes'], secondary: ['Glutes'] },
  { pattern: /deadlift|rdl|good morning/i, groups: ['Hamstrings', 'Glutes', 'Back'], secondary: ['Back'] },
  { pattern: /hip thrust|glute/i, groups: ['Glutes'] },
  { pattern: /bench|chest|fly|flye|push[- ]?up/i, groups: ['Chest', 'Triceps'], secondary: ['Triceps'] },
  { pattern: /\bdip\b/i, groups: ['Triceps', 'Chest'], secondary: ['Chest'] },
  {
    pattern: /overhead press|shoulder press|\bohp\b|military|lateral raise|front raise|delt|shrug|face pull|upright row/i,
    groups: ['Shoulders'],
  },
  { pattern: /\brow\b|pull[- ]?up|chin[- ]?up|pulldown|pullover|\blat\b/i, groups: ['Back', 'Biceps'], secondary: ['Biceps'] },
  { pattern: /curl/i, groups: ['Biceps'] },
  { pattern: /pushdown|skull|tricep|close[- ]?grip|extension/i, groups: ['Triceps'] },
  { pattern: /plank|crunch|sit[- ]?up|\bab\b|abs|core|russian|leg raise|hollow/i, groups: ['Core'] },
  { pattern: /clean|snatch|thruster|burpee|swing|carry|sled/i, groups: ['Full body'] },
  { pattern: /run|sprint|bike|cycle|jump rope|rower|erg/i, groups: ['Cardio'] },
];

export function muscleGroupsFor(exerciseName: string): string[] {
  for (const rule of RULES) {
    if (rule.pattern.test(exerciseName)) return rule.groups;
  }
  return [];
}

/**
 * Maps the cosmetic group vocabulary above to Anatome's canonical muscle
 * slugs — the "association bank" fallback for custom exercise names that
 * were never resolved via the Anatome exercise-lookup search. 'Full body'
 * and 'Cardio' have no single-muscle mapping, so they render no diagram.
 */
const GROUP_SLUGS: Record<string, string[]> = {
  Hamstrings: ['hamstring'],
  Quads: ['quadriceps'],
  Calves: ['calves'],
  Glutes: ['gluteal'],
  Back: ['upper-back'],
  Chest: ['chest'],
  Triceps: ['triceps'],
  Shoulders: ['deltoids'],
  Biceps: ['biceps'],
  Core: ['abs', 'obliques'],
  'Full body': [],
  Cardio: [],
};

/** Anatome primary/secondary slugs for a (possibly custom, untracked) exercise name, keyed off the same keyword rules as muscleGroupsFor. */
export function anatomeSlugsFor(exerciseName: string): MuscleLayers {
  for (const rule of RULES) {
    if (!rule.pattern.test(exerciseName)) continue;
    const secondaryGroups = new Set(rule.secondary ?? []);
    const primary = new Set<string>();
    const secondary = new Set<string>();
    for (const group of rule.groups) {
      const target = secondaryGroups.has(group) ? secondary : primary;
      for (const slug of GROUP_SLUGS[group] ?? []) target.add(slug);
    }
    return { primary: [...primary], secondary: [...secondary] };
  }
  return { primary: [], secondary: [] };
}

/** An exercise's muscle layers: stored Anatome-lookup data if present, else the keyword-rule fallback. */
export function resolveMuscleLayers(
  exercise: Pick<RoutineExercise | SessionExercise, 'name' | 'primaryMuscles' | 'secondaryMuscles'>,
): MuscleLayers {
  if (exercise.primaryMuscles?.length) {
    return { primary: exercise.primaryMuscles, secondary: exercise.secondaryMuscles ?? [] };
  }
  return anatomeSlugsFor(exercise.name);
}

/**
 * Merges primary/secondary muscle slugs across several exercises into one
 * diagram's worth of layers — used for a routine's or a completed session's
 * combined muscle diagram. A slug that's primary for any exercise in the set
 * is treated as primary overall, even if another exercise lists it as
 * secondary.
 */
export function mergeMuscleLayers(
  exercises: Pick<RoutineExercise | SessionExercise, 'name' | 'primaryMuscles' | 'secondaryMuscles'>[],
): MuscleLayers {
  const primary = new Set<string>();
  const secondary = new Set<string>();
  for (const exercise of exercises) {
    const layers = resolveMuscleLayers(exercise);
    for (const slug of layers.primary) primary.add(slug);
    for (const slug of layers.secondary) secondary.add(slug);
  }
  for (const slug of primary) secondary.delete(slug);
  return { primary: [...primary], secondary: [...secondary] };
}

export const MAX_MUSCLE_CHIPS = 4;

/** Deduped muscle groups across a routine's exercises, capped so a chip row stays one or two lines. */
export function muscleChipsFor(routine: Routine): string[] {
  const seen: string[] = [];
  for (const exercise of routine.exercises) {
    for (const group of muscleGroupsFor(exercise.name)) {
      if (!seen.includes(group)) seen.push(group);
    }
  }
  return seen.slice(0, MAX_MUSCLE_CHIPS);
}
