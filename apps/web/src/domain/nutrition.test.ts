import { describe, expect, it } from 'vitest';
import type { FoodEntry } from '../db/types';
import { dailyKcal, dayNutrition, kcalFromMacros, proteinGuide, recentFoods } from './nutrition';

let n = 0;
const entry = (date: string, name: string, kcal: number, p: number, c: number, f: number, deleted = false): FoodEntry => ({
  id: `f${++n}`,
  createdAt: `2026-11-23T0${n % 10}:00:00.000Z`,
  updatedAt: 'x',
  deletedAt: deleted ? 'x' : null,
  date,
  meal: 'lunch',
  name,
  kcal,
  proteinG: p,
  carbsG: c,
  fatG: f,
});

describe('nutrition du jour', () => {
  const entries = [entry('2026-11-23', 'Riz', 390, 8, 85, 1), entry('2026-11-23', 'Poulet', 330, 62, 0, 7), entry('2026-11-23', 'Supprimé', 999, 0, 0, 0, true), entry('2026-11-22', 'Riz', 390, 8, 85, 1)];

  it('additionne le jour et calcule le reste', () => {
    const day = dayNutrition(entries, '2026-11-23', { kcal: 3200, proteinG: 180, carbsG: 415, fatG: 90 });
    expect(day.totals).toEqual({ kcal: 720, proteinG: 70, carbsG: 85, fatG: 8 });
    expect(day.remainingKcal).toBe(2480);
    expect(day.progress?.kcal).toBeCloseTo(0.225, 3);
  });

  it("n'invente pas d'objectif", () => {
    const day = dayNutrition(entries, '2026-11-23', undefined);
    expect(day.targets).toBeNull();
    expect(day.remainingKcal).toBeNull();
  });

  it('suit les calories sur 7 jours', () => {
    const series = dailyKcal(entries, '2026-11-23', 3);
    expect(series.map((d) => d.kcal)).toEqual([0, 390, 720]);
  });

  it('convertit les macros en calories', () => {
    expect(kcalFromMacros(30, 85, 15)).toBe(595);
  });

  it('propose les aliments récents sans doublon', () => {
    expect(recentFoods(entries).map((e) => e.name)).toEqual(['Riz', 'Poulet']);
  });

  it('donne le repère protéines', () => {
    expect(proteinGuide(90)).toEqual({ lowG: 144, highG: 198 });
  });
});
