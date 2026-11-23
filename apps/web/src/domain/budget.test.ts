import { describe, expect, it } from 'vitest';
import type { FoodEntry } from '../db/types';
import { consumption, costSummary, entryCost, foodPriceKey, monthlyEstimate, proteinValues } from './budget';
import type { IngredientPrice, Recipe } from './kitchen';

const sync = { createdAt: 'x', updatedAt: 'x', deletedAt: null };
const e = (id: string, date: string, extra: Partial<FoodEntry>): FoodEntry => ({
  ...sync,
  id,
  date,
  meal: 'lunch',
  name: id,
  kcal: 500,
  proteinG: 30,
  carbsG: 50,
  fatG: 10,
  ...extra,
});
const prices = new Map<string, IngredientPrice>([
  ['ciqual:36017', { key: 'ciqual:36017', amountEur: 12, quantity: 1000, unit: 'g' }],
  ['off:123', { key: 'off:123', amountEur: 2.4, quantity: 500, unit: 'g' }],
]);
const keyOfFood = (id: string) => ({ poulet: 'ciqual:36017', skyr: 'off:123' })[id] ?? null;
const ctx = { prices, keyOfFood };

describe('budget', () => {
  it('relie un aliment à sa clé de prix', () => {
    expect(foodPriceKey({ id: 'a', source: 'ciqual', sourceId: '9119' })).toBe('ciqual:9119');
    expect(foodPriceKey({ id: 'a', source: 'custom', sourceId: null })).toBe('perso:a');
  });

  it('coûte les portions mangées, pas les paquets', () => {
    expect(entryCost(e('a', '2026-11-23', { foodId: 'poulet', grams: 150 }), ctx)).toBe(1.8);
    expect(entryCost(e('b', '2026-11-23', { recipeKey: 'r', costEur: 2.35 }), ctx)).toBe(2.35);
    expect(entryCost(e('c', '2026-11-23', { foodId: 'inconnu', grams: 100 }), ctx)).toBeNull();
  });

  it('résume un jour : total, couverture, coût des protéines, par repas', () => {
    const entries = [
      e('a', '2026-11-23', { foodId: 'poulet', grams: 150, meal: 'lunch', kcal: 165, proteinG: 35 }),
      e('b', '2026-11-23', { foodId: 'skyr', grams: 250, meal: 'snack', kcal: 150, proteinG: 25 }),
      e('c', '2026-11-23', { foodId: 'inconnu', grams: 100, meal: 'dinner', kcal: 315 }),
      e('d', '2026-11-22', { foodId: 'poulet', grams: 100 }),
    ];
    const s = costSummary(entries, '2026-11-23', '2026-11-23', ctx);
    expect(s.total).toBe(3);
    expect(s.coverage).toBeCloseTo(0.5, 5);
    expect(s.eurPer100gProtein).toBe(5);
    expect(s.byMeal).toMatchObject({ lunch: 1.8, snack: 1.2, dinner: 0 });
    expect(monthlyEstimate(s)).toBe(91.2);
  });

  it('compte les quantités consommées, recettes comprises', () => {
    const recipe = { key: 'r', servings: 4, ingredients: [{ key: 'ciqual:36017', name: 'Poulet', grams: 600, per100: null, aisle: 'viandes-poissons' }] } as unknown as Recipe;
    const used = consumption(
      [e('a', '2026-11-23', { foodId: 'poulet', grams: 150 }), e('b', '2026-11-23', { recipeKey: 'r', recipeServings: 2 })],
      '2026-11-01',
      '2026-11-30',
      keyOfFood,
      new Map([['r', recipe]]),
    );
    expect(used.get('ciqual:36017')).toBe(450);
  });

  it('classe les protéines par coût pour 100 g de protéines', () => {
    const list = proteinValues(
      [
        { key: 'ciqual:36017', name: 'Poulet', amountEur: 12, quantity: 1000, unit: 'g' },
        { key: 'lentilles', name: 'Lentilles', amountEur: 2, quantity: 500, unit: 'g' },
        { key: 'riz', name: 'Riz', amountEur: 2, quantity: 1000, unit: 'g' },
      ],
      (k) =>
        ({
          'ciqual:36017': { kcal: 110, proteinG: 23.4, carbsG: 0, fatG: 1.5, fiberG: 0 },
          lentilles: { kcal: 328, proteinG: 27.7, carbsG: 45, fatG: 0.8, fiberG: 15 },
          riz: { kcal: 350, proteinG: 7, carbsG: 77, fatG: 1, fiberG: 1 },
        })[k] ?? null,
    );
    // Le riz est moins cher par gramme de protéines, mais ce n'est pas une source de protéines (8 % des calories).
    expect(list.map((p) => p.name)).toEqual(['Lentilles', 'Poulet']);
    expect(list[0]!.eurPer100gProtein).toBe(1.44);
  });
});
