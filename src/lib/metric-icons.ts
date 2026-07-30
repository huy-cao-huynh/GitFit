import type { SFSymbol } from 'expo-symbols';

import type { GoalMetric } from '@/lib/store/types';

/**
 * SF Symbol per goal metric, shared by the Log tab's goal editor and the
 * dashboard's metric deck so a metric always wears the same glyph.
 * `manual` goals have no inherent icon and fall back to CHECK_IN_ICON.
 */
export const METRIC_ICONS: Record<Exclude<GoalMetric, 'manual'>, SFSymbol> = {
  workouts: 'dumbbell.fill',
  calories: 'flame.fill',
  cardio: 'figure.run',
  water: 'drop.fill',
  steps: 'figure.walk',
  bodyweight: 'scalemass.fill',
};

/** Manual +1 check-in goals. */
export const CHECK_IN_ICON: SFSymbol = 'checkmark.circle.fill';

/** Calories eaten — sourced from the Nutrition tab, not from a goal. */
export const INTAKE_ICON: SFSymbol = 'fork.knife';
