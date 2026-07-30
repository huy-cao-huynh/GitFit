import type { SFSymbol } from 'expo-symbols';

import type { CardioActivityType } from '@/lib/store/types';

/**
 * SF Symbol per cardio activity type, shared by the cardio routine editor,
 * the Workouts list, and the dashboard's TodayWorkoutCard so an activity
 * always wears the same glyph — instead of every cardio routine showing a
 * generic running figure regardless of what it actually is.
 */
export const ACTIVITY_ICONS: Record<CardioActivityType, SFSymbol> = {
  walk: 'figure.walk',
  run: 'figure.run',
  hike: 'figure.hiking',
  swim: 'figure.pool.swim',
  cycle: 'figure.outdoor.cycle',
  other: 'figure.mixed.cardio',
};

export const ACTIVITY_TYPES: CardioActivityType[] = ['walk', 'run', 'hike', 'swim', 'cycle', 'other'];

/** Display label per cardio activity type, shared by the routine editor, the ad-hoc activity picker, and any screen synthesizing a name for an unrouted session. */
export const ACTIVITY_LABELS: Record<CardioActivityType, string> = {
  walk: 'Walk',
  run: 'Run',
  hike: 'Hike',
  swim: 'Swim',
  cycle: 'Cycle',
  other: 'Other',
};
