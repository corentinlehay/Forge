import { BUILTIN_RECIPES, CIQUAL_TAGS, type Aisle, type BuiltinRecipe, type FoodTag, type Glyph, type RecipeCategory } from '../data/recipes';
import type { MealSlot, Per100, RecipeIngredient, ShoppingListItem } from '../db/types';

export type { RecipeIngredient };
import { normalize } from './food';

/**
 * FORGE Kitchen : recettes, portions, valeurs nutritionnelles, coût, préférences,
 * « Compose mon repas » et listes de courses. Fonctions pures.
 */

export interface Recipe {
  key: string;
  builtin: boolean;
  name: string;
  description: string;
  categories: RecipeCategory[];
  prepMin: number;
  cookMin: number;
  servings: number;
  difficulty: 1 | 2 | 3;
  glyph: Glyph;
  ingredients: RecipeIngredient[];
  steps: string[];
  storage: string;
}

export type CiqualIndex = ReadonlyMap<string, { name: string; per100: Per100 }>;

/** Recette FORGE complétée par les valeurs Ciqual de chaque ingrédient. */
export function builtinToRecipe(b: BuiltinRecipe, ciqual: CiqualIndex): Recipe {
  return {
    key: b.id,
    builtin: true,
    name: b.name,
    description: b.description,
    categories: b.categories,
    prepMin: b.prepMin,
    cookMin: b.cookMin,
    servings: b.servings,
    difficulty: b.difficulty,
    glyph: b.glyph,
    steps: b.steps,
    storage: b.storage,
    ingredients: b.ingredients.map(([code, name, grams, aisle, unit, ml]) => ({
      key: `ciqual:${code}`,
      name,
      grams,
      per100: ciqual.get(code)?.per100 ?? null,
      aisle,
      unit: unit ?? null,
      ml: Boolean(ml),
      tags: CIQUAL_TAGS[code] ?? [],
    })),
  };
}

export function builtinRecipes(ciqual: CiqualIndex): Recipe[] {
  return BUILTIN_RECIPES.map((b) => builtinToRecipe(b, ciqual));
}

/* ───────── Portions et quantités ───────── */

const r1 = (v: number) => Math.round(v * 10) / 10;

export function scaledGrams(ing: RecipeIngredient, factor: number): number {
  return ing.grams * factor;
}

const fr = (v: number, max = 1) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: max }).format(v);

/** « 2 œufs (100 g) », « 300 ml », « 1,5 c. à soupe (15 g) ». */
export function quantityText(ing: RecipeIngredient, factor = 1): string {
  const g = scaledGrams(ing, factor);
  const measure =
    g >= 1000 && !ing.ml
      ? `${fr(g / 1000, 2)} kg`
      : g >= 1000 && ing.ml
        ? `${fr(g / 1000, 2)} L`
        : `${fr(g < 10 ? Math.round(g * 10) / 10 : Math.round(g))} ${ing.ml ? 'ml' : 'g'}`;
  if (!ing.unit) return measure;
  const [one, many, per] = ing.unit;
  const count = Math.round((g / per) * 2) / 2;
  if (count <= 0) return measure;
  return `${fr(count)} ${count > 1 ? many : one} (${measure})`;
}

/* ───────── Valeurs nutritionnelles ───────── */

export interface RecipeNutrition {
  /** Pour une portion. */
  perServing: { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
  /** Pour la quantité demandée (toutes portions). */
  total: { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
  /** Ingrédients sans valeurs connues (non comptés). */
  missing: string[];
  /** Au moins un ingrédient sans valeur de fibres. */
  fiberIncomplete: boolean;
}

export function recipeNutrition(recipe: Pick<Recipe, 'ingredients' | 'servings'>, servings = recipe.servings): RecipeNutrition {
  const total = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
  const missing: string[] = [];
  let fiberIncomplete = false;
  const factor = servings / recipe.servings;
  for (const ing of recipe.ingredients) {
    if (!ing.per100) {
      missing.push(ing.name);
      continue;
    }
    const k = (ing.grams * factor) / 100;
    total.kcal += ing.per100.kcal * k;
    total.proteinG += ing.per100.proteinG * k;
    total.carbsG += ing.per100.carbsG * k;
    total.fatG += ing.per100.fatG * k;
    if (ing.per100.fiberG === null) fiberIncomplete = true;
    else total.fiberG += ing.per100.fiberG * k;
  }
  const round = (t: typeof total) => ({ kcal: Math.round(t.kcal), proteinG: r1(t.proteinG), carbsG: r1(t.carbsG), fatG: r1(t.fatG), fiberG: r1(t.fiberG) });
  const per = { kcal: total.kcal / servings, proteinG: total.proteinG / servings, carbsG: total.carbsG / servings, fatG: total.fatG / servings, fiberG: total.fiberG / servings };
  return { perServing: round(per), total: round(total), missing, fiberIncomplete };
}

export const totalMinutes = (r: Pick<Recipe, 'prepMin' | 'cookMin'>) => r.prepMin + r.cookMin;
export const QUICK_MAX_MIN = 20;
export const PROTEIN_RICH_MIN_G = 25;
export const isQuick = (r: Recipe) => totalMinutes(r) <= QUICK_MAX_MIN;
export const isProteinRich = (r: Recipe) => recipeNutrition(r, 1).perServing.proteinG >= PROTEIN_RICH_MIN_G;

/* ───────── Coût ───────── */

/** Prix saisi pour un ingrédient : montant payé pour une quantité (g, ml ou pièces). */
export interface IngredientPrice {
  key: string;
  amountEur: number;
  quantity: number;
  unit: 'g' | 'ml' | 'piece';
}

export function costPerGram(price: IngredientPrice, ing?: Pick<RecipeIngredient, 'unit'>): number | null {
  if (price.quantity <= 0) return null;
  if (price.unit === 'piece') {
    const perPiece = ing?.unit?.[2];
    return perPiece ? price.amountEur / price.quantity / perPiece : null;
  }
  return price.amountEur / price.quantity;
}

export interface RecipeCost {
  perServing: number | null;
  total: number | null;
  /** Ingrédients sans prix. */
  missing: string[];
  /** Coût des seuls ingrédients dont le prix est connu. */
  known: number;
}

/** Coût des portions consommées (et non du prix des paquets achetés). */
export function recipeCost(recipe: Pick<Recipe, 'ingredients' | 'servings'>, servings: number, prices: ReadonlyMap<string, IngredientPrice>): RecipeCost {
  const factor = servings / recipe.servings;
  let known = 0;
  const missing: string[] = [];
  for (const ing of recipe.ingredients) {
    const price = prices.get(ing.key);
    const perGram = price ? costPerGram(price, ing) : null;
    if (perGram === null) missing.push(ing.name);
    else known += perGram * ing.grams * factor;
  }
  const total = missing.length ? null : Math.round(known * 100) / 100;
  return { total, perServing: total === null ? null : Math.round((total / servings) * 100) / 100, missing, known: Math.round(known * 100) / 100 };
}

/* ───────── Préférences ───────── */

export interface KitchenPrefs {
  /** Allergènes et régimes à exclure. */
  exclude: FoodTag[];
  vegetarian: boolean;
  /** Mots : aliments aimés (mis en avant), détestés ou à éviter (recettes masquées). */
  liked: string[];
  disliked: string[];
  /** Budget habituel par portion, en euros. */
  budgetPerServing: number | null;
  maxMinutes: number | null;
}

export const DEFAULT_PREFS: KitchenPrefs = { exclude: [], vegetarian: false, liked: [], disliked: [], budgetPerServing: null, maxMinutes: null };

export const TAG_LABELS: Record<FoodTag, string> = {
  gluten: 'Gluten',
  lait: 'Lait',
  oeuf: 'Œufs',
  poisson: 'Poisson',
  crustaces: 'Crustacés',
  arachide: 'Arachide',
  'fruits-a-coque': 'Fruits à coque',
  soja: 'Soja',
  moutarde: 'Moutarde',
  sesame: 'Sésame',
  viande: 'Viande',
  porc: 'Porc',
};

export interface PrefCheck {
  /** La recette contient un élément exclu ou détesté. */
  blocked: boolean;
  reasons: string[];
  /** Ingrédients dont les allergènes ne sont pas connus (ingrédients perso ou importés). */
  unverified: string[];
  liked: boolean;
}

const has = (text: string, word: string) => normalize(text).includes(normalize(word));

export function checkPrefs(recipe: Recipe, prefs: KitchenPrefs): PrefCheck {
  const reasons = new Set<string>();
  const unverified: string[] = [];
  const excluded = new Set<FoodTag>(prefs.exclude);
  if (prefs.vegetarian) {
    excluded.add('viande');
    excluded.add('poisson');
  }
  for (const ing of recipe.ingredients) {
    if (ing.tags === null || ing.tags === undefined) {
      if (excluded.size) unverified.push(ing.name);
    } else {
      for (const t of ing.tags)
        if (excluded.has(t)) reasons.add(prefs.vegetarian && (t === 'viande' || t === 'poisson') ? 'Pas végétarien' : `Contient : ${TAG_LABELS[t].toLocaleLowerCase('fr-FR')}`);
    }
    for (const w of prefs.disliked) if (w.trim() && has(ing.name, w)) reasons.add(`Contient : ${w.trim()}`);
  }
  const liked = prefs.liked.some((w) => w.trim() && recipe.ingredients.some((i) => has(i.name, w)));
  return { blocked: reasons.size > 0, reasons: [...reasons], unverified, liked };
}

/* ───────── Recherche et filtres ───────── */

export type CategoryFilter = RecipeCategory | 'rapide' | 'proteine' | 'favoris' | 'perso';

export interface RecipeFilters {
  query: string;
  category: CategoryFilter | null;
  maxKcal: number | null;
  minProtein: number | null;
  maxMinutes: number | null;
  maxDifficulty: 1 | 2 | 3 | null;
  maxCostPerServing: number | null;
  /** Montrer aussi les recettes qui ne respectent pas les préférences. */
  showBlocked: boolean;
}

export const EMPTY_FILTERS: RecipeFilters = {
  query: '',
  category: null,
  maxKcal: null,
  minProtein: null,
  maxMinutes: null,
  maxDifficulty: null,
  maxCostPerServing: null,
  showBlocked: false,
};

export function matchesCategory(r: Recipe, c: CategoryFilter | null, favorites: ReadonlySet<string>): boolean {
  if (!c) return true;
  if (c === 'rapide') return isQuick(r);
  if (c === 'proteine') return isProteinRich(r);
  if (c === 'favoris') return favorites.has(r.key);
  if (c === 'perso') return !r.builtin;
  return r.categories.includes(c);
}

export function filterRecipes(
  recipes: readonly Recipe[],
  f: RecipeFilters,
  ctx: { prefs: KitchenPrefs; favorites: ReadonlySet<string>; prices: ReadonlyMap<string, IngredientPrice> },
): { recipes: Recipe[]; hiddenByPrefs: number } {
  const words = normalize(f.query).split(/\s+/).filter(Boolean);
  let hidden = 0;
  const out = recipes.filter((r) => {
    if (words.length) {
      const hay = normalize(`${r.name} ${r.ingredients.map((i) => i.name).join(' ')}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    if (!matchesCategory(r, f.category, ctx.favorites)) return false;
    const n = recipeNutrition(r, 1).perServing;
    if (f.maxKcal !== null && n.kcal > f.maxKcal) return false;
    if (f.minProtein !== null && n.proteinG < f.minProtein) return false;
    if (f.maxMinutes !== null && totalMinutes(r) > f.maxMinutes) return false;
    if (f.maxDifficulty !== null && r.difficulty > f.maxDifficulty) return false;
    if (f.maxCostPerServing !== null) {
      const c = recipeCost(r, 1, ctx.prices).perServing;
      if (c === null || c > f.maxCostPerServing) return false;
    }
    if (!f.showBlocked && checkPrefs(r, ctx.prefs).blocked) {
      hidden += 1;
      return false;
    }
    return true;
  });
  return { recipes: out, hiddenByPrefs: hidden };
}

/* ───────── Compose mon repas ───────── */

export const MEAL_CATEGORY: Record<MealSlot, RecipeCategory[]> = {
  breakfast: ['petit-dejeuner'],
  lunch: ['dejeuner'],
  dinner: ['diner'],
  snack: ['collation', 'dessert'],
};

export interface ComposeRequest {
  kcal: number;
  proteinG: number;
  meal: MealSlot | null;
  maxMinutes: number | null;
  maxCost: number | null;
  /** Mots : ingrédients disponibles (chaque proposition doit en utiliser au moins un). */
  available: string[];
}

export interface ComposeSuggestion {
  recipe: Recipe;
  servings: number;
  kcal: number;
  proteinG: number;
  cost: number | null;
  /** Écart relatif aux objectifs (0 = parfait). */
  score: number;
  usesAvailable: string[];
}

const SERVING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3];

/**
 * Propose les recettes qui s'approchent le plus des calories et protéines restantes,
 * avec le nombre de portions adapté (de ½ à 3).
 */
export function composeMeal(
  recipes: readonly Recipe[],
  req: ComposeRequest,
  ctx: { prefs: KitchenPrefs; prices: ReadonlyMap<string, IngredientPrice> },
  limit = 5,
): ComposeSuggestion[] {
  if (req.kcal <= 0) return [];
  const out: ComposeSuggestion[] = [];
  for (const r of recipes) {
    const check = checkPrefs(r, ctx.prefs);
    if (check.blocked) continue;
    if (req.meal && !MEAL_CATEGORY[req.meal].some((c) => r.categories.includes(c))) continue;
    if (req.maxMinutes !== null && totalMinutes(r) > req.maxMinutes) continue;
    const usesAvailable = req.available.filter((w) => w.trim() && r.ingredients.some((i) => has(i.name, w)));
    if (req.available.length && !usesAvailable.length) continue;
    const per = recipeNutrition(r, 1).perServing;
    if (per.kcal <= 0) continue;
    let best: ComposeSuggestion | null = null;
    for (const s of SERVING_STEPS) {
      if (s > r.servings * 1.5 && s > 1) continue;
      const kcal = per.kcal * s;
      const protein = per.proteinG * s;
      if (kcal > req.kcal * 1.1) continue;
      const cost = recipeCost(r, s, ctx.prices).total;
      if (req.maxCost !== null && (cost === null || cost > req.maxCost)) continue;
      const kcalGap = Math.abs(req.kcal - kcal) / req.kcal;
      const proteinGap = req.proteinG > 0 ? Math.max(0, req.proteinG - protein) / req.proteinG : 0;
      const score = kcalGap + proteinGap * 1.5 - (check.liked ? 0.05 : 0);
      if (!best || score < best.score) best = { recipe: r, servings: s, kcal: Math.round(kcal), proteinG: r1(protein), cost, score, usesAvailable };
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => a.score - b.score).slice(0, limit);
}

/* ───────── Liste de courses ───────── */

export type ShoppingItem = ShoppingListItem;

/** Additionne les ingrédients de plusieurs recettes (portions choisies), sans doublon, rangés par rayon. */
export function buildShoppingItems(selections: readonly { recipe: Recipe; servings: number }[]): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();
  for (const { recipe, servings } of selections) {
    const factor = servings / recipe.servings;
    for (const ing of recipe.ingredients) {
      const key = ing.key.startsWith('libre:') ? `libre:${normalize(ing.name)}` : ing.key;
      const existing = map.get(key);
      const grams = ing.grams * factor;
      if (existing) {
        existing.grams += grams;
        if (!existing.recipes.includes(recipe.name)) existing.recipes.push(recipe.name);
      } else {
        map.set(key, { key, name: ing.name, grams, ml: Boolean(ing.ml), aisle: ing.aisle, unit: ing.unit ?? null, recipes: [recipe.name], checked: false });
      }
    }
  }
  const order: Aisle[] = ['fruits-legumes', 'viandes-poissons', 'cremerie', 'feculents', 'conserves', 'epicerie', 'surgeles'];
  return [...map.values()].map((i) => ({ ...i, grams: Math.round(i.grams) })).sort((a, b) => order.indexOf(a.aisle) - order.indexOf(b.aisle) || a.name.localeCompare(b.name, 'fr'));
}

export function shoppingCost(items: readonly ShoppingItem[], prices: ReadonlyMap<string, IngredientPrice>): { total: number; missing: number } {
  let total = 0;
  let missing = 0;
  for (const i of items) {
    const p = prices.get(i.key);
    const perGram = p ? costPerGram(p, i) : null;
    if (perGram === null) missing += 1;
    else total += perGram * i.grams;
  }
  return { total: Math.round(total * 100) / 100, missing };
}

export function formatEur(v: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
}
