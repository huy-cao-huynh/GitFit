/**
 * USDA FoodData Central client. Replaces Open Food Facts, whose `us.` search
 * endpoint returned frequent 503s and inconsistent product-name quality.
 * Requires a free key from https://fdc.nal.usda.gov/api-key-signup, set as
 * EXPO_PUBLIC_USDA_API_KEY. https://fdc.nal.usda.gov/api-guide
 */

import { type FoodSearchResult } from '@/lib/nutrition/units';

const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY;
/** Foundation/SR Legacy are the generic USDA reference foods; Branded covers packaged products. Survey (FNDDS) and experimental datasets are excluded — they're recipe/ingredient breakdowns, not things a person searches for by name. */
const DATA_TYPES = 'Foundation,SR Legacy,Branded';
const PAGE_SIZE = 25;
/** One retry after a brief pause — the OFF client had neither, which is exactly why a transient 503 reached the UI as a raw error. */
const RETRY_DELAY_MS = 400;

/** Standard FDC nutrient IDs, stable across dataTypes (Foundation/SR Legacy/Branded all report on the same 100 g basis). https://fdc.nal.usda.gov/portal-data/external/nutrientDetails */
const NUTRIENT_ID = {
  calories: 1008,
  protein: 1003,
  carbs: 1005,
  fat: 1004,
};

interface UsdaNutrient {
  nutrientId?: number;
  value?: number;
}

interface UsdaFood {
  fdcId: number;
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

/** Prefers the structured size ("140 g") — it matches `parseServingGrams`'s regex directly — over free-text household text, which is display-only and not always parseable. */
function servingSizeText(food: UsdaFood): string | undefined {
  if (food.servingSize && food.servingSizeUnit) return `${food.servingSize} ${food.servingSizeUnit}`;
  return food.householdServingFullText?.trim() || undefined;
}

function mapFood(food: UsdaFood): FoodSearchResult | null {
  const name = food.description?.trim();
  const calories = nutrientValue(food.foodNutrients, NUTRIENT_ID.calories);
  // Skip entries without a name or calorie data — they can't be logged meaningfully.
  if (!name || calories === undefined) return null;
  return {
    code: String(food.fdcId),
    name,
    brand: (food.brandName || food.brandOwner)?.trim() || undefined,
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

async function fetchSearch(query: string, signal?: AbortSignal): Promise<Response> {
  if (!API_KEY) {
    throw new Error('USDA FoodData Central API key is missing — set EXPO_PUBLIC_USDA_API_KEY in .env.');
  }
  const params = new URLSearchParams({
    query,
    api_key: API_KEY,
    pageSize: String(PAGE_SIZE),
    dataType: DATA_TYPES,
  });
  return fetch(`${SEARCH_URL}?${params}`, { signal });
}

/**
 * Free-text food search. Retries once on a network error or a 5xx from USDA
 * before giving up, so a single transient failure doesn't surface as a raw
 * error the way Open Food Facts's did. Pass an AbortSignal to cancel
 * superseded requests while the user types.
 */
export async function searchFoods(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
  let response: Response;
  try {
    response = await fetchSearch(query, signal);
    if (!response.ok && response.status >= 500) throw new Error(`USDA search failed (${response.status})`);
  } catch (error) {
    if (signal?.aborted) throw error;
    await sleep(RETRY_DELAY_MS);
    response = await fetchSearch(query, signal);
  }

  if (!response.ok) throw new Error(`USDA search failed (${response.status})`);
  const body = (await response.json()) as UsdaSearchResponse;
  const results: FoodSearchResult[] = [];
  const seen = new Set<string>();
  for (const food of body.foods ?? []) {
    const mapped = mapFood(food);
    if (mapped && !seen.has(mapped.code)) {
      seen.add(mapped.code);
      results.push(mapped);
    }
  }
  return results;
}
