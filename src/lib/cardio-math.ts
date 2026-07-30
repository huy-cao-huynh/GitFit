/**
 * Pure geometry over a recorded GPS route — distance, elevation, splits, and
 * the elevation profile. Kept out of cardio-tracking.ts so that reading a
 * saved route never drags in expo-location, expo-task-manager, or the
 * module-scope background task those bring with them.
 *
 * Elevation throughout is derived from GPS altitude, not a barometer, so it is
 * smoothed and directional rather than precise.
 */

import type { GpsPoint, UnitSystem } from '@/lib/store/types';

const EARTH_RADIUS_MILES = 3958.7613;
const FEET_PER_METER = 3.28084;
const MI_PER_KM = 0.621371;
/** Trailing window (in samples) used to smooth altitude before summing gain. */
const ELEVATION_SMOOTHING_WINDOW = 5;
/** A trailing sliver shorter than this fraction of a unit isn't worth a split row. */
const MIN_PARTIAL_SPLIT_FRACTION = 0.05;

export function haversineMiles(a: GpsPoint, b: GpsPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

export function totalDistanceMiles(points: GpsPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMiles(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Moving-ms where a pause-aware route has it, raw clock time on routes
 * recorded before pause existed. Both are monotonic within a single route, so
 * callers only ever take differences.
 */
export function elapsedOf(point: GpsPoint): number {
  return point.e ?? point.t;
}

/**
 * Altitudes in feet, index-aligned to `points`. Fixes without an altitude
 * carry the previous value forward (null until the first one that has it), so
 * a sparse altitude signal can't shift every later sample onto the wrong
 * position in the route.
 */
export function smoothedAltitudesFt(points: GpsPoint[]): (number | null)[] {
  const filled: (number | null)[] = [];
  let carried: number | null = null;
  for (const point of points) {
    if (point.altitude != null) carried = point.altitude * FEET_PER_METER;
    filled.push(carried);
  }

  return filled.map((value, i) => {
    if (value == null) return null;
    const start = Math.max(0, i - ELEVATION_SMOOTHING_WINDOW + 1);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= i; j++) {
      const sample = filled[j];
      if (sample != null) {
        sum += sample;
        count++;
      }
    }
    return sum / count;
  });
}

/**
 * Total climb, as the sum of positive deltas across the smoothed altitude
 * series. Raw GPS altitude is noisy enough that summing unsmoothed deltas
 * wildly overstates gain; this is a deliberate approximation.
 */
export function smoothedElevationGainFt(points: GpsPoint[]): number {
  const known = smoothedAltitudesFt(points).filter((value): value is number => value != null);
  if (known.length < ELEVATION_SMOOTHING_WINDOW + 1) return 0;

  let gain = 0;
  for (let i = 1; i < known.length; i++) {
    const delta = known[i] - known[i - 1];
    if (delta > 0) gain += delta;
  }
  return gain;
}

// ---------------------------------------------------------------------------
// Splits
// ---------------------------------------------------------------------------

export interface CardioSplit {
  /** 1-based: split 1 is the first mile or kilometre. */
  index: number;
  distanceMiles: number;
  seconds: number;
  /** Pace normalised to a whole unit, so a partial last split is comparable. */
  secPerMile: number;
  elevationGainFt: number;
  /** True for a trailing split that didn't reach a full unit. */
  partial: boolean;
}

interface Cumulative {
  distanceMiles: number;
  ms: number;
  climbFt: number;
}

/**
 * One row per whole mile or kilometre, plus a trailing partial. Split
 * boundaries fall between GPS fixes, so the crossing time and climb are
 * interpolated within the segment that straddles them rather than snapped to
 * the nearest sample.
 *
 * Times come from `elapsedOf`, so a pause is excluded rather than being
 * charged to whichever split it happened in.
 */
export function cardioSplits(points: GpsPoint[], system: UnitSystem): CardioSplit[] {
  if (points.length < 2) return [];

  const unitMiles = system === 'metric' ? MI_PER_KM : 1;
  const altitudes = smoothedAltitudesFt(points);
  const base = elapsedOf(points[0]);

  const running: Cumulative[] = [{ distanceMiles: 0, ms: 0, climbFt: 0 }];
  for (let i = 1; i < points.length; i++) {
    const previous = running[i - 1];
    const here = altitudes[i];
    const before = altitudes[i - 1];
    const rise = here != null && before != null ? Math.max(0, here - before) : 0;
    running.push({
      distanceMiles: previous.distanceMiles + haversineMiles(points[i - 1], points[i]),
      // Clamp so a stray out-of-order timestamp can't run the clock backwards.
      ms: Math.max(previous.ms, elapsedOf(points[i]) - base),
      climbFt: previous.climbFt + rise,
    });
  }

  const total = running[running.length - 1];
  if (total.distanceMiles <= 0) return [];

  const splits: CardioSplit[] = [];
  let from = running[0];

  const fullSplits = Math.floor(total.distanceMiles / unitMiles);
  for (let n = 1; n <= fullSplits; n++) {
    const to = interpolateAt(n * unitMiles, running);
    splits.push(buildSplit(splits.length + 1, from, to, unitMiles, false));
    from = to;
  }

  const remainder = total.distanceMiles - fullSplits * unitMiles;
  if (remainder > unitMiles * MIN_PARTIAL_SPLIT_FRACTION) {
    splits.push(buildSplit(splits.length + 1, from, total, unitMiles, true));
  }
  return splits;
}

function interpolateAt(targetMiles: number, running: Cumulative[]): Cumulative {
  for (let i = 1; i < running.length; i++) {
    const before = running[i - 1];
    const after = running[i];
    if (after.distanceMiles < targetMiles) continue;

    const span = after.distanceMiles - before.distanceMiles;
    const fraction = span > 0 ? (targetMiles - before.distanceMiles) / span : 0;
    return {
      distanceMiles: targetMiles,
      ms: before.ms + (after.ms - before.ms) * fraction,
      climbFt: before.climbFt + (after.climbFt - before.climbFt) * fraction,
    };
  }
  return running[running.length - 1];
}

function buildSplit(
  index: number,
  from: Cumulative,
  to: Cumulative,
  unitMiles: number,
  partial: boolean,
): CardioSplit {
  const distanceMiles = to.distanceMiles - from.distanceMiles;
  const seconds = (to.ms - from.ms) / 1000;
  return {
    index,
    distanceMiles,
    seconds,
    secPerMile: distanceMiles > 0 ? seconds / distanceMiles : 0,
    elevationGainFt: to.climbFt - from.climbFt,
    partial,
  };
}

// ---------------------------------------------------------------------------
// Elevation profile
// ---------------------------------------------------------------------------

export interface ElevationPoint {
  distanceMiles: number;
  altitudeFt: number;
}

/**
 * Altitude against cumulative distance, downsampled for drawing. X is real
 * distance, not sample index, so a stretch with sparse fixes doesn't stretch
 * horizontally on the chart.
 */
export function cardioElevationProfile(points: GpsPoint[], maxPoints = 60): ElevationPoint[] {
  if (points.length < 2) return [];
  const altitudes = smoothedAltitudesFt(points);

  const profile: ElevationPoint[] = [];
  let distanceMiles = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) distanceMiles += haversineMiles(points[i - 1], points[i]);
    const altitudeFt = altitudes[i];
    if (altitudeFt != null) profile.push({ distanceMiles, altitudeFt });
  }
  if (profile.length < 2) return [];

  if (profile.length <= maxPoints) return profile;
  const step = (profile.length - 1) / (maxPoints - 1);
  const sampled: ElevationPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    sampled.push(profile[Math.round(i * step)]);
  }
  return sampled;
}
