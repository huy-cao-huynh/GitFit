/**
 * Anatome muscle-diagram API client. Called directly, unauthenticated
 * (api.anatome.dev fair-use: 1000 req/day per IP, unlimited on localhost —
 * fine for a single-user app once diagram SVGs are cached). No RapidAPI key;
 * the EXPO_PUBLIC_ANATOME_API_KEY env var is unused. https://anatome.dev/docs
 */

import { ANATOME_BASE_URL, type ExerciseSearchResult } from '@/lib/anatome/layers';

const SEARCH_LIMIT = 8;
/** One retry after a brief pause, mirroring usda-food-data-central.ts. */
const RETRY_DELAY_MS = 400;

interface SearchExercisesResponse {
  ok: boolean;
  results?: ExerciseSearchResult[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, signal?: AbortSignal): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
    if (!response.ok && response.status >= 500) throw new Error(`Anatome request failed (${response.status})`);
  } catch (error) {
    if (signal?.aborted) throw error;
    await sleep(RETRY_DELAY_MS);
    response = await fetch(url, { signal });
  }
  if (!response.ok) throw new Error(`Anatome request failed (${response.status})`);
  return response;
}

/**
 * Free-text exercise search over Anatome's 873-exercise catalog, each result
 * carrying its own pre-mapped primary/secondary muscle slugs. Pass an
 * AbortSignal to cancel superseded requests while the user types.
 */
export async function searchExercises(
  query: string,
  signal?: AbortSignal,
): Promise<ExerciseSearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(SEARCH_LIMIT) });
  const response = await fetchWithRetry(`${ANATOME_BASE_URL}/searchExercises?${params}`, signal);
  const body = (await response.json()) as SearchExercisesResponse;
  return body.results ?? [];
}

/** In-memory only — Anatome's own CDN edge-cache covers cross-session speed. */
const svgCache = new Map<string, string>();

/** Fetches (and caches) the raw SVG text for a deterministic /generateImage URL built by buildDiagramUrl. */
export async function getMuscleDiagramSvg(url: string, signal?: AbortSignal): Promise<string> {
  const cached = svgCache.get(url);
  if (cached) return cached;
  const response = await fetchWithRetry(url, signal);
  const svg = await response.text();
  svgCache.set(url, svg);
  return svg;
}
