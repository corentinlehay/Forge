import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { ForgeDB, SCHEMA_VERSION } from './schema';
import { createCheckInRepo, createExerciseRepo, createFoodRepo, createPulseDayRepo, createSetRepo, createWeekNoteRepo, DataError } from './repositories/entities';

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

describe('mise en production : base v2 → version actuelle en une fois', () => {
  it('garde le profil, les pesées, les réglages, le journal, les séances, les séries et les check-ins', async () => {
    const name = `prod-${crypto.randomUUID()}`;
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
    const sync = { createdAt: 'a', updatedAt: 'a', deletedAt: null };
    await v2.table('profile').put({ ...sync, id: 'me', firstName: 'Coz', gainRate: { lowPctPerWeek: 0.25, highPctPerWeek: 0.5 } });
    await v2.table('weighIns').bulkPut([
      { ...sync, id: 'p1', date: '2026-11-20', time: '07:00', weightKg: 88.6 },
      { ...sync, id: 'p2', date: '2026-11-24', time: '07:05', weightKg: 88.9 },
    ]);
    await v2.table('meta').put({ key: 'onboarding', value: { completedAt: 'a' }, updatedAt: 'a' });
    await v2.table('exercises').put({ ...sync, id: 'squat', name: 'Squat', muscle: 'quadriceps' });
    await v2.table('workoutTemplates').put({ ...sync, id: 't', name: 'Lower A', exercises: [{ exerciseId: 'squat', sets: 4, repsMin: 5, repsMax: 7, rir: 2, restSec: 180 }] });
    await v2.table('workouts').put({ ...sync, id: 'w', date: '2026-11-23', name: 'Lower A', templateId: 't', exerciseIds: ['squat'], startedAt: 'a', endedAt: 'b' });
    await v2.table('workoutSets').bulkPut([
      { ...sync, id: 's1', workoutId: 'w', exerciseId: 'squat', weightKg: 112.5, reps: 7, rir: 2 },
      { ...sync, id: 's2', workoutId: 'w', exerciseId: 'squat', weightKg: 112.5, reps: 6, rir: 2 },
    ]);
    await v2.table('checkIns').put({ ...sync, id: 'c', date: '2026-11-24', sleepHours: 7.5, energy: 4, fatigue: 2, soreness: 2 });
    await v2.table('foodEntries').put({ ...sync, id: 'f', date: '2026-11-24', meal: 'lunch', name: 'Riz', kcal: 390, proteinG: 8, carbsG: 85, fatG: 1 });
    v2.close();

    const db = new ForgeDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect((await db.profile.get('me'))?.firstName).toBe('Coz');
    expect((await db.weighIns.orderBy('date').toArray()).map((w) => w.weightKg)).toEqual([88.6, 88.9]);
    expect(await db.meta.get('onboarding')).toBeTruthy();
    expect((await db.exercises.get('squat'))?.name).toBe('Squat');
    expect((await db.workouts.get('w'))?.templateId).toBe('t');
    expect(await db.workoutSets.where('workoutId').equals('w').count()).toBe(2);
    expect(await db.checkIns.get('c')).toMatchObject({ sleepHours: 7.5, energy: 4, fatigue: 2, soreness: 2 });
    expect((await db.foodEntries.get('f'))?.kcal).toBe(390);
    expect(await db.pulseDays.count()).toBe(0);
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
    await v2
      .table('foodEntries')
      .put({ id: 'f', createdAt: 'a', updatedAt: 'a', deletedAt: null, date: '2026-11-23', meal: 'lunch', name: 'Riz', kcal: 390, proteinG: 8, carbsG: 85, fatG: 1 });
    await v2
      .table('workouts')
      .put({ id: 'w', createdAt: 'a', updatedAt: 'a', deletedAt: null, date: '2026-11-23', name: 'Upper A', exerciseIds: [], startedAt: 'a', endedAt: 'b' });
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

describe('migration v4 → v5', () => {
  it('ajoute les tables Kitchen sans toucher aux données existantes', async () => {
    const name = `migration5-${crypto.randomUUID()}`;
    names.push(name);
    const v4 = new Dexie(name);
    v4.version(1).stores({ profile: 'id, updatedAt', weighIns: 'id, date, [date+time], updatedAt', meta: 'key' });
    v4.version(2).stores({
      foodEntries: 'id, date, updatedAt',
      exercises: 'id, name, updatedAt',
      workoutTemplates: 'id, updatedAt',
      workouts: 'id, date, updatedAt',
      workoutSets: 'id, workoutId, exerciseId, updatedAt',
      checkIns: 'id, date, updatedAt',
    });
    v4.version(3).stores({ foods: 'id, [source+sourceId], name, updatedAt', mealTemplates: 'id, updatedAt', waterLogs: 'id, date, updatedAt' });
    v4.version(4).stores({ programs: 'id, updatedAt' });
    await v4
      .table('foodEntries')
      .put({ id: 'e1', createdAt: 'a', updatedAt: 'a', deletedAt: null, date: '2026-11-23', meal: 'lunch', name: 'Skyr', kcal: 100, proteinG: 15, carbsG: 5, fatG: 0 });
    await v4.table('programs').put({ id: 'p1', createdAt: 'a', updatedAt: 'a', deletedAt: null, name: 'Mon programme', active: true });
    v4.close();

    const db = new ForgeDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(await db.foodEntries.get('e1')).toMatchObject({ name: 'Skyr', kcal: 100 });
    expect(await db.programs.count()).toBe(1);
    expect(await db.recipes.count()).toBe(0);
    await db.prices.add({ id: 'x', createdAt: 'a', updatedAt: 'a', deletedAt: null, key: 'ciqual:9119', name: 'Riz', amountEur: 2, quantity: 1000, unit: 'g' });
    expect(await db.prices.where('key').equals('ciqual:9119').count()).toBe(1);
    db.close();
  });
});

describe('migration v5 → v6', () => {
  it('ajoute l’historique des objectifs sans toucher au profil', async () => {
    const name = `migration6-${crypto.randomUUID()}`;
    names.push(name);
    const v5 = new Dexie(name);
    v5.version(1).stores({ profile: 'id, updatedAt', weighIns: 'id, date, [date+time], updatedAt', meta: 'key' });
    v5.version(2).stores({
      foodEntries: 'id, date, updatedAt',
      exercises: 'id, name, updatedAt',
      workoutTemplates: 'id, updatedAt',
      workouts: 'id, date, updatedAt',
      workoutSets: 'id, workoutId, exerciseId, updatedAt',
      checkIns: 'id, date, updatedAt',
    });
    v5.version(3).stores({ foods: 'id, [source+sourceId], name, updatedAt', mealTemplates: 'id, updatedAt', waterLogs: 'id, date, updatedAt' });
    v5.version(4).stores({ programs: 'id, updatedAt' });
    v5.version(5).stores({
      recipes: 'id, updatedAt',
      recipePhotos: 'id, recipeKey, updatedAt',
      mealPlans: 'id, date, updatedAt',
      shoppingLists: 'id, updatedAt',
      prices: 'id, key, updatedAt',
    });
    await v5.table('profile').put({
      id: 'me',
      createdAt: 'a',
      updatedAt: 'a',
      deletedAt: null,
      gainRate: { lowPctPerWeek: 0.25, highPctPerWeek: 0.5 },
      nutritionTargets: { kcal: 2800, proteinG: 145, carbsG: 375, fatG: 80 },
    });
    v5.close();
    const db = new ForgeDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect((await db.profile.get('me'))?.nutritionTargets?.kcal).toBe(2800);
    expect(await db.targetChanges.count()).toBe(0);
    db.close();
  });
});

describe('migration v6 → v7', () => {
  it('ajoute le journal et les pratiques Mind sans toucher aux check-ins', async () => {
    const name = `migration7-${crypto.randomUUID()}`;
    names.push(name);
    const v6 = new Dexie(name);
    v6.version(1).stores({ profile: 'id, updatedAt', weighIns: 'id, date, [date+time], updatedAt', meta: 'key' });
    v6.version(2).stores({
      foodEntries: 'id, date, updatedAt',
      exercises: 'id, name, updatedAt',
      workoutTemplates: 'id, updatedAt',
      workouts: 'id, date, updatedAt',
      workoutSets: 'id, workoutId, exerciseId, updatedAt',
      checkIns: 'id, date, updatedAt',
    });
    v6.version(3).stores({ foods: 'id, [source+sourceId], name, updatedAt', mealTemplates: 'id, updatedAt', waterLogs: 'id, date, updatedAt' });
    v6.version(4).stores({ programs: 'id, updatedAt' });
    v6.version(5).stores({
      recipes: 'id, updatedAt',
      recipePhotos: 'id, recipeKey, updatedAt',
      mealPlans: 'id, date, updatedAt',
      shoppingLists: 'id, updatedAt',
      prices: 'id, key, updatedAt',
    });
    v6.version(6).stores({ targetChanges: 'id, date, updatedAt' });
    await v6.table('checkIns').put({ id: 'c1', createdAt: 'a', updatedAt: 'a', deletedAt: null, date: '2026-11-20', sleepHours: 7.5, energy: 4, fatigue: 2, soreness: 2 });
    v6.close();
    const db = new ForgeDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect((await db.checkIns.get('c1'))?.sleepHours).toBe(7.5);
    expect(await db.moodLogs.count()).toBe(0);
    expect(await db.mindSessions.count()).toBe(0);
    db.close();
  });
});

describe('migration v7 → v8', () => {
  it('ajoute l’état et les téléchargements des séances audio sans toucher au journal', async () => {
    const name = `migration8-${crypto.randomUUID()}`;
    names.push(name);
    const v7 = new Dexie(name);
    v7.version(1).stores({ profile: 'id, updatedAt', weighIns: 'id, date, [date+time], updatedAt', meta: 'key' });
    v7.version(2).stores({
      foodEntries: 'id, date, updatedAt',
      exercises: 'id, name, updatedAt',
      workoutTemplates: 'id, updatedAt',
      workouts: 'id, date, updatedAt',
      workoutSets: 'id, workoutId, exerciseId, updatedAt',
      checkIns: 'id, date, updatedAt',
    });
    v7.version(3).stores({ foods: 'id, [source+sourceId], name, updatedAt', mealTemplates: 'id, updatedAt', waterLogs: 'id, date, updatedAt' });
    v7.version(4).stores({ programs: 'id, updatedAt' });
    v7.version(5).stores({
      recipes: 'id, updatedAt',
      recipePhotos: 'id, recipeKey, updatedAt',
      mealPlans: 'id, date, updatedAt',
      shoppingLists: 'id, updatedAt',
      prices: 'id, key, updatedAt',
    });
    v7.version(6).stores({ targetChanges: 'id, date, updatedAt' });
    v7.version(7).stores({ moodLogs: 'id, date, updatedAt', mindSessions: 'id, date, updatedAt' });
    await v7.table('moodLogs').put({ id: 'm1', createdAt: 'a', updatedAt: 'a', deletedAt: null, date: '2026-11-23', stress: 2 });
    v7.close();
    const db = new ForgeDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect((await db.moodLogs.get('m1'))?.stress).toBe(2);
    expect(await db.audioStates.count()).toBe(0);
    expect(await db.audioDownloads.count()).toBe(0);
    db.close();
  });
});

describe('migration v8 → v9', () => {
  it('ajoute mensurations, photos et douleurs sans toucher aux pesées', async () => {
    const name = `migration9-${crypto.randomUUID()}`;
    names.push(name);
    const v8 = new Dexie(name);
    v8.version(1).stores({ profile: 'id, updatedAt', weighIns: 'id, date, [date+time], updatedAt', meta: 'key' });
    v8.version(2).stores({
      foodEntries: 'id, date, updatedAt',
      exercises: 'id, name, updatedAt',
      workoutTemplates: 'id, updatedAt',
      workouts: 'id, date, updatedAt',
      workoutSets: 'id, workoutId, exerciseId, updatedAt',
      checkIns: 'id, date, updatedAt',
    });
    v8.version(3).stores({ foods: 'id, [source+sourceId], name, updatedAt', mealTemplates: 'id, updatedAt', waterLogs: 'id, date, updatedAt' });
    v8.version(4).stores({ programs: 'id, updatedAt' });
    v8.version(5).stores({
      recipes: 'id, updatedAt',
      recipePhotos: 'id, recipeKey, updatedAt',
      mealPlans: 'id, date, updatedAt',
      shoppingLists: 'id, updatedAt',
      prices: 'id, key, updatedAt',
    });
    v8.version(6).stores({ targetChanges: 'id, date, updatedAt' });
    v8.version(7).stores({ moodLogs: 'id, date, updatedAt', mindSessions: 'id, date, updatedAt' });
    v8.version(8).stores({ audioStates: 'id, updatedAt', audioDownloads: 'id' });
    await v8.table('weighIns').put({ id: 'w1', createdAt: 'a', updatedAt: 'a', deletedAt: null, date: '2026-11-20', time: '07:00', weightKg: 82.4 });
    v8.close();
    const db = new ForgeDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect((await db.weighIns.get('w1'))?.weightKg).toBe(82.4);
    expect(await db.measurements.count()).toBe(0);
    expect(await db.bodyPhotos.count()).toBe(0);
    expect(await db.pains.count()).toBe(0);
    db.close();
  });
});

describe('migration v9 → v10', () => {
  it('ajoute les notes de semaine sans toucher aux douleurs ni aux pesées', async () => {
    const name = `migration10-${crypto.randomUUID()}`;
    names.push(name);
    const v9 = new Dexie(name);
    v9.version(1).stores({ profile: 'id, updatedAt', weighIns: 'id, date, [date+time], updatedAt', meta: 'key' });
    v9.version(2).stores({
      foodEntries: 'id, date, updatedAt',
      exercises: 'id, name, updatedAt',
      workoutTemplates: 'id, updatedAt',
      workouts: 'id, date, updatedAt',
      workoutSets: 'id, workoutId, exerciseId, updatedAt',
      checkIns: 'id, date, updatedAt',
    });
    v9.version(3).stores({ foods: 'id, [source+sourceId], name, updatedAt', mealTemplates: 'id, updatedAt', waterLogs: 'id, date, updatedAt' });
    v9.version(4).stores({ programs: 'id, updatedAt' });
    v9.version(5).stores({
      recipes: 'id, updatedAt',
      recipePhotos: 'id, recipeKey, updatedAt',
      mealPlans: 'id, date, updatedAt',
      shoppingLists: 'id, updatedAt',
      prices: 'id, key, updatedAt',
    });
    v9.version(6).stores({ targetChanges: 'id, date, updatedAt' });
    v9.version(7).stores({ moodLogs: 'id, date, updatedAt', mindSessions: 'id, date, updatedAt' });
    v9.version(8).stores({ audioStates: 'id, updatedAt', audioDownloads: 'id' });
    v9.version(9).stores({ measurements: 'id, date, updatedAt', bodyPhotos: 'id, date, updatedAt', pains: 'id, updatedAt' });
    await v9.table('weighIns').put({ id: 'w1', createdAt: 'a', updatedAt: 'a', deletedAt: null, date: '2026-11-20', time: '07:00', weightKg: 82.4 });
    await v9.table('pains').put({ id: 'p1', createdAt: 'a', updatedAt: 'a', deletedAt: null, zone: 'bas-dos', startedOn: '2026-11-19', resolvedOn: null, activities: [], logs: [{ date: '2026-11-19', intensity: 5 }] });
    v9.close();
    const db = new ForgeDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect((await db.weighIns.get('w1'))?.weightKg).toBe(82.4);
    expect((await db.pains.get('p1'))?.logs).toHaveLength(1);
    expect(await db.weekNotes.count()).toBe(0);
    db.close();
  });
});

describe('notes de semaine', () => {
  it('gardent une seule note par semaine et refusent un texte trop long', async () => {
    const name = `weeknotes-${crypto.randomUUID()}`;
    names.push(name);
    const db = new ForgeDB(name);
    const notes = createWeekNoteRepo(db);
    await notes.save('2026-11-16', { wentWell: 'Quatre séances' });
    await notes.save('2026-11-16', { wentWell: 'Quatre séances', intention: 'Dormir plus tôt' });
    const list = await notes.listActive();
    expect(list).toHaveLength(1);
    expect(list[0]?.intention).toBe('Dormir plus tôt');
    await expect(notes.save('2026-11-23', { toAdjust: 'x'.repeat(601) })).rejects.toBeInstanceOf(DataError);
    db.close();
  });
});

describe('migration v10 → v11', () => {
  it('ajoute le journal PULSE sans toucher aux séances ni aux notes de semaine', async () => {
    const name = `migration11-${crypto.randomUUID()}`;
    names.push(name);
    const v10 = new Dexie(name);
    v10.version(1).stores({ profile: 'id, updatedAt', weighIns: 'id, date, [date+time], updatedAt', meta: 'key' });
    v10.version(2).stores({
      foodEntries: 'id, date, updatedAt',
      exercises: 'id, name, updatedAt',
      workoutTemplates: 'id, updatedAt',
      workouts: 'id, date, updatedAt',
      workoutSets: 'id, workoutId, exerciseId, updatedAt',
      checkIns: 'id, date, updatedAt',
    });
    v10.version(3).stores({ foods: 'id, [source+sourceId], name, updatedAt', mealTemplates: 'id, updatedAt', waterLogs: 'id, date, updatedAt' });
    v10.version(4).stores({ programs: 'id, updatedAt' });
    v10.version(5).stores({ recipes: 'id, updatedAt', recipePhotos: 'id, recipeKey, updatedAt', mealPlans: 'id, date, updatedAt', shoppingLists: 'id, updatedAt', prices: 'id, key, updatedAt' });
    v10.version(6).stores({ targetChanges: 'id, date, updatedAt' });
    v10.version(7).stores({ moodLogs: 'id, date, updatedAt', mindSessions: 'id, date, updatedAt' });
    v10.version(8).stores({ audioStates: 'id, updatedAt', audioDownloads: 'id' });
    v10.version(9).stores({ measurements: 'id, date, updatedAt', bodyPhotos: 'id, date, updatedAt', pains: 'id, updatedAt' });
    v10.version(10).stores({ weekNotes: 'id, weekStart, updatedAt' });
    await v10.table('workouts').put({ id: 'w1', createdAt: 'a', updatedAt: 'a', deletedAt: null, date: '2026-11-20', name: 'Push A', templateId: 't', exerciseIds: ['dc'], startedAt: 'a', endedAt: 'b' });
    await v10.table('weekNotes').put({ id: 'n1', createdAt: 'a', updatedAt: 'a', deletedAt: null, weekStart: '2026-11-16', intention: 'Dormir plus tôt' });
    v10.close();
    const db = new ForgeDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect((await db.workouts.get('w1'))?.name).toBe('Push A');
    expect((await db.weekNotes.get('n1'))?.intention).toBe('Dormir plus tôt');
    expect(await db.pulseDays.count()).toBe(0);
    db.close();
  });
});

describe('journal PULSE', () => {
  it('garde une ligne par jour, ne réécrit que si le résultat change, et garde le choix', async () => {
    const name = `pulse-${crypto.randomUUID()}`;
    names.push(name);
    const db = new ForgeDB(name);
    const repo = createPulseDayRepo(db);
    const snap = { date: '2026-11-25', engineVersion: 1, readiness: 45, confidence: 'moyenne' as const, mode: 'allege' as const, components: [], nutritionKind: 'incomplet' as const, nutritionScore: null, rules: [], plannedTemplateId: 't' };
    const first = await repo.saveSnapshot(snap, new Date('2026-11-25T07:00:00Z'));
    const same = await repo.saveSnapshot(snap, new Date('2026-11-25T08:00:00Z'));
    expect(same.updatedAt).toBe(first.updatedAt);
    await repo.choose('2026-11-25', 'alleger', new Date('2026-11-25T08:05:00Z'));
    const changed = await repo.saveSnapshot({ ...snap, readiness: 52 }, new Date('2026-11-25T09:00:00Z'));
    expect(changed.readiness).toBe(52);
    expect(changed.choice).toBe('alleger');
    expect(await repo.listActive()).toHaveLength(1);
    await expect(repo.choose('2026-11-26', 'garder')).rejects.toBeInstanceOf(DataError);
    await expect(repo.saveSnapshot({ ...snap, date: '2026-11-27', readiness: 140 })).rejects.toBeInstanceOf(DataError);
    db.close();
  });
});

describe('migration v11 → v12', () => {
  it('ajoute les versions de programme sans réécrire les programmes ni leurs séances', async () => {
    const name = `migration12-${crypto.randomUUID()}`;
    names.push(name);
    const v11 = new Dexie(name);
    v11.version(1).stores({ profile: 'id, updatedAt', weighIns: 'id, date, [date+time], updatedAt', meta: 'key' });
    v11.version(2).stores({
      foodEntries: 'id, date, updatedAt',
      exercises: 'id, name, updatedAt',
      workoutTemplates: 'id, updatedAt',
      workouts: 'id, date, updatedAt',
      workoutSets: 'id, workoutId, exerciseId, updatedAt',
      checkIns: 'id, date, updatedAt',
    });
    v11.version(3).stores({ foods: 'id, [source+sourceId], name, updatedAt', mealTemplates: 'id, updatedAt', waterLogs: 'id, date, updatedAt' });
    v11.version(4).stores({ programs: 'id, updatedAt' });
    v11
      .version(5)
      .stores({
        recipes: 'id, updatedAt',
        recipePhotos: 'id, recipeKey, updatedAt',
        mealPlans: 'id, date, updatedAt',
        shoppingLists: 'id, updatedAt',
        prices: 'id, key, updatedAt',
      });
    v11.version(6).stores({ targetChanges: 'id, date, updatedAt' });
    v11.version(7).stores({ moodLogs: 'id, date, updatedAt', mindSessions: 'id, date, updatedAt' });
    v11.version(8).stores({ audioStates: 'id, updatedAt', audioDownloads: 'id' });
    v11.version(9).stores({ measurements: 'id, date, updatedAt', bodyPhotos: 'id, date, updatedAt', pains: 'id, updatedAt' });
    v11.version(10).stores({ weekNotes: 'id, weekStart, updatedAt' });
    v11.version(11).stores({ pulseDays: 'id, date, updatedAt' });
    const prog = { id: 'p1', createdAt: 'a', updatedAt: 'a', deletedAt: null, name: 'Plan FORGE', active: true };
    const paused = { id: 'p2', createdAt: 'a', updatedAt: 'a', deletedAt: null, name: 'Ancien', active: false };
    await v11.table('programs').bulkPut([prog, paused]);
    await v11
      .table('workoutTemplates')
      .put({ id: 't1', createdAt: 'a', updatedAt: 'a', deletedAt: null, name: 'Push', weekdays: [1], exercises: [], position: 0, programId: 'p1' });
    await v11
      .table('pulseDays')
      .put({
        id: 'd1',
        createdAt: 'a',
        updatedAt: 'a',
        deletedAt: null,
        date: '2026-11-25',
        engineVersion: 2,
        readiness: 70,
        confidence: 'moyenne',
        mode: 'normal',
        components: [],
        nutritionKind: 'incomplet',
        nutritionScore: null,
        rules: [],
      });
    v11.close();
    const db = new ForgeDB(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(await db.programs.get('p1')).toEqual(prog);
    expect(await db.programs.get('p2')).toEqual(paused);
    expect((await db.workoutTemplates.get('t1'))?.programId).toBe('p1');
    expect((await db.pulseDays.get('d1'))?.readiness).toBe(70);
    expect(await db.programVersions.count()).toBe(0);
    db.close();
  });
});
