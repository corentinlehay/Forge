import { useEffect, useMemo, useState } from 'react';
import { useMeta, usePrices, useRecipePhotos, useRecipeRecords } from '../../db/hooks';
import type { RecipeRecord } from '../../db/types';
import { builtinRecipes, DEFAULT_PREFS, type CiqualIndex, type IngredientPrice, type KitchenPrefs, type Recipe } from '../../domain/kitchen';
import { loadCiqual } from '../../services/ciqual';

export const FAVORITES_KEY = 'recipeFavorites';
export const PREFS_KEY = 'kitchenPrefs';

let indexPromise: Promise<CiqualIndex> | null = null;
function loadIndex(): Promise<CiqualIndex> {
  indexPromise ??= loadCiqual().then(({ foods }) => new Map(foods.map((f) => [f.code, { name: f.name, per100: f.per100 }])));
  return indexPromise;
}

export function recordToRecipe(r: RecipeRecord): Recipe {
  return {
    key: r.id,
    builtin: false,
    name: r.name,
    description: r.description,
    categories: r.categories,
    prepMin: r.prepMin,
    cookMin: r.cookMin,
    servings: r.servings,
    difficulty: r.difficulty,
    glyph: r.glyph,
    ingredients: r.ingredients,
    steps: r.steps,
    storage: r.storage,
  };
}

export interface KitchenData {
  recipes: Recipe[];
  byKey: Map<string, Recipe>;
  records: RecipeRecord[];
  photos: Map<string, string>;
  prices: Map<string, IngredientPrice>;
  favorites: Set<string>;
  prefs: KitchenPrefs;
  /** Table Ciqual chargée (sinon les recettes FORGE n'ont pas encore leurs valeurs). */
  ciqualReady: boolean;
}

/** Recettes FORGE et perso, photos, prix, favoris et préférences. */
export function useKitchen(): KitchenData | null {
  const [ciqual, setCiqual] = useState<CiqualIndex | null>(null);
  const records = useRecipeRecords();
  const photos = useRecipePhotos();
  const prices = usePrices();
  const favorites = useMeta<string[]>(FAVORITES_KEY);
  const prefs = useMeta<KitchenPrefs>(PREFS_KEY);

  useEffect(() => {
    let alive = true;
    void loadIndex().then((index) => alive && setCiqual(index));
    return () => {
      alive = false;
    };
  }, []);

  return useMemo(() => {
    if (!ciqual || !records || !photos || !prices || favorites === undefined || prefs === undefined) return null;
    const recipes = [...builtinRecipes(ciqual), ...records.map(recordToRecipe)];
    return {
      recipes,
      byKey: new Map(recipes.map((r) => [r.key, r])),
      records,
      photos: new Map(photos.map((p) => [p.recipeKey, p.dataUrl])),
      prices: new Map(prices.map((p) => [p.key, { key: p.key, amountEur: p.amountEur, quantity: p.quantity, unit: p.unit }])),
      favorites: new Set(favorites ?? []),
      prefs: { ...DEFAULT_PREFS, ...(prefs ?? {}) },
      ciqualReady: ciqual.size > 0,
    };
  }, [ciqual, records, photos, prices, favorites, prefs]);
}
