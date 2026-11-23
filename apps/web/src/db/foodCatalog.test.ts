import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { ForgeDB } from './schema';
import { createFoodCatalogRepo, createWaterRepo } from './repositories/entities';

const names: string[] = [];
afterEach(async () => {
  await Promise.all(names.splice(0).map((n) => Dexie.delete(n)));
});
const fresh = () => {
  const name = `catalog-${crypto.randomUUID()}`;
  names.push(name);
  return new ForgeDB(name);
};
const per100 = { kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9, fiberG: 0 };

describe('aliments connus', () => {
  it('ne duplique pas un produit Open Food Facts déjà mémorisé', async () => {
    const db = fresh();
    const repo = createFoodCatalogRepo(db);
    const a = await repo.remember({ source: 'off', sourceId: '3017620422003', name: 'Nutella', unit: 'g', per100 });
    const b = await repo.remember({ source: 'off', sourceId: '3017620422003', name: 'Nutella 400 g', unit: 'g', per100 });
    expect(b.id).toBe(a.id);
    expect((await repo.listActive()).map((f) => f.name)).toEqual(['Nutella 400 g']);
    db.close();
  });

  it('suit les favoris et l’usage', async () => {
    const db = fresh();
    const repo = createFoodCatalogRepo(db);
    const food = await repo.remember({ source: 'custom', name: 'Shake maison', unit: 'ml', per100 });
    expect(await repo.toggleFavorite(food.id)).toBe(true);
    await repo.markUsed(food.id);
    await repo.markUsed(food.id);
    expect(await repo.get(food.id)).toMatchObject({ favorite: true, useCount: 2 });
    await expect(repo.add({ source: 'custom', name: 'X', unit: 'g', per100: { ...per100, kcal: 1200 }, favorite: false, useCount: 0 })).rejects.toThrow('Calories pour 100 g');
    db.close();
  });

  it('enregistre les boissons', async () => {
    const db = fresh();
    const water = createWaterRepo(db);
    await water.add({ date: '2026-11-23', ml: 500 });
    await expect(water.add({ date: '2026-11-23', ml: 0 })).rejects.toThrow('Entre 1 et 3 000 ml');
    expect((await water.listActive()).length).toBe(1);
    db.close();
  });
});
