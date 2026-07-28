/**
 * Defaults written to Supabase on first login (and used as the pre-hydration
 * fallback). The old fake demo data is gone — accounts start empty.
 */

import { makeId } from './id';
import type { GoalDef, Preferences } from './types';

/** Fresh uuids each call — goal ids are real row ids since migration 0006. */
export function makeSeedGoals(): GoalDef[] {
  return [
    { id: makeId(), metric: 'workouts', label: 'Workouts', target: 5, unit: 'workouts' },
    { id: makeId(), metric: 'calories', label: 'Calories', target: 1500, unit: 'cal' },
    { id: makeId(), metric: 'cardio', label: 'Cardio', target: 60, unit: 'min' },
  ];
}

export const seedPreferences: Preferences = { unitSystem: 'imperial' };
