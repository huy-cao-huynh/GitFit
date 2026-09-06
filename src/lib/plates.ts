/**
 * Plate decomposition for the PR celebration's loaded-implement illustration.
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

/** Loadable dumbbell handle, in display units. */
const DUMBBELL_HANDLE: Record<UnitSystem, number> = { imperial: 5, metric: 2.5 };

/** Available plates per side, heaviest first. */
const DENOMINATIONS: Record<UnitSystem, readonly number[]> = {
  imperial: [45, 35, 25, 10, 5, 2.5],
  metric: [25, 20, 15, 10, 5, 2.5, 1.25],
};

/**
 * Eight a side covers a 765 lb total, so nothing a human lifts collapses into
 * `remainder`. Readability past that point is BarbellLoad's problem — it
 * scales plate widths down to fit the sleeve rather than dropping plates.
 */
const MAX_PLATES_PER_SIDE = 8;

/** Display units are rounded to 1dp, so anything under this is float noise. */
const EPSILON = 0.05;

/**
 * Exercises that are dumbbell work whatever the load — a 60 lb dumbbell press
 * would otherwise draw a barbell just for clearing bar weight. Same
 * keyword-rule shape as `muscleGroupsFor` in src/lib/muscles.ts.
 */
const DUMBBELL_PATTERN = /dumbbell|dumbell|\bdbs?\b/i;

export type Implement = 'barbell' | 'dumbbell';

export interface PlateLoad {
  /** Bar or handle weight in display units. */
  barWeight: number;
  /** Plate denominations for ONE side, heaviest first. */
  perSide: number[];
  /** Display-unit weight the plates couldn't account for (odd loads, plate cap). */
  remainder: number;
  /** Which implement to draw. Every load draws one — there is no empty state. */
  implement: Implement;
}

/**
 * Name first, weight second: the name is the only signal that survives a heavy
 * dumbbell, and below bar weight a barbell is impossible anyway.
 */
export function implementFor(exerciseName: string, displayTotal: number, system: UnitSystem): Implement {
  if (DUMBBELL_PATTERN.test(exerciseName)) return 'dumbbell';
  return displayTotal < BAR_WEIGHT[system] - EPSILON ? 'dumbbell' : 'barbell';
}

/**
 * Greedy heaviest-first decomposition of `(total - bar) / 2`. Greedy is exact
 * for both plate sets here (each denomination divides every larger one, give or
 * take the 35/45 pair, which greedy still resolves via the smaller plates), and
 * it matches how a lifter actually loads a bar.
 */
export function platesForWeight(lbs: number, system: UnitSystem, exerciseName = ''): PlateLoad {
  const total = toDisplayWeight(lbs, system);
  const implement = implementFor(exerciseName, total, system);
  const barWeight = implement === 'dumbbell' ? DUMBBELL_HANDLE[system] : BAR_WEIGHT[system];

  // A bare bar or bare handle still gets drawn — the illustration is never
  // skipped, it just carries no plates.
  if (total <= barWeight + EPSILON) {
    return { barWeight: Math.min(barWeight, total), perSide: [], remainder: 0, implement };
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
    implement,
  };
}
