/**
 * Barbell plate decomposition for the PR celebration's loaded-bar illustration.
 *
 * Pure — no React, no store. Canonical storage is lbs (see src/lib/units.ts),
 * but plate denominations are unit-system specific, so the total is converted
 * to display units first and everything downstream (bar, plates, remainder)
 * speaks that same display unit.
 */

import type { UnitSystem } from '@/lib/store/types';
import { toDisplayWeight } from '@/lib/units';

/** Standard olympic bar, in display units. */
const BAR_WEIGHT: Record<UnitSystem, number> = { imperial: 45, metric: 20 };

/** Available plates per side, heaviest first. */
const DENOMINATIONS: Record<UnitSystem, readonly number[]> = {
  imperial: [45, 35, 25, 10, 5, 2.5],
  metric: [25, 20, 15, 10, 5, 2.5, 1.25],
};

/**
 * Past six plates a side the illustration stops being readable and the
 * per-plate haptic turns into a buzz, so the tail collapses into `remainder`.
 */
const MAX_PLATES_PER_SIDE = 6;

/** Display units are rounded to 1dp, so anything under this is float noise. */
const EPSILON = 0.05;

export interface PlateLoad {
  /** Bar weight in display units. */
  barWeight: number;
  /** Plate denominations for ONE side, heaviest first. */
  perSide: number[];
  /** Display-unit weight the plates couldn't account for (odd loads, plate cap). */
  remainder: number;
  /** False when the total is at or below the bar — dumbbell, machine, bodyweight. */
  isBarbell: boolean;
}

/**
 * Greedy heaviest-first decomposition of `(total - bar) / 2`. Greedy is exact
 * for both plate sets here (each denomination divides every larger one, give or
 * take the 35/45 pair, which greedy still resolves via the smaller plates), and
 * it matches how a lifter actually loads a bar.
 */
export function platesForWeight(lbs: number, system: UnitSystem): PlateLoad {
  const total = toDisplayWeight(lbs, system);
  const barWeight = BAR_WEIGHT[system];

  if (total <= barWeight + EPSILON) {
    return { barWeight, perSide: [], remainder: 0, isBarbell: false };
  }

  let perSideRemaining = (total - barWeight) / 2;
  const perSide: number[] = [];

  for (const plate of DENOMINATIONS[system]) {
    while (perSideRemaining >= plate - EPSILON && perSide.length < MAX_PLATES_PER_SIDE) {
      perSide.push(plate);
      perSideRemaining -= plate;
    }
    if (perSide.length >= MAX_PLATES_PER_SIDE) break;
  }

  const remainder = perSideRemaining * 2;
  return {
    barWeight,
    perSide,
    remainder: remainder < EPSILON ? 0 : Math.round(remainder * 10) / 10,
    isBarbell: true,
  };
}
