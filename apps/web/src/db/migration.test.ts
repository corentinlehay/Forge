import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { ForgeDB, SCHEMA_VERSION } from './schema';
import { createCheckInRepo, createExerciseRepo, createFoodRepo, createSetRepo, DataError } from './repositories/entities';

const names: string[] = [];
afterEach(async () => {
  await Promise.all(names.splice(0).map((n) => Dexie.delete(n)));
});

describe('migration v1 → v2', () => {
  it('garde profil, pesées et réglages, et ajoute les nouvelles tables vides', async () => {
    const name = `migration-${crypto.randomUUID()}`;
    names.push(name);
    const v1 = new Dexie(name);
    v1.version(1).stores({ profile: 'id, updatedAt', weighIns: 'id, date, [date+time], updatedAt', meta: 'key' });
    await v1.table('profile').put({ id: 'me', createdAt: 'a', updatedAt: 'a', deletedAt: null, firstName: 'Coz', gainRate: { lowPctPerWeek: 0.25, highPctPerWeek: 0.5 } });
    await v1.table('weighIns').bulkPut([
      { id: 'w1', createdAt: 'a', updatedAt: 'a', deletedAt: null, date: '2026-11-22', time: '07:00', weightKg: 90.1 },
      { id: 'w2', createdAt: 'a', updatedAt: 'a', deletedAt: null, date: '2026-11-23', time: '07:00', weightKg: 90.2 },
    ]);
    await v1.table('meta').put({ key: 'onboarding', value: { completedAt: 'a' }, updatedAt: 'a' });
    v1.close();

    const db = new ForgeDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect((await db.profile.get('me'))?.firstName).toBe('Coz');
    expect(await db.weighIns.count()).toBe(2);
    expect(await db.meta.get('onboarding')).toBeTruthy();
    expect(await db.foodEntries.count()).toBe(0);
    expect(await db.workouts.count()).toBe(0);
    db.close();
  });
});

describe('saisies v2', () => {
  it('valident, enregistrent et suppriment logiquement', async () => {
    const name = `entities-${crypto.randomUUID()}`;
    names.push(name);
    const db = new ForgeDB(name);
    const food = createFoodRepo(db);
    const added = await food.add({ date: '2026-11-23', meal: 'lunch', name: 'Riz', kcal: 390, proteinG: 8, carbsG: 85, fatG: 1 });
    await expect(food.add({ date: '2026-11-23', meal: 'lunch', name: '', kcal: 1, proteinG: 0, carbsG: 0, fatG: 0 })).rejects.toBeInstanceOf(DataError);
    await food.remove(added.id);
    expect(await food.listActive()).toEqual([]);

    const exercises = createExerciseRepo(db);
    const a = await exercises.findOrCreate('Développé  couché');
    const b = await exercises.findOrCreate('développé couché');
    expect(b.id).toBe(a.id);
    expect(a.name).toBe('Développé couché');

    await expect(createSetRepo(db).add({ workoutId: 'w', exerciseId: a.id, position: 0, weightKg: 80, reps: 0 })).rejects.toThrow('Entre 1 et 100 répétitions.');
    await expect(createCheckInRepo(db).add({ date: '2026-11-23', sleepHours: 7, energy: 6 as 5, fatigue: 2, soreness: 2 })).rejects.toThrow('Énergie : de 1 à 5.');
    db.close();
  });
});

describe('migration v2 → v3', () => {
  it('garde le journal et les séances, et ajoute aliments, repas habituels et hydratation', async () => {
    const name = `migration3-${crypto.randomUUID()}`;
    names.push(name);
    const v2 = new Dexie(name);
    v2.version(1).stores({ profile: 'id, updatedAt', weighIns: 'id, date, [date+time], updatedAt', meta: 'key' });
    v2.version(2).stores({
      foodEntries: 'id, date, updatedAt',
      exercises: 'id, name, updatedAt',
      workoutTemplates: 'id, updatedAt',
      workouts: 'id, date, updatedAt',
      workoutSets: 'id, workoutId, exerciseId, updatedAt',
      checkIns: 'id, date, updatedAt',
    });
    await v2.table('foodEntries').put({ id: 'f', createdAt: 'a', updatedAt: 'a', deletedAt: null, date: '2026-11-23', meal: 'lunch', name: 'Riz', kcal: 390, proteinG: 8, carbsG: 85, fatG: 1 });
    await v2.table('workouts').put({ id: 'w', createdAt: 'a', updatedAt: 'a', deletedAt: null, date: '2026-11-23', name: 'Upper A', exerciseIds: [], startedAt: 'a', endedAt: 'b' });
    v2.close();

    const db = new ForgeDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect((await db.foodEntries.get('f'))?.kcal).toBe(390);
    expect(await db.workouts.count()).toBe(1);
    expect(await db.foods.count()).toBe(0);
    expect(await db.waterLogs.count()).toBe(0);
    db.close();
  });
});

describe('migration v3 → v4', () => {
  it('rattache les séances existantes à un premier programme actif', async () => {
    const name = `migration4-${crypto.randomUUID()}`;
    names.push(name);
    const v3 = new Dexie(name);
    v3.version(1).stores({ profile: 'id, updatedAt', weighIns: 'id, date, [date+time], updatedAt', meta: 'key' });
    v3.version(2).stores({
      foodEntries: 'id, date, updatedAt',
      exercises: 'id, name, updatedAt',
      workoutTemplates: 'id, updatedAt',
      workouts: 'id, date, updatedAt',
      workoutSets: 'id, workoutId, exerciseId, updatedAt',
      checkIns: 'id, date, updatedAt',
    });
    v3.version(3).stores({ foods: 'id, [source+sourceId], name, updatedAt', mealTemplates: 'id, updatedAt', waterLogs: 'id, date, updatedAt' });
    const t = (id: string) => ({ id, createdAt: 'a', updatedAt: 'a', deletedAt: null, name: id, weekdays: [1], exercises: [], position: 0 });
    await v3.table('workoutTemplates').bulkPut([t('Upper A'), t('Lower A')]);
    v3.close();

    const db = new ForgeDB(name);
    await db.open();
    const programs = await db.programs.toArray();
    expect(programs).toHaveLength(1);
    expect(programs[0]).toMatchObject({ name: 'Mon programme', active: true });
    expect((await db.workoutTemplates.toArray()).every((x) => x.programId === programs[0]!.id)).toBe(true);
    db.close();
  });

  it('ne crée pas de programme vide sans séance', async () => {
    const name = `migration4b-${crypto.randomUUID()}`;
    names.push(name);
    const db = new ForgeDB(name);
    await db.open();
    expect(await db.programs.count()).toBe(0);
    db.close();
  });
});
