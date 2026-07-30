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
  sport: 'sportscourt.fill',
  other: 'figure.mixed.cardio',
};
