import type { GpsPoint } from './types.ts';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds a GPX 1.1 track from GitFit's recorded route so a GPS-tracked cardio
 * session can be uploaded to Strava via POST /uploads with a real map, rather
 * than losing the route entirely under POST /activities (which has no
 * route/map support at all). One <trkseg> is sufficient -- GitFit doesn't
 * record pause/resume as separate segments, and Strava re-derives moving
 * time from the point timestamps regardless.
 */
export function buildGpx(route: GpsPoint[], name: string): string {
  const points = route
    .map((point) => {
      const eleTag = point.altitude != null ? `<ele>${point.altitude.toFixed(1)}</ele>` : '';
      const timeTag = `<time>${new Date(point.t).toISOString()}</time>`;
      return `<trkpt lat="${point.lat}" lon="${point.lng}">${eleTag}${timeTag}</trkpt>`;
    })
    .join('');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<gpx version="1.1" creator="GitFit" xmlns="http://www.topografix.com/GPX/1/1">` +
    `<trk><name>${escapeXml(name)}</name><trkseg>${points}</trkseg></trk>` +
    `</gpx>`
  );
}
