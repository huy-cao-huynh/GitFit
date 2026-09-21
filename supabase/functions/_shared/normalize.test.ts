import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildGpsPointsFromStreams, normalizeStravaActivity, stravaActivityUrl } from './normalize.ts';
import type { StravaActivity, StravaStreamSet } from './types.ts';

Deno.test('buildGpsPointsFromStreams reconstructs absolute epoch time from the start date + offsets', () => {
  const streams: StravaStreamSet = {
    latlng: { data: [[37.7749, -122.4194], [37.775, -122.4195]] },
    time: { data: [0, 5] },
    altitude: { data: [15.2, 15.8] },
  };
  const points = buildGpsPointsFromStreams(streams, '2026-09-06T08:00:00Z');
  assertEquals(points, [
    { lat: 37.7749, lng: -122.4194, t: Date.parse('2026-09-06T08:00:00Z'), altitude: 15.2 },
    { lat: 37.775, lng: -122.4195, t: Date.parse('2026-09-06T08:00:00Z') + 5000, altitude: 15.8 },
  ]);
});

Deno.test('buildGpsPointsFromStreams returns null when there is no latlng stream', () => {
  assertEquals(buildGpsPointsFromStreams({}, '2026-09-06T08:00:00Z'), null);
});

Deno.test('buildGpsPointsFromStreams omits altitude for points without an altitude sample', () => {
  const streams: StravaStreamSet = { latlng: { data: [[1, 2]] }, time: { data: [0] } };
  const points = buildGpsPointsFromStreams(streams, '2026-09-06T08:00:00Z');
  assertEquals(points, [{ lat: 1, lng: 2, t: Date.parse('2026-09-06T08:00:00Z') }]);
});

function activity(overrides: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: 123,
    name: 'Morning Run',
    type: 'Run',
    sport_type: 'Run',
    distance: 8079.34, // ~5.02 mi
    moving_time: 2520, // 42 min
    elapsed_time: 2580,
    total_elevation_gain: 95.1, // ~312 ft
    start_date: '2026-09-06T14:00:00Z',
    start_date_local: '2026-09-06T07:00:00',
    private: false,
    ...overrides,
  };
}

Deno.test('normalizeStravaActivity converts distance, elevation, and pace to GitFit units', () => {
  const normalized = normalizeStravaActivity(activity(), {});
  assertEquals(normalized.name, 'Morning Run');
  assertEquals(normalized.activity_type, 'run');
  assertEquals(normalized.date, '2026-09-06');
  assertEquals(normalized.minutes, 42);
  assertEquals(normalized.distance_miles?.toFixed(2), '5.02');
  assertEquals(normalized.elevation_gain_ft?.toFixed(0), '312');
  assertEquals(normalized.route, null);
});

Deno.test('normalizeStravaActivity handles a distance-less activity (e.g. indoor) without dividing by zero', () => {
  const normalized = normalizeStravaActivity(activity({ distance: 0 }), {});
  assertEquals(normalized.distance_miles, null);
  assertEquals(normalized.avg_pace_sec_per_mile, null);
});

Deno.test('normalizeStravaActivity includes a route when streams have latlng data', () => {
  const streams: StravaStreamSet = { latlng: { data: [[1, 2]] }, time: { data: [0] } };
  const normalized = normalizeStravaActivity(activity(), streams);
  assertEquals(normalized.route, [{ lat: 1, lng: 2, t: Date.parse('2026-09-06T14:00:00Z') }]);
});

Deno.test('stravaActivityUrl builds the public activity URL', () => {
  assertEquals(stravaActivityUrl(21234316), 'https://www.strava.com/activities/21234316');
});
