import { assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildGpx } from './gpx.ts';
import type { GpsPoint } from './types.ts';

const route: GpsPoint[] = [
  { lat: 37.7749, lng: -122.4194, altitude: 15.2, t: 1_757_000_000_000 },
  { lat: 37.775, lng: -122.4195, t: 1_757_000_002_000 },
];

Deno.test('buildGpx includes every point with lat/lon and time', () => {
  const gpx = buildGpx(route, 'Morning Run');
  assertStringIncludes(gpx, 'lat="37.7749"');
  assertStringIncludes(gpx, 'lon="-122.4194"');
  assertStringIncludes(gpx, '<ele>15.2</ele>');
  assertStringIncludes(gpx, new Date(1_757_000_000_000).toISOString());
});

Deno.test('buildGpx omits <ele> for points with no altitude', () => {
  const gpx = buildGpx([{ lat: 1, lng: 2, t: 0 }], 'No Altitude');
  assertStringIncludes(gpx, '<trkpt lat="1" lon="2"><time>');
});

Deno.test('buildGpx escapes XML-special characters in the track name', () => {
  const gpx = buildGpx(route, 'Tom & Jerry\'s "Run" <fast>');
  assertStringIncludes(gpx, '<name>Tom &amp; Jerry&apos;s &quot;Run&quot; &lt;fast&gt;</name>');
});

Deno.test('buildGpx produces well-formed root elements', () => {
  const gpx = buildGpx(route, 'Test');
  assertStringIncludes(gpx, '<?xml version="1.0" encoding="UTF-8"?>');
  assertStringIncludes(gpx, '<gpx version="1.1"');
  assertStringIncludes(gpx, '</gpx>');
});
