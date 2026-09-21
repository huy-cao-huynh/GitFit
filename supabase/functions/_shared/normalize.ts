import { stravaSportTypeToCardioActivityType } from './sport-type.ts';
import type { CardioSessionRow, GpsPoint, StravaActivity, StravaStreamSet } from './types.ts';

const METERS_PER_MILE = 1609.34;
const FEET_PER_METER = 3.28084;

/**
 * Reconstructs GitFit's GpsPoint[] shape from a Strava streams response.
 * Strava's `time` stream is seconds elapsed since the activity's start, not
 * an absolute timestamp, so `startDateIso` (the activity's start_date) is
 * needed to compute each point's absolute epoch ms -- matching what
 * src/lib/cardio-tracking.ts records locally. Altitude is stored in meters,
 * same as GitFit's own GPS capture (see cardio-math.ts's FEET_PER_METER
 * conversion, which happens only at render/derive time, never at capture).
 * Returns null when Strava has no lat/lng stream for this activity (e.g. a
 * manually-entered or indoor activity).
 */
export function buildGpsPointsFromStreams(streams: StravaStreamSet, startDateIso: string): GpsPoint[] | null {
  const latlng = streams.latlng?.data;
  if (!latlng || latlng.length === 0) return null;

  const startMs = new Date(startDateIso).getTime();
  const times = streams.time?.data;
  const altitudes = streams.altitude?.data;

  return latlng.map(([lat, lng], index) => {
    const offsetSec = times?.[index] ?? index;
    const point: GpsPoint = { lat, lng, t: startMs + offsetSec * 1000 };
    if (altitudes?.[index] != null) point.altitude = altitudes[index];
    return point;
  });
}

/**
 * Maps a fetched Strava activity (+ optional streams) into the fields GitFit
 * needs for a cardio_sessions row -- everything except `id`, which the
 * caller assigns (a fresh uuid for a new import, or the existing row's id
 * for an update). Pure and network-free so it's unit-testable without a live
 * Strava call.
 */
export function normalizeStravaActivity(
  activity: StravaActivity,
  streams: StravaStreamSet,
): Omit<CardioSessionRow, 'id' | 'routine_id'> {
  const distanceMiles = activity.distance > 0 ? activity.distance / METERS_PER_MILE : null;
  const minutes = Math.max(1, Math.round(activity.moving_time / 60));
  const elevationGainFt = activity.total_elevation_gain > 0 ? activity.total_elevation_gain * FEET_PER_METER : null;
  const avgPaceSecPerMile =
    distanceMiles && distanceMiles > 0 ? activity.moving_time / distanceMiles : null;

  return {
    name: activity.name,
    activity_type: stravaSportTypeToCardioActivityType(activity.sport_type, activity.type),
    date: activity.start_date_local.slice(0, 10),
    minutes,
    distance_miles: distanceMiles,
    calories: activity.calories ?? null,
    route: buildGpsPointsFromStreams(streams, activity.start_date),
    elevation_gain_ft: elevationGainFt,
    avg_pace_sec_per_mile: avgPaceSecPerMile,
  };
}

export function stravaActivityUrl(activityId: number): string {
  return `https://www.strava.com/activities/${activityId}`;
}
