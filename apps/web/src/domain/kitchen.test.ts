import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILTIN_RECIPES } from '../data/recipes';
import type { Per100 } from '../db/types';
import {
  buildShoppingItems,
  builtinRecipes,
  checkPrefs,
  composeMeal,
  DEFAULT_PREFS,
  filterRecipes,
  EMPTY_FILTERS,
  quantityText,
  recipeCost,
  recipeNutrition,
  shoppingCost,
  type CiqualIndex,
  type IngredientPrice,
} from './kitchen';

const file = JSON.parse(readFileSync(new URL('../../public/data/ciqual.json', import.meta.url), 'utf8')) as {
  foods: [string, string, string, number, number, number, number, number | null][];
};
const ciqual: CiqualIndex = new Map(
  file.foods.map(([code, name, , kcal, proteinG, carbsG, fatG, fiberG]) => [code, { name, per100: { kcal, proteinG, carbsG, fatG, fiberG } as Per100 }]),
);
const recipes = builtinRecipes(ciqual);
const byKey = (k: string) => recipes.find((r) => r.key === k)!;
const noPrices = new Map<string, IngredientPrice>();

describe('recettes FORGE', () => {
  it('relient chaque ingrédient à un aliment Ciqual existant', () => {
    const missing = BUILTIN_RECIPES.flatMap((r) => r.ingredients.filter(([code]) => !ciqual.has(code)).map(([code, name]) => `${r.id} : ${name} (${code})`));
    expect(missing).toEqual([]);
    expect(new Set(BUILTIN_RECIPES.map((r) => r.id)).size).toBe(BUILTIN_RECIPES.length);
    for (const r of BUILTIN_RECIPES) {
      expect(r.steps.length, r.id).toBeGreaterThanOrEqual(2);
      expect(r.storage.length, r.id).toBeGreaterThan(5);
    }
  });

  it('ont des valeurs par portion plausibles', () => {
    for (const r of recipes) {
      const n = recipeNutrition(r, 1).perServing;
      expect(n.kcal, r.name).toBeGreaterThan(120);
      expect(n.kcal, r.name).toBeLessThan(1300);
      const fromMacros = n.proteinG * 4 + n.carbsG * 4 + n.fatG * 9;
      expect(Math.abs(fromMacros - n.kcal) / n.kcal, r.name).toBeLessThan(0.15);
    }
  });
});

describe('portions, valeurs et coût', () => {
  it('calcule les valeurs depuis Ciqual et les met à l’échelle', () => {
    const r = byKey('poulet-riz-brocolis');
    const four = recipeNutrition(r, 4);
    const eight = recipeNutrition(r, 8);
    expect(eight.total.kcal).toBeCloseTo(four.total.kcal * 2, -1);
    expect(four.perServing.kcal).toBe(eight.perServing.kcal);
    expect(four.perServing.proteinG).toBeGreaterThan(40);
    expect(four.missing).toEqual([]);
  });

  it('affiche les quantités avec leur unité', () => {
    const egg = byKey('omelette-jambon').ingredients.find((i) => i.name === 'Œufs')!;
    expect(quantityText(egg)).toBe('3 œufs (150 g)');
    expect(quantityText(egg, 1 / 3)).toBe('1 œuf (50 g)');
    const milk = byKey('riz-au-lait').ingredients.find((i) => i.ml)!;
    expect(quantityText(milk)).toBe('1 L');
  });

  it('ne calcule le coût que si tous les prix sont connus, au prorata des quantités utilisées', () => {
    const r = byKey('fromage-blanc-miel-noix');
    expect(recipeCost(r, 1, noPrices)).toMatchObject({ total: null, perServing: null });
    const prices = new Map<string, IngredientPrice>([
      ['ciqual:19644', { key: 'ciqual:19644', amountEur: 2, quantity: 1000, unit: 'g' }],
      ['ciqual:31008', { key: 'ciqual:31008', amountEur: 5, quantity: 500, unit: 'g' }],
      ['ciqual:15005', { key: 'ciqual:15005', amountEur: 4, quantity: 200, unit: 'g' }],
    ]);
    // 200 g × 0,002 + 10 g × 0,01 + 15 g × 0,02 = 0,40 + 0,10 + 0,30
    expect(recipeCost(r, 1, prices)).toMatchObject({ total: 0.8, perServing: 0.8, missing: [] });
    expect(recipeCost(r, 2, prices).total).toBe(1.6);
  });
});

describe('préférences et filtres', () => {
  it('écarte les recettes avec un allergène exclu, de la viande pour un végétarien, ou un aliment détesté', () => {
    expect(checkPrefs(byKey('pancakes-banane'), { ...DEFAULT_PREFS, exclude: ['oeuf'] }).blocked).toBe(true);
    expect(checkPrefs(byKey('dahl-lentilles'), { ...DEFAULT_PREFS, vegetarian: true }).blocked).toBe(false);
    expect(checkPrefs(byKey('chili-con-carne'), { ...DEFAULT_PREFS, vegetarian: true }).reasons).toEqual(['Pas végétarien']);
    expect(checkPrefs(byKey('salade-quinoa'), { ...DEFAULT_PREFS, disliked: ['feta'] }).blocked).toBe(true);
  });

  it('filtre par catégorie, protéines, temps et compte les recettes masquées', () => {
    const ctx = { prefs: { ...DEFAULT_PREFS, exclude: ['poisson' as const] }, favorites: new Set<string>(), prices: noPrices };
    const quick = filterRecipes(recipes, { ...EMPTY_FILTERS, category: 'rapide' }, ctx).recipes;
    expect(quick.every((r) => r.prepMin + r.cookMin <= 20)).toBe(true);
    const all = filterRecipes(recipes, EMPTY_FILTERS, ctx);
    expect(all.hiddenByPrefs).toBeGreaterThanOrEqual(4);
    expect(all.recipes.some((r) => r.key === 'poke-saumon')).toBe(false);
    const protein = filterRecipes(recipes, { ...EMPTY_FILTERS, minProtein: 35 }, ctx).recipes;
    expect(protein.every((r) => recipeNutrition(r, 1).perServing.proteinG >= 35)).toBe(true);
  });
});

describe('Compose mon repas', () => {
  it('propose des recettes et des portions proches des apports restants (750 kcal, 55 g de protéines)', () => {
    const out = composeMeal(recipes, { kcal: 750, proteinG: 55, meal: 'dinner', maxMinutes: null, maxCost: null, available: [] }, { prefs: DEFAULT_PREFS, prices: noPrices });
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) {
      expect(s.kcal).toBeLessThanOrEqual(825);
      expect(s.recipe.categories).toContain('diner');
    }
    expect(out[0]!.proteinG).toBeGreaterThanOrEqual(40);
  });

  it('respecte le temps disponible et les ingrédients disponibles', () => {
    const out = composeMeal(recipes, { kcal: 600, proteinG: 30, meal: null, maxMinutes: 20, maxCost: null, available: ['thon'] }, { prefs: DEFAULT_PREFS, prices: noPrices });
    expect(out.every((s) => s.recipe.prepMin + s.recipe.cookMin <= 20 && s.usesAvailable.includes('thon'))).toBe(true);
  });
});

describe('liste de courses', () => {
  it('additionne les quantités d’un même ingrédient et range par rayon', () => {
    const items = buildShoppingItems([
      { recipe: byKey('poulet-riz-brocolis'), servings: 4 },
      { recipe: byKey('curry-poulet-coco'), servings: 3 },
    ]);
    const chicken = items.filter((i) => i.key === 'ciqual:36017');
    expect(chicken).toHaveLength(1);
    expect(chicken[0]!.grams).toBe(1050);
    expect(chicken[0]!.recipes).toHaveLength(2);
    expect(items[0]!.aisle).toBe('fruits-legumes');
    const cost = shoppingCost(items, new Map([['ciqual:36017', { key: 'ciqual:36017', amountEur: 12, quantity: 1000, unit: 'g' as const }]]));
    expect(cost.total).toBe(12.6);
    expect(cost.missing).toBe(items.length - 1);
  });
});
