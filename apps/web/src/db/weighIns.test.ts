import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ForgeDB } from './schema';
import { createWeighInRepo, WeighInError } from './repositories/weighIns';
import { createProfileRepo, DEFAULT_GAIN_RATE, ProfileError } from './repositories/profile';

let db: ForgeDB;

beforeEach(async () => {
  db = new ForgeDB(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('pesées', () => {
  it('enregistre et liste les pesées dans l’ordre chronologique', async () => {
    const repo = createWeighInRepo(db);
    await repo.add({ date: '2026-11-23', time: '07:05', weightKg: 90.2 });
    await repo.add({ date: '2026-11-22', time: '07:00', weightKg: 90.1 });
    const list = await repo.listActive();
    expect(list.map((w) => w.date)).toEqual(['2026-11-22', '2026-11-23']);
    expect(list[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refuse un poids hors limites ou une date invalide', async () => {
    const repo = createWeighInRepo(db);
    await expect(repo.add({ date: '2026-11-23', time: '07:00', weightKg: 25 })).rejects.toBeInstanceOf(WeighInError);
    await expect(repo.add({ date: '2026-13-01', time: '07:00', weightKg: 90 })).rejects.toBeInstanceOf(WeighInError);
  });

  it('modifie une pesée et met à jour son horodatage', async () => {
    const repo = createWeighInRepo(db);
    const created = await repo.add({ date: '2026-11-23', time: '07:00', weightKg: 90.2 }, new Date('2026-11-23T06:00:00Z'));
    const updated = await repo.update(created.id, { weightKg: 90.0 }, new Date('2026-11-23T07:00:00Z'));
    expect(updated.weightKg).toBe(90);
    expect(updated.updatedAt > created.updatedAt).toBe(true);
  });

  it('supprime logiquement : la pesée disparaît de la liste mais reste en base', async () => {
    const repo = createWeighInRepo(db);
    const created = await repo.add({ date: '2026-11-23', time: '07:00', weightKg: 90.2 });
    await repo.remove(created.id);
    expect(await repo.listActive()).toHaveLength(0);
    const stored = await db.weighIns.get(created.id);
    expect(stored?.deletedAt).toBeTruthy();
  });
});

describe('profil', () => {
  it('propose la fourchette par défaut tant que rien n’est saisi', async () => {
    const profile = await createProfileRepo(db).get();
    expect(profile.gainRate).toEqual(DEFAULT_GAIN_RATE);
    expect(profile.heightCm).toBeUndefined();
  });

  it('enregistre les informations au fil de l’eau, sans rien inventer', async () => {
    const repo = createProfileRepo(db);
    await repo.update({ heightCm: 200 });
    const profile = await repo.update({ firstName: 'Coz' });
    expect(profile.heightCm).toBe(200);
    expect(profile.firstName).toBe('Coz');
    expect(profile.birthDate).toBeUndefined();
  });

  it('refuse une fourchette incohérente', async () => {
    await expect(createProfileRepo(db).update({ gainRate: { lowPctPerWeek: 0.6, highPctPerWeek: 0.4 } })).rejects.toBeInstanceOf(ProfileError);
  });
});
