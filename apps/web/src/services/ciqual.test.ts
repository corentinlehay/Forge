import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { searchLocal } from '../domain/food';

describe('table Ciqual embarquée', () => {
  const file = JSON.parse(readFileSync(new URL('../../public/data/ciqual.json', import.meta.url), 'utf-8')) as {
    version: string;
    licence: string;
    foods: [string, string, string, number, number, number, number, number | null][];
  };

  it('vient de Ciqual 2025, sous licence CC BY 4.0', () => {
    expect(file.version).toContain('Ciqual 2025');
    expect(file.licence).toBe('CC BY 4.0');
    expect(file.foods.length).toBeGreaterThan(3000);
  });

  it('a des valeurs plausibles pour 100 g', () => {
    for (const [, name, , kcal, p, c, f, fiber] of file.foods) {
      expect(kcal, name).toBeGreaterThanOrEqual(0);
      expect(kcal, name).toBeLessThanOrEqual(900);
      for (const v of [p, c, f]) expect(v, name).toBeLessThanOrEqual(100);
      if (fiber !== null) expect(fiber, name).toBeLessThanOrEqual(100);
    }
  });

  it('retrouve le riz basmati cuit par la recherche locale', () => {
    const rows = file.foods.map(([code, name, , kcal]) => ({ code, name, kcal }));
    const found = searchLocal(rows, 'riz basmati cuit')[0];
    expect(found?.name).toBe('Riz basmati, cuit, sans sel ajouté');
    expect(found?.kcal).toBe(148);
  });
});
