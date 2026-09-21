import type { CardioActivityType } from './types.ts';

/**
 * Strava sport_type values GitFit imports FROM Strava (create/update webhook
 * events for any other sport_type are ignored). Swim is deliberately excluded
 * from MVP import: Strava's pool-swim data uses lap/pool-length units that
 * don't map cleanly onto GitFit's plain distanceMiles model. Documented scope
 * cut, not an oversight -- see the Strava integration plan's known
 * limitations.
 */
export const STRAVA_IMPORT_SPORT_TYPES: Record<string, CardioActivityType> = {
  Run: 'run',
  TrailRun: 'run',
  VirtualRun: 'run',
  Walk: 'walk',
  Hike: 'hike',
  Ride: 'cycle',
  GravelRide: 'cycle',
  MountainBikeRide: 'cycle',
  VirtualRide: 'cycle',
  EBikeRide: 'cycle',
};

/**
 * GitFit -> Strava sport_type for exporting a GitFit-recorded cardio session.
 * Broader than the import allow-list on purpose: export symmetry isn't
 * required to match import scope, and GitFit already models these types.
 */
const GITFIT_CARDIO_TO_STRAVA_SPORT_TYPE: Record<CardioActivityType, string> = {
  run: 'Run',
  walk: 'Walk',
  hike: 'Hike',
  cycle: 'Ride',
  swim: 'Swim',
  other: 'Workout',
};

export function isImportableStravaActivity(sportType: string): boolean {
  return sportType in STRAVA_IMPORT_SPORT_TYPES;
}

/** Maps a Strava sport_type (falling back to the legacy `type` field) to a GitFit CardioActivityType. */
export function stravaSportTypeToCardioActivityType(
  sportType: string,
  legacyType?: string,
): CardioActivityType {
  return STRAVA_IMPORT_SPORT_TYPES[sportType] ?? STRAVA_IMPORT_SPORT_TYPES[legacyType ?? ''] ?? 'other';
}

export function cardioActivityTypeToStravaSportType(activityType: CardioActivityType): string {
  return GITFIT_CARDIO_TO_STRAVA_SPORT_TYPE[activityType];
}

/** Strength sessions always export as Strava's weight-training sport type. */
export const STRENGTH_STRAVA_SPORT_TYPE = 'WeightTraining';
