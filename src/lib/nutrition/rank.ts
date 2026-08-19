/**
 * Local relevance pass over food-search results. USDA returns its own
 * relevance order, but for a simple term like "chicken breast" that order
 * buries the handful of clean generic entries under dozens of near-identical
 * ALL-CAPS branded rows. These are pure functions over the provider-agnostic
 * result shape, so they apply to whatever provider is behind the search.
 *
 * Known limits, measured against the live API — don't "fix" these by piling on
 * more weights, which regresses the cases that do work:
 *   - A single-word ingredient whose derived products share its prefix ranks
 *     the products first: "almonds" puts "Almond butter" and "Almond milk"
 *     above "Nuts, almonds", because USDA writes the plain nut category-first
 *     and no name-shape signal separates the two.
 *   - Ranking can't invent candidates. USDA returns no plain raw sweet potato
 *     in the top 20 for "sweet potato" at all, so nothing can surface it.
 * Both are what a curated local staples table would solve.
 */

import { parseServingGrams, type FoodSearchResult } from '@/lib/nutrition/units';

/** Lowercased, punctuation-stripped, whitespace-collapsed. Shared by scoring and dedupe. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[,.()[\]{}/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Crudest possible singular form. USDA names plural ("Bananas, raw") while
 * people search singular, and without this "banana" fails to match the token
 * "bananas" at all — losing the plain entry to any name that happens to spell
 * it singular somewhere ("banana powder").
 */
function stem(token: string): string {
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function stems(text: string): string[] {
  const normalized = normalize(text);
  return normalized.length > 0 ? normalized.split(' ').map(stem) : [];
}

/**
 * How well a result matches the query. Higher is better; the sort is stable so
 * the provider's own relevance order breaks ties.
 */
function score(result: FoodSearchResult, queryTokens: string[], stemmedQuery: string): number {
  const nameTokens = stems(result.name);
  const stemmedName = nameTokens.join(' ');
  let points = 0;

  if (stemmedName === stemmedQuery) points += 100;
  else if (stemmedName.startsWith(stemmedQuery)) points += 50;

  const matchedIndices = queryTokens
    .map((token) => nameTokens.indexOf(token))
    .filter((index) => index >= 0);
  const allTokensPresent = queryTokens.length > 0 && matchedIndices.length === queryTokens.length;
  if (allTokensPresent) points += 25;

  // Every extra word is a qualifier the user didn't ask for ("chicken breast,
  // boneless, skinless, marinated, frozen").
  points -= Math.max(0, nameTokens.length - queryTokens.length) * 2;

  // USDA names generic foods genus-first with qualifiers appended — "Oil,
  // olive, salad or cooking", "Rice, white, long grain". So a name whose FIRST
  // word is part of the query is usually the plain food, while a name that
  // merely mentions it later is a dish containing it ("Mayonnaise, reduced
  // fat, with olive oil").
  if (nameTokens.length > 0 && queryTokens.includes(nameTokens[0])) points += 12;

  // Query words scattered across the name mean a blend or a compound product
  // ("Oil, corn, peanut, and olive" for "olive oil"); adjacent means the real
  // thing. Penalise the gap, not the position.
  if (allTokensPresent) {
    const span = Math.max(...matchedIndices) - Math.min(...matchedIndices) + 1;
    points -= Math.max(0, span - queryTokens.length) * 4;
  }

  // Foundation records are the newest and most rigorously lab-analyzed — the
  // closest thing the database has to a canonical entry for a plain food.
  // Deliberately smaller than the genus-first bonus: a Foundation record for a
  // *dish* ("Anchovies, canned in olive oil") must not outrank an older plain
  // record for the thing actually searched for ("Oil, olive").
  if (result.verified) points += 10;

  // A bare shouted description with no brand is the noise case: dozens of
  // indistinguishable "CHICKEN BREAST" rows from unnamed packagers.
  if (!result.brand && result.name === result.name.toUpperCase()) points -= 15;

  // A parseable serving size means the amount panel can default to something
  // real instead of a flat 100 g.
  if (parseServingGrams(result.servingSize) !== null) points += 10;

  return points;
}

/** Results sorted most-relevant first. Does not mutate the input. */
export function rankResults(results: FoodSearchResult[], query: string): FoodSearchResult[] {
  const queryTokens = stems(query);
  const stemmedQuery = queryTokens.join(' ');
  return results
    .map((result, index) => ({ result, index, points: score(result, queryTokens, stemmedQuery) }))
    // Index as the tiebreaker keeps this a stable sort across engines.
    .sort((a, b) => b.points - a.points || a.index - b.index)
    .map((entry) => entry.result);
}

/**
 * Drops results that are the same food twice — same name, same brand, same
 * macros to the nearest whole unit. Keeps the first of each group, so run this
 * *after* rankResults to keep the best-ranked member.
 *
 * Intended for branded results only: the curated generic entries are
 * deliberately near-identical in places ("raw" vs "cooked", different cuts),
 * and collapsing those would throw away real distinctions.
 */
export function collapseDuplicates(results: FoodSearchResult[]): FoodSearchResult[] {
  const seen = new Set<string>();
  const out: FoodSearchResult[] = [];
  for (const result of results) {
    const key = [
      normalize(result.name),
      result.brand?.toLowerCase() ?? '',
      Math.round(result.caloriesPer100g),
      Math.round(result.proteinPer100g),
      Math.round(result.carbsPer100g),
      Math.round(result.fatPer100g),
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(result);
  }
  return out;
}
