/**
 * Provider-agnostic pieces of the food-search layer: the result shape every
 * provider maps onto, and the gram/ounce/serving math the search and recipe
 * screens use regardless of which API a result came from.
 */

/**
 * Which half of a food database a result came from. `basic` is the curated,
 * lab-analyzed generic entries ("Chicken breast, raw"); `branded` is packaged
 * products. Providers other than USDA draw the same distinction (Nutritionix
 * calls it common vs branded), which is why it lives in the shared shape.
 */
export type FoodTier = 'basic' | 'branded';

export interface FoodSearchResult {
  /** Provider-specific unique id (OFF barcode, USDA fdcId, …). */
  code: string;
  name: string;
  brand?: string;
  tier: FoodTier;
  /**
   * From the provider's most rigorously analyzed dataset (USDA Foundation).
   * A weaker claim than `tier`: all Foundation foods are basic, but plenty of
   * basic foods are older SR Legacy records. Used only to rank.
   */
  verified?: boolean;
  /** Per 100 g. */
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingSize?: string;
}

const GRAMS_PER_OUNCE = 28.3495;

export function ouncesToGrams(ounces: number): number {
  return ounces * GRAMS_PER_OUNCE;
}

export function gramsToOunces(grams: number): number {
  return grams / GRAMS_PER_OUNCE;
}

/**
 * Best-effort grams parsed from a free-text serving size (e.g. "30 g",
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
