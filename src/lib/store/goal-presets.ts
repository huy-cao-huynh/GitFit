import type { GoalMetric } from './types';

export interface GoalPreset {
  metric: Exclude<GoalMetric, 'manual'>;
  label: string;
  target: number;
  unit: string;
}

/** The built-in goals, offered as one-tap re-adds when missing (logging tab) or as starter picks (onboarding). */
export const BUILTIN_GOAL_PRESETS: GoalPreset[] = [
  { metric: 'workouts', label: 'Workouts', target: 5, unit: 'workouts' },
  { metric: 'calories', label: 'Calories Burned', target: 1500, unit: 'cal' },
  { metric: 'cardio', label: 'Cardio', target: 60, unit: 'min' },
  { metric: 'water', label: 'Water', target: 448, unit: 'oz' },
  { metric: 'steps', label: 'Steps', target: 70000, unit: 'steps' },
  { metric: 'bodyweight', label: 'Weigh In', target: 1, unit: 'weigh-ins' },
];
