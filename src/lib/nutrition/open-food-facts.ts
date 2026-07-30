/**
 * Thin Open Food Facts client (free, no API key). Text search returns
 * per-100g macros; the app snapshots computed nutrients onto food_logs rows
 * at log time, so this is the only place that knows about per-100g data.
 * https://wiki.openfoodfacts.org/API
 */

// The `us` subdomain (rather than `world`) restricts results server-side to
// products tagged as sold in the United States — OFF is a global crowd-sourced
// database with no default locale, so querying `world` returns product names
// in whatever language each contributor entered them in (French, German,
// Japanese, etc.), which read as "wrong language" noise in an English-only
// app. This isn't a perfect filter (some US products still carry non-English
// text), but it's the standard mitigation and cuts the noise substantially.
const SEARCH_URL = 'https://us.openfoodfacts.org/cgi/search.pl';
const FIELDS = 'code,product_name,product_name_en,brands,nutriments,serving_size';
/** Identify the app per OFF API guidelines. */
const USER_AGENT = 'GitFit/1.0 (personal fitness tracker)';

export interface FoodSearchResult {
  /** OFF barcode; unique per product. */
  code: string;
  name: string;
  brand?: string;
  /** Per 100 g. */
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingSize?: string;
}

interface OffNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: OffNutriments;
}

interface OffSearchResponse {
  products?: OffProduct[];
}

function mapProduct(product: OffProduct): FoodSearchResult | null {
  // Prefer the explicit English translation when a contributor provided one.
  const name = product.product_name_en?.trim() || product.product_name?.trim();
  const nutriments = product.nutriments;
  const calories = nutriments?.['energy-kcal_100g'];
  // Skip entries without a name or calorie data — they can't be logged meaningfully.
  if (!name || !product.code || calories === undefined) return null;
  return {
    code: product.code,
    name,
    brand: product.brands?.split(',')[0]?.trim() || undefined,
    caloriesPer100g: calories,
    proteinPer100g: nutriments?.proteins_100g ?? 0,
    carbsPer100g: nutriments?.carbohydrates_100g ?? 0,
    fatPer100g: nutriments?.fat_100g ?? 0,
    servingSize: product.serving_size,
  };
}

/**
 * Free-text product search. Throws on network/HTTP errors; pass an
 * AbortSignal to cancel superseded requests while the user types.
 */
export async function searchFoods(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '25',
    fields: FIELDS,
    lc: 'en',
  });
  const response = await fetch(`${SEARCH_URL}?${params}`, {
    signal,
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`Open Food Facts search failed (${response.status})`);
  const body = (await response.json()) as OffSearchResponse;
  const results: FoodSearchResult[] = [];
  const seen = new Set<string>();
  for (const product of body.products ?? []) {
    const mapped = mapProduct(product);
    if (mapped && !seen.has(mapped.code)) {
      seen.add(mapped.code);
      results.push(mapped);
    }
  }
  return results;
}

const GRAMS_PER_OUNCE = 28.3495;

export function ouncesToGrams(ounces: number): number {
  return ounces * GRAMS_PER_OUNCE;
}

export function gramsToOunces(grams: number): number {
  return grams / GRAMS_PER_OUNCE;
}

/**
 * Best-effort grams parsed from OFF's free-text `serving_size` (e.g. "30 g",
 * "1 cup (240ml)"). Treats ml as approximately equal to grams. Returns null
 * when nothing parseable is found.
 */
export function parseServingGrams(servingSize: string | undefined): number | null {
  if (!servingSize) return null;
  const match = servingSize.match(/([\d.]+)\s*(g|ml)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Nutrients for `grams` of a food described per 100 g. */
export function macrosForGrams(
  food: Pick<FoodSearchResult, 'caloriesPer100g' | 'proteinPer100g' | 'carbsPer100g' | 'fatPer100g'>,
  grams: number,
) {
  const factor = grams / 100;
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    calories: Math.round(food.caloriesPer100g * factor),
    proteinG: round(food.proteinPer100g * factor),
    carbsG: round(food.carbsPer100g * factor),
    fatG: round(food.fatPer100g * factor),
  };
}
