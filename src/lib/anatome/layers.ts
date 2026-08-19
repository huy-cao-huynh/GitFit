/**
 * Provider-shape module for the Anatome muscle-diagram API: URL building and
 * the app-internal `MuscleLayers` shape, kept separate from the fetch layer
 * (client.ts) the same way units.ts is kept separate from the USDA client.
 */

import { Colors, MuscleDiagramColors } from '@/constants/theme';

export const ANATOME_BASE_URL = 'https://api.anatome.dev';

/** Fixed — no gender field exists anywhere in this single-user app. */
const GENDER = 'male';

export type MuscleView = 'front' | 'back' | 'dual';

export interface MuscleLayers {
  primary: string[];
  secondary: string[];
}

/** The fields consumed from a `/searchExercises` result. */
export interface ExerciseSearchResult {
  ext_id: string;
  name: string;
  category?: string;
  equipment?: string;
  anatome_primary_slugs: string[];
  anatome_secondary_slugs: string[];
}

/**
 * Slugs that only ever render on the back view (confirmed via GET
 * /listMuscles's `views` field). Everything else renders on front, or on
 * both — 'dual' is the safe fallback for anything mixed or unrecognized.
 */
const BACK_ONLY_SLUGS = new Set(['gluteal', 'hamstring', 'upper-back', 'lower-back']);

/** Picks the tightest single-side view that still shows every slug, or 'dual' if the slugs are mixed/unknown. */
export function pickView(layers: MuscleLayers): MuscleView {
  const slugs = [...layers.primary, ...layers.secondary];
  if (slugs.length === 0) return 'dual';
  if (slugs.every((slug) => BACK_ONLY_SLUGS.has(slug))) return 'back';
  if (slugs.every((slug) => !BACK_ONLY_SLUGS.has(slug))) return 'front';
  return 'dual';
}

/** Bare hex, no `#` — matches the API's documented compact `layers` syntax (e.g. `DC2626:chest`). */
function stripHash(hex: string): string {
  return hex.startsWith('#') ? hex.slice(1) : hex;
}

export interface BuildDiagramUrlOptions {
  view?: MuscleView;
  width?: number;
  height?: number;
}

/**
 * Builds a deterministic GET /generateImage URL from merged muscle layers.
 * A slug present in both primary and secondary is rendered as primary only.
 */
export function buildDiagramUrl(layers: MuscleLayers, options: BuildDiagramUrlOptions = {}): string {
  const primary = layers.primary;
  const secondary = layers.secondary.filter((slug) => !primary.includes(slug));

  const layerParts: string[] = [];
  if (primary.length > 0) layerParts.push(`${stripHash(MuscleDiagramColors.primary)}:${primary.join(',')}`);
  if (secondary.length > 0) layerParts.push(`${stripHash(MuscleDiagramColors.secondary)}:${secondary.join(',')}`);

  const params = new URLSearchParams({
    gender: GENDER,
    view: options.view ?? pickView({ primary, secondary }),
    body_color: Colors.surfaceElevated,
    border_width: '0',
    output: 'raw',
  });
  if (layerParts.length > 0) params.set('layers', layerParts.join('|'));
  if (options.width) params.set('width', String(options.width));
  if (options.height) params.set('height', String(options.height));

  return `${ANATOME_BASE_URL}/generateImage?${params}`;
}
