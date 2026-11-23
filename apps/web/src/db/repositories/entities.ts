import type { EntityTable, Table } from 'dexie';
import type { ForgeDB } from '../schema';
import type { CheckIn, Exercise, FoodEntry, SyncFields, Workout, WorkoutSet, WorkoutTemplate } from '../types';
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

export function createFoodRepo(db: ForgeDB) {
  return entityRepo<FoodEntry>(db.foodEntries, (i) => {
    if (i.date !== undefined) check(isDateKey(i.date), 'Date invalide.');
    if (i.meal !== undefined) check(MEALS.includes(i.meal), 'Repas invalide.');
    if (i.name !== undefined) check(i.name.trim().length > 0 && i.name.length <= 120, 'Donne un nom à l’aliment (120 caractères maximum).');
    if (i.quantity !== undefined) check(i.quantity.length <= 40, 'Quantité trop longue.');
    if (i.kcal !== undefined) check(between(i.kcal, 0, 5000), 'Les calories doivent être comprises entre 0 et 5 000.');
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
