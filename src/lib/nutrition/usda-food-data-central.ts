/**
 * USDA FoodData Central client. Replaces Open Food Facts, whose `us.` search
 * endpoint returned frequent 503s and inconsistent product-name quality.
 * Requires a free key from https://fdc.nal.usda.gov/api-key-signup, set as
 * EXPO_PUBLIC_USDA_API_KEY. https://fdc.nal.usda.gov/api-guide
 */

import { collapseDuplicates, rankResults } from '@/lib/nutrition/rank';
import { type FoodSearchResult, type FoodTier } from '@/lib/nutrition/units';

const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY;
/**
 * The two data-type sets are queried separately rather than pooled. Pooled,
 * Branded outnumbers the curated entries roughly 100:1, so searching "chicken
 * breast" buries the handful of clean generic foods under dozens of
 * near-identical ALL-CAPS branded rows. Split, the UI can show a short
 * verified section first and collapse the branded tail.
 *
 * Foundation/SR Legacy are the generic USDA reference foods; Branded covers
 * packaged products. Survey (FNDDS) and experimental datasets stay excluded —
 * they're recipe/ingredient breakdowns, not things a person searches by name.
 */
const BASIC_DATA_TYPES = 'Foundation,SR Legacy';
const BRANDED_DATA_TYPES = 'Branded';
/**
 * Both tiers over-fetch relative to what's shown: the local ranking is only as
 * good as the candidate pool, and USDA's own ordering buries plain entries
 * (asking for 10 "sweet potato" rows doesn't include plain sweet potato).
 */
const BASIC_PAGE_SIZE = 20;
const BRANDED_PAGE_SIZE = 25;
/** One retry after a brief pause — the OFF client had neither, which is exactly why a transient 503 reached the UI as a raw error. */
const RETRY_DELAY_MS = 400;

/** Standard FDC nutrient IDs, stable across dataTypes (Foundation/SR Legacy/Branded all report on the same 100 g basis). https://fdc.nal.usda.gov/portal-data/external/nutrientDetails */
const NUTRIENT_ID = {
  protein: 1003,
  carbs: 1005,
  fat: 1004,
};

/**
 * Calories, in order of preference. SR Legacy and Branded report the plain
 * "Energy" nutrient (1008), but **Foundation foods don't** — they carry Atwater
 * factor variants instead, specific (2048) being the more accurate of the two.
 * Checking only 1008 silently discarded every Foundation food, which is exactly
 * the curated, lab-analyzed tier a search like "chicken breast" should surface.
 */
const CALORIE_NUTRIENT_IDS = [1008, 2048, 2047];

interface UsdaNutrient {
  nutrientId?: number;
  value?: number;
}

interface UsdaFood {
  fdcId: number;
  dataType?: string;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: UsdaNutrient[];
}

interface UsdaSearchResponse {
  foods?: UsdaFood[];
}

function nutrientValue(nutrients: UsdaNutrient[] | undefined, id: number): number | undefined {
  return nutrients?.find((nutrient) => nutrient.nutrientId === id)?.value;
}

function calorieValue(nutrients: UsdaNutrient[] | undefined): number | undefined {
  for (const id of CALORIE_NUTRIENT_IDS) {
    const value = nutrientValue(nutrients, id);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Prefers the structured size ("140 g") — it matches `parseServingGrams`'s regex directly — over free-text household text, which is display-only and not always parseable. */
function servingSizeText(food: UsdaFood): string | undefined {
  if (food.servingSize && food.servingSizeUnit) return `${food.servingSize} ${food.servingSizeUnit}`;
  return food.householdServingFullText?.trim() || undefined;
}

function mapFood(food: UsdaFood, tier: FoodTier): FoodSearchResult | null {
  const name = food.description?.trim();
  const calories = calorieValue(food.foodNutrients);
  // Skip entries without a name or calorie data — they can't be logged meaningfully.
  if (!name || calories === undefined) return null;
  return {
    code: String(food.fdcId),
    name,
    brand: (food.brandName || food.brandOwner)?.trim() || undefined,
    tier,
    verified: food.dataType === 'Foundation' || undefined,
    caloriesPer100g: calories,
    proteinPer100g: nutrientValue(food.foodNutrients, NUTRIENT_ID.protein) ?? 0,
    carbsPer100g: nutrientValue(food.foodNutrients, NUTRIENT_ID.carbs) ?? 0,
    fatPer100g: nutrientValue(food.foodNutrients, NUTRIENT_ID.fat) ?? 0,
    servingSize: servingSizeText(food),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSearch(
  query: string,
  dataType: string,
  pageSize: number,
  signal?: AbortSignal,
): Promise<Response> {
  if (!API_KEY) {
    throw new Error('USDA FoodData Central API key is missing — set EXPO_PUBLIC_USDA_API_KEY in .env.');
  }
  const params = new URLSearchParams({
    query,
    api_key: API_KEY,
    pageSize: String(pageSize),
    dataType,
    // Without this, "greek yogurt" also returns every plain yogurt.
    requireAllWords: 'true',
  });
  return fetch(`${SEARCH_URL}?${params}`, { signal });
}

/** One data-type set: fetch with a single retry, map, and dedupe by id. */
async function searchTier(
  query: string,
  dataType: string,
  pageSize: number,
  tier: FoodTier,
  signal?: AbortSignal,
): Promise<FoodSearchResult[]> {
  let response: Response;
  try {
    response = await fetchSearch(query, dataType, pageSize, signal);
    if (!response.ok && response.status >= 500) throw new Error(`USDA search failed (${response.status})`);
  } catch (error) {
    if (signal?.aborted) throw error;
    await sleep(RETRY_DELAY_MS);
    response = await fetchSearch(query, dataType, pageSize, signal);
  }

  if (!response.ok) throw new Error(`USDA search failed (${response.status})`);
  const body = (await response.json()) as UsdaSearchResponse;
  const results: FoodSearchResult[] = [];
  const seen = new Set<string>();
  for (const food of body.foods ?? []) {
    const mapped = mapFood(food, tier);
    if (mapped && !seen.has(mapped.code)) {
      seen.add(mapped.code);
      results.push(mapped);
    }
  }
  return results;
}

/**
 * Free-text food search across both tiers, returning ranked basic results
 * followed by ranked-and-deduped branded ones. The flat shape is deliberate:
 * callers that just want a list (the recipe ingredient picker) need no changes,
 * while the search screen partitions on `tier` to draw its two sections.
 *
 * Each tier retries once on a network error or 5xx. If only one tier fails the
 * other is still returned — a missing branded tail is much better than an error
 * where the answer was in the basic tier all along. Pass an AbortSignal to
 * cancel superseded requests while the user types.
 */
export async function searchFoods(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
  const [basic, branded] = await Promise.allSettled([
    searchTier(query, BASIC_DATA_TYPES, BASIC_PAGE_SIZE, 'basic', signal),
    searchTier(query, BRANDED_DATA_TYPES, BRANDED_PAGE_SIZE, 'branded', signal),
  ]);

  if (basic.status === 'rejected' && branded.status === 'rejected') throw basic.reason;

  const ranked = [
    ...(basic.status === 'fulfilled' ? rankResults(basic.value, query) : []),
    ...(branded.status === 'fulfilled' ? collapseDuplicates(rankResults(branded.value, query)) : []),
  ];

  // The same fdcId can't appear in both tiers, but dedupe across the join
  // anyway so callers never have to worry about duplicate React keys.
  const seen = new Set<string>();
  return ranked.filter((result) => {
    if (seen.has(result.code)) return false;
    seen.add(result.code);
    return true;
  });
}
