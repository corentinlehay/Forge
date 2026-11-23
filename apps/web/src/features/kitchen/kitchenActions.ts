import { z } from 'zod';
import { repos } from '../../db/hooks';
import type { FoodEntry, MealPlan, MealSlot, RecipeRecord, ShoppingList } from '../../db/types';
import { buildShoppingItems, recipeCost, recipeNutrition, type IngredientPrice, type KitchenPrefs, type Recipe } from '../../domain/kitchen';
import { recipeFields } from '../../services/backup';
import { saveFile } from '../../services/share';
import { FAVORITES_KEY, PREFS_KEY } from './useKitchen';

const fr = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v);
export const portionsText = (n: number) => `${fr(n)} portion${n >= 2 ? 's' : ''}`;

export async function toggleFavorite(key: string, favorites: ReadonlySet<string>): Promise<boolean> {
  const next = new Set(favorites);
  const on = !next.has(key);
  if (on) next.add(key);
  else next.delete(key);
  await repos.meta.set(FAVORITES_KEY, [...next]);
  return on;
}

export async function savePrefs(prefs: KitchenPrefs): Promise<void> {
  await repos.meta.set(PREFS_KEY, prefs);
}

/** Ajoute des portions d'une recette au journal alimentaire (avec son coût si tous les prix sont connus). */
export async function eatRecipe(recipe: Recipe, servings: number, date: string, meal: MealSlot, prices: ReadonlyMap<string, IngredientPrice>): Promise<FoodEntry> {
  const n = recipeNutrition(recipe, servings);
  const cost = recipeCost(recipe, servings, prices).total;
  return repos.food.add({
    date,
    meal,
    name: recipe.name.slice(0, 120),
    quantity: portionsText(servings),
    kcal: n.total.kcal,
    proteinG: n.total.proteinG,
    carbsG: n.total.carbsG,
    fatG: n.total.fatG,
    fiberG: n.fiberIncomplete ? null : n.total.fiberG,
    recipeKey: recipe.key,
    recipeServings: servings,
    costEur: cost,
  });
}

export async function planRecipe(recipeKey: string, date: string, meal: MealSlot, servings: number): Promise<MealPlan> {
  return repos.mealPlans.add({ date, meal, recipeKey, servings, status: 'planned', foodEntryId: null });
}

/** Le repas planifié devient un repas consommé : ajouté au journal, la planification garde le lien. */
export async function markPlanEaten(plan: MealPlan, recipe: Recipe, prices: ReadonlyMap<string, IngredientPrice>): Promise<void> {
  const entry = await eatRecipe(recipe, plan.servings, plan.date, plan.meal, prices);
  await repos.mealPlans.update(plan.id, { status: 'eaten', foodEntryId: entry.id });
}

export function recipeToFields(recipe: Recipe): Omit<RecipeRecord, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  return {
    name: recipe.name,
    description: recipe.description,
    categories: recipe.categories,
    prepMin: recipe.prepMin,
    cookMin: recipe.cookMin,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    glyph: recipe.glyph,
    ingredients: recipe.ingredients.map((i) => ({ ...i })),
    steps: [...recipe.steps],
    storage: recipe.storage,
  };
}

export async function duplicateRecipe(recipe: Recipe): Promise<RecipeRecord> {
  return repos.recipes.add({ ...recipeToFields(recipe), name: `${recipe.name.slice(0, 70)} (copie)`, origin: recipe.key });
}

export async function createShoppingList(name: string, selections: { recipe: Recipe; servings: number }[]): Promise<ShoppingList> {
  return repos.shoppingLists.add({
    name,
    items: buildShoppingItems(selections),
    selections: selections.map((s) => ({ recipeKey: s.recipe.key, servings: s.servings })),
  });
}

/* ───────── Import et export ───────── */

const exportSchema = z.object({ format: z.literal('forge-recette'), version: z.literal(1), recipe: z.object(recipeFields) });

const slug = (s: string) =>
  s
    .toLocaleLowerCase('fr-FR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

export async function exportRecipe(recipe: Recipe) {
  const payload = { format: 'forge-recette', version: 1, recipe: recipeToFields(recipe) };
  const file = new File([JSON.stringify(payload, null, 2)], `forge-recette-${slug(recipe.name) || 'recette'}.json`, { type: 'application/json' });
  return saveFile(file);
}

export class ImportError extends Error {}

/** Importe une recette exportée depuis FORGE (fichier .json). */
export async function importRecipe(text: string): Promise<RecipeRecord> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('Ce fichier n’est pas une recette FORGE.');
  }
  const parsed = exportSchema.safeParse(raw);
  if (!parsed.success) throw new ImportError('Recette illisible : le fichier est incomplet ou ne vient pas de FORGE.');
  return repos.recipes.add({ ...parsed.data.recipe, origin: null });
}

/* ───────── Photos ───────── */

/** Réduit une photo (1 000 px au plus, JPEG) pour la garder sur l'appareil. */
export async function resizePhoto(file: File, max = 1000): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image illisible.'));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}
