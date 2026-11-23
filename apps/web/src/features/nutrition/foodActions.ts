import { repos } from '../../db/hooks';
import type { Food, FoodEntry, FoodSource, FoodState, MealSlot, MealTemplate, MealTemplateItem, Per100 } from '../../db/types';
import { nutrientsFor, type OffProduct } from '../../domain/food';
import type { CiqualFood } from '../../services/ciqual';

/** Un aliment choisi pour être ajouté, quelle que soit sa provenance. */
export interface FoodChoice {
  source: FoodSource;
  sourceId: string | null;
  foodId: string | null;
  name: string;
  brand?: string;
  state: FoodState | null;
  unit: 'g' | 'ml';
  per100: Per100;
  servingG: number | null;
  servingLabel?: string;
  /** Fiche Open Food Facts incomplète : valeurs manquantes comptées à 0. */
  incomplete?: boolean;
}

export function choiceFromFood(food: Food): FoodChoice {
  return {
    source: food.source,
    sourceId: food.sourceId ?? null,
    foodId: food.id,
    name: food.name,
    ...(food.brand ? { brand: food.brand } : {}),
    state: food.state ?? null,
    unit: food.unit,
    per100: food.per100,
    servingG: food.servingG ?? null,
    ...(food.servingLabel ? { servingLabel: food.servingLabel } : {}),
  };
}

export function choiceFromOff(p: OffProduct): FoodChoice {
  return {
    source: 'off',
    sourceId: p.code,
    foodId: null,
    name: p.name,
    ...(p.brand ? { brand: p.brand } : {}),
    state: null,
    unit: p.unit,
    per100: p.per100,
    servingG: p.servingG,
    ...(p.servingLabel ? { servingLabel: p.servingLabel } : {}),
    incomplete: !p.complete,
  };
}

export function choiceFromCiqual(c: CiqualFood): FoodChoice {
  return { source: 'ciqual', sourceId: c.code, foodId: null, name: c.name, state: c.state, unit: 'g', per100: c.per100, servingG: null };
}

/** Garde l'aliment en mémoire (favoris, récents, hors-ligne) et renvoie son identifiant. */
export async function ensureFood(choice: FoodChoice): Promise<string> {
  if (choice.foodId) return choice.foodId;
  const food = await repos.foods.remember({
    source: choice.source,
    sourceId: choice.sourceId,
    name: choice.name,
    ...(choice.brand ? { brand: choice.brand } : {}),
    state: choice.state,
    unit: choice.unit,
    per100: choice.per100,
    servingG: choice.servingG,
    ...(choice.servingLabel ? { servingLabel: choice.servingLabel } : {}),
  });
  return food.id;
}

const formatQty = (grams: number, unit: 'g' | 'ml') => `${String(Math.round(grams * 10) / 10).replace('.', ',')} ${unit}`;

/** Ajoute un aliment pesé au journal : les valeurs sont calculées et figées avec une copie des valeurs pour 100 g. */
export async function addWeighedEntry(choice: FoodChoice, grams: number, date: string, meal: MealSlot): Promise<FoodEntry> {
  const foodId = await ensureFood(choice);
  const n = nutrientsFor(choice.per100, grams);
  const entry = await repos.food.add({
    date,
    meal,
    name: choice.brand ? `${choice.name} (${choice.brand})` : choice.name,
    quantity: formatQty(grams, choice.unit),
    kcal: n.kcal,
    proteinG: n.proteinG,
    carbsG: n.carbsG,
    fatG: n.fatG,
    fiberG: n.fiberG,
    foodId,
    grams,
    unit: choice.unit,
    per100: choice.per100,
  });
  await repos.foods.markUsed(foodId);
  return entry;
}

/** Change la quantité d'une ligne pesée et recalcule ses valeurs. */
export async function updateWeighedEntry(entry: FoodEntry, grams: number, meal: MealSlot): Promise<void> {
  if (!entry.per100) throw new Error('Cette ligne n’a pas de valeurs pour 100 g.');
  const n = nutrientsFor(entry.per100, grams);
  await repos.food.update(entry.id, { meal, grams, quantity: formatQty(grams, entry.unit ?? 'g'), kcal: n.kcal, proteinG: n.proteinG, carbsG: n.carbsG, fatG: n.fatG, fiberG: n.fiberG });
}

const toItem = (e: FoodEntry): MealTemplateItem => ({
  foodId: e.foodId ?? null,
  name: e.name,
  ...(e.quantity ? { quantity: e.quantity } : {}),
  grams: e.grams ?? null,
  ...(e.unit ? { unit: e.unit } : {}),
  per100: e.per100 ?? null,
  kcal: e.kcal,
  proteinG: e.proteinG,
  carbsG: e.carbsG,
  fatG: e.fatG,
  fiberG: e.fiberG ?? null,
});

/** Copie des lignes (un repas d'un autre jour) vers un jour et un repas. */
export async function copyEntries(entries: readonly FoodEntry[], date: string, meal: MealSlot): Promise<number> {
  for (const e of entries) {
    await repos.food.add({ ...toItem(e), date, meal, quantity: e.quantity ?? undefined } as Omit<FoodEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>);
  }
  return entries.length;
}

export async function saveAsTemplate(name: string, entries: readonly FoodEntry[], meal: MealSlot): Promise<MealTemplate> {
  return repos.mealTemplates.add({ name: name.trim(), meal, items: entries.map(toItem) });
}

export async function applyTemplate(template: MealTemplate, date: string, meal: MealSlot): Promise<number> {
  for (const item of template.items) {
    const { quantity, ...rest } = item;
    await repos.food.add({ ...rest, ...(quantity ? { quantity } : {}), date, meal });
    if (item.foodId) await repos.foods.markUsed(item.foodId);
  }
  return template.items.length;
}
