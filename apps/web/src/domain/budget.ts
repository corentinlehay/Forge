import type { Food, FoodEntry, MealSlot, Per100 } from '../db/types';
import { costPerGram, type IngredientPrice, type Recipe } from './kitchen';

/**
 * Budget alimentaire : coût de ce qui est réellement mangé (portions), jamais le prix des paquets achetés.
 */

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Clé de prix d'un aliment : la même que pour les ingrédients de recettes. */
export function foodPriceKey(food: Pick<Food, 'id' | 'source' | 'sourceId'>): string {
  if (food.source === 'ciqual' && food.sourceId) return `ciqual:${food.sourceId}`;
  if (food.source === 'off' && food.sourceId) return `off:${food.sourceId}`;
  return `perso:${food.id}`;
}

export interface CostContext {
  prices: ReadonlyMap<string, IngredientPrice>;
  /** Clé de prix d'un aliment du journal (via son identifiant). */
  keyOfFood: (foodId: string) => string | null;
}

/** Coût d'une ligne du journal : coût enregistré (recette), sinon quantité pesée × prix actuel de l'aliment. */
export function entryCost(entry: FoodEntry, ctx: CostContext): number | null {
  if (entry.costEur !== undefined && entry.costEur !== null) return entry.costEur;
  if (!entry.grams || !entry.foodId) return null;
  const key = ctx.keyOfFood(entry.foodId);
  const price = key ? ctx.prices.get(key) : undefined;
  const perGram = price ? costPerGram(price) : null;
  return perGram === null ? null : r2(perGram * entry.grams);
}

export interface CostSummary {
  total: number;
  /** Jours avec au moins une ligne dans le journal. */
  activeDays: number;
  /** Part des calories dont le coût est connu (0 à 1). */
  coverage: number;
  /** Euros par 100 g de protéines, sur les lignes dont le coût est connu. */
  eurPer100gProtein: number | null;
  byMeal: Record<MealSlot, number>;
}

export function costSummary(entries: readonly FoodEntry[], from: string, to: string, ctx: CostContext): CostSummary {
  let total = 0;
  let kcal = 0;
  let pricedKcal = 0;
  let pricedProtein = 0;
  const days = new Set<string>();
  const byMeal: Record<MealSlot, number> = { breakfast: 0, lunch: 0, snack: 0, dinner: 0 };
  for (const e of entries) {
    if (e.deletedAt || e.date < from || e.date > to) continue;
    days.add(e.date);
    kcal += e.kcal;
    const c = entryCost(e, ctx);
    if (c === null) continue;
    total += c;
    byMeal[e.meal] += c;
    pricedKcal += e.kcal;
    pricedProtein += e.proteinG;
  }
  return {
    total: r2(total),
    activeDays: days.size,
    coverage: kcal > 0 ? pricedKcal / kcal : 0,
    eurPer100gProtein: pricedProtein > 0 ? r2((total / pricedProtein) * 100) : null,
    byMeal: { breakfast: r2(byMeal.breakfast), lunch: r2(byMeal.lunch), snack: r2(byMeal.snack), dinner: r2(byMeal.dinner) },
  };
}

/** Estimation mensuelle : coût moyen par jour noté × 30,4. */
export function monthlyEstimate(summary: CostSummary): number | null {
  return summary.activeDays ? r2((summary.total / summary.activeDays) * 30.4) : null;
}

/** Quantités consommées par clé de prix (aliments pesés et ingrédients des recettes mangées). */
export function consumption(
  entries: readonly FoodEntry[],
  from: string,
  to: string,
  keyOfFood: (foodId: string) => string | null,
  recipes: ReadonlyMap<string, Recipe>,
): Map<string, number> {
  const out = new Map<string, number>();
  const add = (key: string, grams: number) => out.set(key, (out.get(key) ?? 0) + grams);
  for (const e of entries) {
    if (e.deletedAt || e.date < from || e.date > to) continue;
    if (e.recipeKey && e.recipeServings) {
      const r = recipes.get(e.recipeKey);
      if (r) for (const ing of r.ingredients) add(ing.key, (ing.grams * e.recipeServings) / r.servings);
      continue;
    }
    if (e.foodId && e.grams) {
      const key = keyOfFood(e.foodId);
      if (key) add(key, e.grams);
    }
  }
  return out;
}

export interface ProteinValue {
  key: string;
  name: string;
  /** Euros par kilo (ou par litre). */
  eurPerKg: number;
  eurPer100gProtein: number;
  proteinPer100: number;
}

/** Source de protéines : au moins 5 g pour 100 g et au moins 20 % des calories venant des protéines (exclut riz, pain, oléagineux). */
export const isProteinSource = (per100: Per100) => per100.proteinG >= 5 && per100.proteinG * 4 >= 0.2 * per100.kcal;

/** Sources de protéines les plus économiques parmi les produits dont tu as saisi le prix. */
export function proteinValues(prices: readonly (IngredientPrice & { name: string })[], per100Of: (key: string) => Per100 | null): ProteinValue[] {
  const out: ProteinValue[] = [];
  for (const p of prices) {
    if (p.unit === 'piece') continue;
    const per100 = per100Of(p.key);
    if (!per100 || !isProteinSource(per100)) continue;
    const perGram = costPerGram(p);
    if (perGram === null) continue;
    out.push({ key: p.key, name: p.name, eurPerKg: r2(perGram * 1000), eurPer100gProtein: r2((perGram * 100 * 100) / per100.proteinG), proteinPer100: per100.proteinG });
  }
  return out.sort((a, b) => a.eurPer100gProtein - b.eurPer100gProtein);
}

export interface BudgetSettings {
  dailyEur: number | null;
  weeklyEur: number | null;
}

export const BUDGET_KEY = 'budget';
