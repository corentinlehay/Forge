import Dexie, { type EntityTable } from 'dexie';
import { activeDbName } from './dataMode';
import type { AudioDownload, AudioState, BodyPhoto, Measurement, Pain, MindSession, MoodLog, TargetChange, CheckIn, Exercise, Food, FoodEntry, MealPlan, MealTemplate, MetaEntry, PriceRecord, Profile, Program, RecipePhoto, RecipeRecord, ShoppingList, WaterLog, WeighIn, Workout, WorkoutSet, WorkoutTemplate } from './types';
import { newId, nowIso } from '../lib/ids';

/**
 * Base locale unique de FORGE (IndexedDB via Dexie).
 * Règle : une montée de version ajoute ou transforme, elle ne détruit jamais de données.
 * Chaque nouvelle version est accompagnée d'un test de migration.
 *
 * v1 : profil, pesées, réglages.
 * v2 : + journal alimentaire, exercices, programme, séances, séries, check-ins (tables ajoutées, rien de modifié).
 * v3 : + aliments (perso, Ciqual, Open Food Facts), repas habituels, hydratation (tables ajoutées, rien de modifié).
 * v4 : + programmes ; les séances existantes sont rattachées à un premier programme actif.
 * v5 : + recettes perso, photos de recettes, planning des repas, listes de courses, prix des ingrédients (tables ajoutées).
 * v6 : + historique des objectifs nutritionnels (table ajoutée).
 */
export const SCHEMA_VERSION = 9;

export class ForgeDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  weighIns!: EntityTable<WeighIn, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;
  foodEntries!: EntityTable<FoodEntry, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  workoutTemplates!: EntityTable<WorkoutTemplate, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workoutSets!: EntityTable<WorkoutSet, 'id'>;
  checkIns!: EntityTable<CheckIn, 'id'>;
  foods!: EntityTable<Food, 'id'>;
  mealTemplates!: EntityTable<MealTemplate, 'id'>;
  waterLogs!: EntityTable<WaterLog, 'id'>;
  programs!: EntityTable<Program, 'id'>;
  recipes!: EntityTable<RecipeRecord, 'id'>;
  recipePhotos!: EntityTable<RecipePhoto, 'id'>;
  mealPlans!: EntityTable<MealPlan, 'id'>;
  shoppingLists!: EntityTable<ShoppingList, 'id'>;
  prices!: EntityTable<PriceRecord, 'id'>;
  targetChanges!: EntityTable<TargetChange, 'id'>;
  moodLogs!: EntityTable<MoodLog, 'id'>;
  mindSessions!: EntityTable<MindSession, 'id'>;
  audioStates!: EntityTable<AudioState, 'id'>;
  audioDownloads!: EntityTable<AudioDownload, 'id'>;
  measurements!: EntityTable<Measurement, 'id'>;
  bodyPhotos!: EntityTable<BodyPhoto, 'id'>;
  pains!: EntityTable<Pain, 'id'>;

  constructor(name = 'forge') {
    super(name);
    this.version(1).stores({
      profile: 'id, updatedAt',
      weighIns: 'id, date, [date+time], updatedAt',
      meta: 'key',
    });
    this.version(2).stores({
      foodEntries: 'id, date, updatedAt',
      exercises: 'id, name, updatedAt',
      workoutTemplates: 'id, updatedAt',
      workouts: 'id, date, updatedAt',
      workoutSets: 'id, workoutId, exerciseId, updatedAt',
      checkIns: 'id, date, updatedAt',
    });
    this.version(3).stores({
      foods: 'id, [source+sourceId], name, updatedAt',
      mealTemplates: 'id, updatedAt',
      waterLogs: 'id, date, updatedAt',
    });
    this.version(4)
      .stores({ programs: 'id, updatedAt' })
      .upgrade(async (tx) => {
        const templates = tx.table('workoutTemplates');
        const existing = (await templates.toArray()) as WorkoutTemplate[];
        if (!existing.some((t) => !t.deletedAt)) return;
        const stamp = nowIso(new Date());
        const id = newId();
        await tx.table('programs').add({ id, createdAt: stamp, updatedAt: stamp, deletedAt: null, name: 'Mon programme', active: true });
        await templates.toCollection().modify((t: WorkoutTemplate) => {
          if (!t.programId) t.programId = id;
        });
      });
    this.version(5).stores({
      recipes: 'id, updatedAt',
      recipePhotos: 'id, recipeKey, updatedAt',
      mealPlans: 'id, date, updatedAt',
      shoppingLists: 'id, updatedAt',
      prices: 'id, key, updatedAt',
    });
    this.version(6).stores({ targetChanges: 'id, date, updatedAt' });
    this.version(7).stores({ moodLogs: 'id, date, updatedAt', mindSessions: 'id, date, updatedAt' });
    this.version(8).stores({ audioStates: 'id, updatedAt', audioDownloads: 'id' });
    this.version(9).stores({ measurements: 'id, date, updatedAt', bodyPhotos: 'id, date, updatedAt', pains: 'id, updatedAt' });
  }
}

let shared: ForgeDB | null = null;

/** Instance partagée par toute l'app, sur la base active (réelle ou démo). Les tests créent leurs propres bases. */
export function getDb(): ForgeDB {
  shared ??= new ForgeDB(activeDbName());
  return shared;
}

/** Ferme la base partagée (avant de la supprimer ou de changer de mode). */
export function closeDb(): void {
  shared?.close();
  shared = null;
}
