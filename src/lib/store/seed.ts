/**
 * Defaults written to Supabase on first login (and used as the pre-hydration
 * fallback). The old fake demo data is gone — accounts start empty.
 */

import type { GoalDef, Preferences } from './types';

export const seedGoals: GoalDef[] = [
  { id: 'workouts', type: 'workouts', label: 'Workouts', target: 5, unit: 'workouts' },
  { id: 'calories', type: 'calories', label: 'Calories', target: 1500, unit: 'cal' },
  { id: 'cardio', type: 'cardio', label: 'Cardio', target: 60, unit: 'min' },
];

export const seedPreferences: Preferences = { unitSystem: 'imperial' };
