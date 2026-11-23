import type { FoodEntry, MealSlot, NutritionTargets } from '../db/types';
import { addDays } from '../lib/dates';

export const MEAL_ORDER: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export const MEAL_LABELS: Record<MealSlot, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  snack: 'Collation',
  dinner: 'Dîner',
};

export interface MacroTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Fibres des aliments où elles sont connues. */
  fiberG: number;
  /** Nombre d'aliments sans valeur de fibres. */
  fiberUnknown: number;
}

const round = (v: number) => Math.round(v);

export function sumEntries(entries: readonly Pick<FoodEntry, 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG'>[]): MacroTotals {
  const t = entries.reduce<Omit<MacroTotals, never>>(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
      fiberG: acc.fiberG + (e.fiberG ?? 0),
      fiberUnknown: acc.fiberUnknown + (e.fiberG === undefined || e.fiberG === null ? 1 : 0),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, fiberUnknown: 0 },
  );
  return { kcal: round(t.kcal), proteinG: round(t.proteinG), carbsG: round(t.carbsG), fatG: round(t.fatG), fiberG: round(t.fiberG), fiberUnknown: t.fiberUnknown };
}

/** Calories apportées par les macros : 4 kcal/g pour protéines et glucides, 9 kcal/g pour les lipides. */
export function kcalFromMacros(proteinG: number, carbsG: number, fatG: number): number {
  return round(4 * proteinG + 4 * carbsG + 9 * fatG);
}

export function entriesForDay(entries: readonly FoodEntry[], date: string): FoodEntry[] {
  return entries.filter((e) => !e.deletedAt && e.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export interface DayNutrition {
  date: string;
  entries: FoodEntry[];
  totals: MacroTotals;
  targets: NutritionTargets | null;
  /** Calories restantes (négatif si dépassé) ; null sans objectif. */
  remainingKcal: number | null;
  /** Progression vers l'objectif, de 0 à 1 et plus ; null sans objectif. */
  progress: { kcal: number; protein: number; carbs: number; fat: number } | null;
}

const ratio = (value: number, target: number) => (target > 0 ? value / target : 0);

export function dayNutrition(entries: readonly FoodEntry[], date: string, targets: NutritionTargets | undefined | null): DayNutrition {
  const day = entriesForDay(entries, date);
  const totals = sumEntries(day);
  const t = targets ?? null;
  return {
    date,
    entries: day,
    totals,
    targets: t,
    remainingKcal: t ? t.kcal - totals.kcal : null,
    progress: t
      ? {
          kcal: ratio(totals.kcal, t.kcal),
          protein: ratio(totals.proteinG, t.proteinG),
          carbs: ratio(totals.carbsG, t.carbsG),
          fat: ratio(totals.fatG, t.fatG),
        }
      : null,
  };
}

/** Calories des `days` derniers jours, du plus ancien au jour donné. */
export function dailyKcal(entries: readonly FoodEntry[], endDate: string, days = 7): { date: string; kcal: number; count: number }[] {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(endDate, -i);
    const day = entriesForDay(entries, date);
    out.push({ date, kcal: sumEntries(day).kcal, count: day.length });
  }
  return out;
}

/** Repère protéines pour la prise de muscle : 1,6 à 2,2 g par kg et par jour (Morton et al., 2018). */
export function proteinGuide(weightKg: number): { lowG: number; highG: number } {
  return { lowG: round(1.6 * weightKg), highG: round(2.2 * weightKg) };
}

/** Aliments récents, sans doublon de nom, du plus récent au plus ancien. */
export function recentFoods(entries: readonly FoodEntry[], limit = 8): FoodEntry[] {
  const seen = new Set<string>();
  const out: FoodEntry[] = [];
  for (const e of [...entries].filter((x) => !x.deletedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = e.name.toLocaleLowerCase('fr-FR');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/** Total des boissons du jour, en millilitres. */
export function waterForDay(logs: readonly { date: string; ml: number; deletedAt?: string | null }[], date: string): number {
  return logs.filter((l) => !l.deletedAt && l.date === date).reduce((s, l) => s + l.ml, 0);
}

/** Repère fibres pour un adulte : 30 g par jour (ANSES). */
export const FIBER_REFERENCE_G = 30;
