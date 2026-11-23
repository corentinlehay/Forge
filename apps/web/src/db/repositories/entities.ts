import type { EntityTable, Table } from 'dexie';
import type { ForgeDB } from '../schema';
import type { CheckIn, Exercise, Food, FoodEntry, MealTemplate, Per100, SyncFields, WaterLog, Workout, WorkoutSet, WorkoutTemplate } from '../types';
import { isDateKey } from '../../lib/dates';
import { newId, nowIso } from '../../lib/ids';

/** Erreur de saisie, au message affichable tel quel. */
export class DataError extends Error {}

type Input<T> = Omit<T, keyof SyncFields>;

function check(condition: boolean, message: string): void {
  if (!condition) throw new DataError(message);
}

const between = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** Accès générique : ajout, mise à jour, suppression logique, lecture des lignes actives. */
function entityRepo<T extends SyncFields>(entityTable: EntityTable<T, 'id'>, validate: (input: Partial<Input<T>>) => void) {
  const table = entityTable as unknown as Table<T, string>;
  return {
    async add(input: Input<T>, now: Date = new Date()): Promise<T> {
      validate(input as Partial<Input<T>>);
      const stamp = nowIso(now);
      const record = { ...input, id: newId(), createdAt: stamp, updatedAt: stamp, deletedAt: null } as T;
      await table.add(record);
      return record;
    },
    async update(id: string, patch: Partial<Input<T>>, now: Date = new Date()): Promise<T> {
      validate(patch);
      const existing = await table.get(id);
      if (!existing || existing.deletedAt) throw new DataError('Élément introuvable.');
      const next = { ...existing, ...patch, updatedAt: nowIso(now) } as T;
      await table.put(next);
      return next;
    },
    async remove(id: string, now: Date = new Date()): Promise<void> {
      const existing = await table.get(id);
      if (!existing || existing.deletedAt) return;
      const stamp = nowIso(now);
      await table.put({ ...existing, deletedAt: stamp, updatedAt: stamp });
    },
    async get(id: string): Promise<T | undefined> {
      const record = await table.get(id);
      return record && !record.deletedAt ? record : undefined;
    },
    async listActive(): Promise<T[]> {
      return (await table.toArray()).filter((r) => !r.deletedAt);
    },
  };
}

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

function checkPer100(p: Per100): void {
  check(between(p.kcal, 0, 900), 'Calories pour 100 g : entre 0 et 900.');
  check(between(p.proteinG, 0, 100) && between(p.carbsG, 0, 100) && between(p.fatG, 0, 100), 'Macros pour 100 g : entre 0 et 100 g.');
  check(p.fiberG === null || between(p.fiberG, 0, 100), 'Fibres pour 100 g : entre 0 et 100 g.');
}

export function createFoodRepo(db: ForgeDB) {
  return entityRepo<FoodEntry>(db.foodEntries, (i) => {
    if (i.date !== undefined) check(isDateKey(i.date), 'Date invalide.');
    if (i.meal !== undefined) check(MEALS.includes(i.meal), 'Repas invalide.');
    if (i.name !== undefined) check(i.name.trim().length > 0 && i.name.length <= 120, 'Donne un nom à l’aliment (120 caractères maximum).');
    if (i.quantity !== undefined) check(i.quantity.length <= 40, 'Quantité trop longue.');
    if (i.kcal !== undefined) check(between(i.kcal, 0, 5000), 'Les calories doivent être comprises entre 0 et 5 000.');
    if (i.grams !== undefined && i.grams !== null) check(between(i.grams, 0.1, 5000), 'Quantité entre 0,1 et 5 000 g.');
    if (i.fiberG !== undefined && i.fiberG !== null) check(between(i.fiberG, 0, 300), 'Fibres invalides.');
    if (i.per100) checkPer100(i.per100);
    for (const [v, label] of [
      [i.proteinG, 'protéines'],
      [i.carbsG, 'glucides'],
      [i.fatG, 'lipides'],
    ] as const) {
      if (v !== undefined) check(between(v, 0, 1000), `Valeur de ${label} invalide (0 à 1 000 g).`);
    }
  });
}

export function createExerciseRepo(db: ForgeDB) {
  const base = entityRepo<Exercise>(db.exercises, (i) => {
    if (i.name !== undefined) check(i.name.trim().length > 0 && i.name.length <= 80, 'Nom d’exercice invalide (80 caractères maximum).');
  });
  return {
    ...base,
    /** Retrouve un exercice par son nom (sans tenir compte de la casse), ou le crée. */
    async findOrCreate(name: string, now: Date = new Date()): Promise<Exercise> {
      const clean = name.trim().replace(/\s+/g, ' ');
      const all = await base.listActive();
      const found = all.find((e) => e.name.toLocaleLowerCase('fr-FR') === clean.toLocaleLowerCase('fr-FR'));
      return found ?? base.add({ name: clean }, now);
    },
  };
}

export function createTemplateRepo(db: ForgeDB) {
  return entityRepo<WorkoutTemplate>(db.workoutTemplates, (i) => {
    if (i.name !== undefined) check(i.name.trim().length > 0 && i.name.length <= 60, 'Donne un nom à la séance (60 caractères maximum).');
    if (i.weekdays !== undefined) check(i.weekdays.every((d) => Number.isInteger(d) && d >= 1 && d <= 7) && new Set(i.weekdays).size === i.weekdays.length, 'Jours invalides.');
    if (i.exercises !== undefined) {
      check(i.exercises.length <= 30, '30 exercices maximum par séance.');
      for (const e of i.exercises) {
        check(Number.isInteger(e.sets) && e.sets >= 1 && e.sets <= 20, 'Entre 1 et 20 séries par exercice.');
        check(e.reps.length <= 20, 'Répétitions : 20 caractères maximum.');
      }
    }
  });
}

export function createWorkoutRepo(db: ForgeDB) {
  return entityRepo<Workout>(db.workouts, (i) => {
    if (i.date !== undefined) check(isDateKey(i.date), 'Date invalide.');
    if (i.name !== undefined) check(i.name.trim().length > 0 && i.name.length <= 60, 'Nom de séance invalide.');
  });
}

export function createSetRepo(db: ForgeDB) {
  return entityRepo<WorkoutSet>(db.workoutSets, (i) => {
    if (i.weightKg !== undefined) check(between(i.weightKg, 0, 500), 'La charge doit être comprise entre 0 et 500 kg.');
    if (i.reps !== undefined) check(Number.isInteger(i.reps) && between(i.reps, 1, 100), 'Entre 1 et 100 répétitions.');
  });
}

export function createCheckInRepo(db: ForgeDB) {
  const scale = (v: unknown) => Number.isInteger(v) && between(v, 1, 5);
  return entityRepo<CheckIn>(db.checkIns, (i) => {
    if (i.date !== undefined) check(isDateKey(i.date), 'Date invalide.');
    if (i.sleepHours !== undefined) check(between(i.sleepHours, 0, 16), 'Sommeil entre 0 et 16 h.');
    if (i.energy !== undefined) check(scale(i.energy), 'Énergie : de 1 à 5.');
    if (i.fatigue !== undefined) check(scale(i.fatigue), 'Fatigue : de 1 à 5.');
    if (i.soreness !== undefined) check(scale(i.soreness), 'Courbatures : de 1 à 5.');
    if (i.note !== undefined) check(i.note.length <= 500, 'Note trop longue (500 caractères maximum).');
  });
}

export function createFoodCatalogRepo(db: ForgeDB) {
  const base = entityRepo<Food>(db.foods, (i) => {
    if (i.name !== undefined) check(i.name.trim().length > 0 && i.name.length <= 160, 'Donne un nom à l’aliment (160 caractères maximum).');
    if (i.brand !== undefined) check(i.brand.length <= 80, 'Marque trop longue.');
    if (i.per100) checkPer100(i.per100);
    if (i.servingG !== undefined && i.servingG !== null) check(between(i.servingG, 0.1, 2000), 'Portion entre 0,1 et 2 000 g.');
  });
  return {
    ...base,
    async findBySource(source: Food['source'], sourceId: string): Promise<Food | undefined> {
      const found = await db.foods.where('[source+sourceId]').equals([source, sourceId]).first();
      return found && !found.deletedAt ? found : undefined;
    },
    /** Garde une copie locale d'un aliment Ciqual ou Open Food Facts (pour les favoris, l'historique et le hors-ligne). */
    async remember(input: Omit<Food, keyof SyncFields | 'favorite' | 'useCount' | 'lastUsedAt'>, now: Date = new Date()): Promise<Food> {
      if (input.source !== 'custom' && input.sourceId) {
        const existing = await this.findBySource(input.source, input.sourceId);
        if (existing) return base.update(existing.id, { name: input.name, brand: input.brand, per100: input.per100, servingG: input.servingG, servingLabel: input.servingLabel, state: input.state, unit: input.unit }, now);
      }
      return base.add({ ...input, favorite: false, useCount: 0, lastUsedAt: null }, now);
    },
    async markUsed(id: string, now: Date = new Date()): Promise<void> {
      const food = await base.get(id);
      if (food) await base.update(id, { useCount: food.useCount + 1, lastUsedAt: nowIso(now) }, now);
    },
    async toggleFavorite(id: string, now: Date = new Date()): Promise<boolean> {
      const food = await base.get(id);
      if (!food) return false;
      await base.update(id, { favorite: !food.favorite }, now);
      return !food.favorite;
    },
  };
}

export function createMealTemplateRepo(db: ForgeDB) {
  return entityRepo<MealTemplate>(db.mealTemplates, (i) => {
    if (i.name !== undefined) check(i.name.trim().length > 0 && i.name.length <= 60, 'Donne un nom au repas (60 caractères maximum).');
    if (i.items !== undefined) check(i.items.length > 0 && i.items.length <= 40, 'Un repas habituel contient de 1 à 40 aliments.');
  });
}

export function createWaterRepo(db: ForgeDB) {
  return entityRepo<WaterLog>(db.waterLogs, (i) => {
    if (i.date !== undefined) check(isDateKey(i.date), 'Date invalide.');
    if (i.ml !== undefined) check(Number.isInteger(i.ml) && between(i.ml, 1, 3000), 'Entre 1 et 3 000 ml par ajout.');
  });
}
