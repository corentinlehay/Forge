import type { EntityTable, Table } from 'dexie';
import type { ForgeDB } from '../schema';
import type { BodyPhoto, CheckIn, Exercise, Food, FoodEntry, MealPlan, MealTemplate, Measurement, MindSession, MoodLog, Pain, Per100, PriceRecord, Program, RecipePhoto, RecipeRecord, PulseChoice, PulseDay, ShoppingList, SyncFields, TargetChange, WaterLog, WeekNote, Workout, WorkoutSet, WorkoutTemplate } from '../types';
import type { LibraryExercise } from '../../data/exerciseLibrary';
import { isDateKey, isTimeKey } from '../../lib/dates';
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
    /** L'exercice de la bibliothèque dans ta base (créé ou relié à un exercice du même nom au premier usage). */
    async fromLibrary(lib: LibraryExercise, now: Date = new Date()): Promise<Exercise> {
      const all = await base.listActive();
      const fields = { libraryId: lib.id, muscle: lib.muscle, secondary: lib.secondary, equipment: lib.equipment, kind: lib.kind, cues: lib.cues, restSec: lib.rest };
      const linked = all.find((e) => e.libraryId === lib.id);
      if (linked) return linked;
      const sameName = all.find((e) => !e.libraryId && e.name.toLocaleLowerCase('fr-FR') === lib.name.toLocaleLowerCase('fr-FR'));
      if (sameName) return base.update(sameName.id, fields, now);
      return base.add({ name: lib.name, ...fields }, now);
    },
  };
}

export function createProgramRepo(db: ForgeDB) {
  const base = entityRepo<Program>(db.programs, (i) => {
    if (i.name !== undefined) check(i.name.trim().length > 0 && i.name.length <= 60, 'Donne un nom au programme (60 caractères maximum).');
  });
  return {
    ...base,
    /** Le programme actif ; s'il n'y en a pas, « Mon programme » est créé et activé. */
    async ensureActive(now: Date = new Date()): Promise<Program> {
      const all = await base.listActive();
      const current = all.find((p) => p.active);
      if (current) return current;
      if (all[0]) {
        await this.activate(all[0].id, now);
        return { ...all[0], active: true };
      }
      return base.add({ name: 'Mon programme', active: true }, now);
    },
    /** Copie un programme et ses séances (la copie n'est pas activée). */
    async duplicate(id: string, now: Date = new Date()): Promise<Program> {
      const source = await base.get(id);
      if (!source || source.deletedAt) throw new DataError('Programme introuvable.');
      const templates = templateRepo(db);
      return db.transaction('rw', db.programs, db.workoutTemplates, async () => {
        const copy = await base.add({ name: `${source.name.slice(0, 52)} (copie)`, active: false, ...(source.note ? { note: source.note } : {}) }, now);
        const own = (await templates.listActive()).filter((t) => t.programId === id);
        for (const t of own) await templates.add({ name: t.name, weekdays: t.weekdays, exercises: t.exercises, position: t.position, programId: copy.id }, now);
        return copy;
      });
    },
    /** Supprime un programme et ses séances. Les séances déjà faites restent dans l'historique. */
    async removeWithTemplates(id: string, now: Date = new Date()): Promise<void> {
      const templates = templateRepo(db);
      await db.transaction('rw', db.programs, db.workoutTemplates, async () => {
        for (const t of (await templates.listActive()).filter((x) => x.programId === id)) await templates.remove(t.id, now);
        await base.remove(id, now);
      });
    },
    /** Active un programme et désactive les autres. */
    async activate(id: string, now: Date = new Date()): Promise<void> {
      await db.transaction('rw', db.programs, async () => {
        for (const p of await base.listActive()) {
          if (p.active !== (p.id === id)) await base.update(p.id, { active: p.id === id }, now);
        }
      });
    },
  };
}

export function createTemplateRepo(db: ForgeDB) {
  return templateRepo(db);
}

function templateRepo(db: ForgeDB) {
  return entityRepo<WorkoutTemplate>(db.workoutTemplates, (i) => {
    if (i.name !== undefined) check(i.name.trim().length > 0 && i.name.length <= 60, 'Donne un nom à la séance (60 caractères maximum).');
    if (i.weekdays !== undefined) check(i.weekdays.every((d) => Number.isInteger(d) && d >= 1 && d <= 7) && new Set(i.weekdays).size === i.weekdays.length, 'Jours invalides.');
    if (i.exercises !== undefined) {
      check(i.exercises.length <= 30, '30 exercices maximum par séance.');
      for (const e of i.exercises) {
        check(Number.isInteger(e.sets) && e.sets >= 1 && e.sets <= 20, 'Entre 1 et 20 séries par exercice.');
        check(e.reps.length <= 20, 'Répétitions : 20 caractères maximum.');
        if (e.restSec !== undefined && e.restSec !== null) check(Number.isInteger(e.restSec) && between(e.restSec, 0, 900), 'Repos entre 0 et 15 minutes.');
        if (e.rir !== undefined && e.rir !== null) check(Number.isInteger(e.rir) && between(e.rir, 0, 10), 'RIR cible entre 0 et 10.');
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
    if (i.rir !== undefined && i.rir !== null) check(Number.isInteger(i.rir) && between(i.rir, 0, 10), 'RIR entre 0 et 10.');
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
    if (i.bedTime !== undefined && i.bedTime !== null) check(isTimeKey(i.bedTime), 'Heure de coucher invalide.');
    if (i.wakeTime !== undefined && i.wakeTime !== null) check(isTimeKey(i.wakeTime), 'Heure de réveil invalide.');
    if (i.awakenings !== undefined && i.awakenings !== null) check(Number.isInteger(i.awakenings) && between(i.awakenings, 0, 20), 'Réveils : de 0 à 20.');
    if (i.sleepQuality !== undefined && i.sleepQuality !== null) check(scale(i.sleepQuality), 'Qualité du sommeil : de 1 à 5.');
  });
}

export function createMoodLogRepo(db: ForgeDB) {
  const scale = (v: unknown) => v === null || v === undefined || (Number.isInteger(v) && between(v, 1, 5));
  return entityRepo<MoodLog>(db.moodLogs, (i) => {
    if (i.date !== undefined) check(isDateKey(i.date), 'Date invalide.');
    for (const k of ['mood', 'stress', 'mentalEnergy', 'motivation', 'mentalLoad', 'recovery'] as const) check(scale(i[k]), 'Les échelles vont de 1 à 5.');
    if (i.emotions !== undefined) check(i.emotions.length <= 12 && i.emotions.every((e) => e.length <= 40), 'Trop d’émotions sélectionnées.');
    if (i.note !== undefined) check(i.note.length <= 1000, 'Commentaire trop long (1 000 caractères maximum).');
  });
}

export function createMindSessionRepo(db: ForgeDB) {
  const scale = (v: unknown) => v === null || v === undefined || (Number.isInteger(v) && between(v, 1, 5));
  return entityRepo<MindSession>(db.mindSessions, (i) => {
    if (i.date !== undefined) check(isDateKey(i.date), 'Date invalide.');
    if (i.time !== undefined) check(isTimeKey(i.time), 'Heure invalide.');
    if (i.durationSec !== undefined) check(Number.isFinite(i.durationSec) && between(i.durationSec, 0, 6 * 3600), 'Durée invalide.');
    if (i.title !== undefined) check(i.title.length > 0 && i.title.length <= 120, 'Titre invalide.');
    check(scale(i.tensionBefore) && scale(i.tensionAfter), 'Tension : de 1 à 5.');
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

export function createRecipeRepo(db: ForgeDB) {
  return entityRepo<RecipeRecord>(db.recipes, (i) => {
    if (i.name !== undefined) check(i.name.trim().length > 0 && i.name.length <= 80, 'Donne un nom à la recette (80 caractères maximum).');
    if (i.description !== undefined) check(i.description.length <= 400, 'Description : 400 caractères maximum.');
    if (i.servings !== undefined) check(Number.isInteger(i.servings) && between(i.servings, 1, 50), 'Entre 1 et 50 portions.');
    if (i.prepMin !== undefined) check(Number.isInteger(i.prepMin) && between(i.prepMin, 0, 1440), 'Temps de préparation entre 0 et 1 440 minutes.');
    if (i.cookMin !== undefined) check(Number.isInteger(i.cookMin) && between(i.cookMin, 0, 1440), 'Temps de cuisson entre 0 et 1 440 minutes.');
    if (i.ingredients !== undefined) {
      check(i.ingredients.length >= 1 && i.ingredients.length <= 60, 'Entre 1 et 60 ingrédients.');
      for (const ing of i.ingredients) check(ing.name.trim().length > 0 && Number.isFinite(ing.grams) && between(ing.grams, 0.1, 20000), `Quantité de « ${ing.name} » entre 0,1 g et 20 kg.`);
    }
    if (i.steps !== undefined) check(i.steps.length <= 30 && i.steps.every((st) => st.length <= 600), 'Étapes : 30 au maximum, 600 caractères chacune.');
  });
}

export function createRecipePhotoRepo(db: ForgeDB) {
  const base = entityRepo<RecipePhoto>(db.recipePhotos, (i) => {
    if (i.dataUrl !== undefined) check(i.dataUrl.startsWith('data:image/') && i.dataUrl.length < 1_500_000, 'Photo trop lourde ou invalide.');
  });
  return {
    ...base,
    /** Remplace la photo d'une recette. */
    async setFor(recipeKey: string, dataUrl: string, now: Date = new Date()): Promise<RecipePhoto> {
      for (const old of (await db.recipePhotos.where('recipeKey').equals(recipeKey).toArray()).filter((p) => !p.deletedAt)) await base.remove(old.id, now);
      return base.add({ recipeKey, dataUrl }, now);
    },
    async removeFor(recipeKey: string, now: Date = new Date()): Promise<void> {
      for (const old of (await db.recipePhotos.where('recipeKey').equals(recipeKey).toArray()).filter((p) => !p.deletedAt)) await base.remove(old.id, now);
    },
  };
}

export function createMealPlanRepo(db: ForgeDB) {
  return entityRepo<MealPlan>(db.mealPlans, (i) => {
    if (i.servings !== undefined) check(Number.isFinite(i.servings) && between(i.servings, 0.25, 20), 'Entre 0,25 et 20 portions.');
  });
}

export function createShoppingListRepo(db: ForgeDB) {
  return entityRepo<ShoppingList>(db.shoppingLists, (i) => {
    if (i.name !== undefined) check(i.name.trim().length > 0 && i.name.length <= 80, 'Donne un nom à la liste.');
    if (i.items !== undefined) check(i.items.length <= 300, 'Liste trop longue.');
  });
}

export function createPriceRepo(db: ForgeDB) {
  const base = entityRepo<PriceRecord>(db.prices, (i) => {
    if (i.amountEur !== undefined) check(Number.isFinite(i.amountEur) && between(i.amountEur, 0.01, 1000), 'Prix entre 0,01 et 1 000 €.');
    if (i.quantity !== undefined) check(Number.isFinite(i.quantity) && between(i.quantity, 0.1, 100000), 'Quantité invalide.');
  });
  return {
    ...base,
    /** Enregistre (ou remplace) le prix d'un ingrédient. */
    async setPrice(input: Pick<PriceRecord, 'key' | 'name' | 'amountEur' | 'quantity' | 'unit'>, now: Date = new Date()): Promise<PriceRecord> {
      const existing = (await db.prices.where('key').equals(input.key).toArray()).find((p) => !p.deletedAt);
      return existing ? base.update(existing.id, input, now) : base.add(input, now);
    },
  };
}

export function createTargetChangeRepo(db: ForgeDB) {
  return entityRepo<TargetChange>(db.targetChanges, () => undefined);
}

const MEASURE_RANGE: Record<'waistCm' | 'chestCm' | 'armCm' | 'thighCm' | 'hipsCm', [number, number]> = {
  waistCm: [40, 200],
  chestCm: [50, 200],
  armCm: [15, 70],
  thighCm: [25, 110],
  hipsCm: [50, 200],
};

export function createMeasurementRepo(db: ForgeDB) {
  return entityRepo<Measurement>(db.measurements, (i) => {
    if (i.date !== undefined) check(isDateKey(i.date), 'Date invalide.');
    for (const [k, [min, max]] of Object.entries(MEASURE_RANGE) as [keyof typeof MEASURE_RANGE, [number, number]][]) {
      const v = i[k];
      if (v !== undefined && v !== null) check(Number.isFinite(v) && between(v, min, max), `Mesure hors limites (${min} à ${max} cm).`);
    }
    if (i.note !== undefined) check(i.note.length <= 300, 'Note trop longue (300 caractères maximum).');
  });
}

export function createBodyPhotoRepo(db: ForgeDB) {
  return entityRepo<BodyPhoto>(db.bodyPhotos, (i) => {
    if (i.date !== undefined) check(isDateKey(i.date), 'Date invalide.');
    if (i.pose !== undefined) check(['face', 'profil', 'dos'].includes(i.pose), 'Pose invalide.');
    if (i.dataUrl !== undefined) check(i.dataUrl.startsWith('data:image/') && i.dataUrl.length <= 3_000_000, 'Image invalide ou trop lourde.');
  });
}

/**
 * Journal PULSE : une ligne par jour. Le résultat n'est réécrit que s'il change ;
 * ton choix sur la séance est gardé à part et n'est jamais écrasé par un nouveau calcul.
 */
export function createPulseDayRepo(db: ForgeDB) {
  const base = entityRepo<PulseDay>(db.pulseDays, (i) => {
    if (i.date !== undefined) check(isDateKey(i.date), 'Date invalide.');
    if (i.readiness !== undefined && i.readiness !== null) check(i.readiness >= 0 && i.readiness <= 100, 'Score hors de 0 à 100.');
  });
  const byDate = async (date: string) => (await db.pulseDays.where('date').equals(date).toArray()).find((r) => !r.deletedAt) ?? null;
  return {
    ...base,
    byDate,
    async saveSnapshot(snapshot: Omit<PulseDay, keyof SyncFields | 'choice' | 'choiceAt'>, now: Date = new Date()): Promise<PulseDay> {
      const existing = await byDate(snapshot.date);
      if (!existing) return base.add({ ...snapshot, choice: null, choiceAt: null } as Input<PulseDay>, now);
      const keys = Object.keys(snapshot) as (keyof typeof snapshot)[];
      const same = keys.every((k) => JSON.stringify(existing[k] ?? null) === JSON.stringify(snapshot[k] ?? null));
      return same ? existing : base.update(existing.id, snapshot, now);
    },
    async choose(date: string, choice: PulseChoice, now: Date = new Date()): Promise<PulseDay> {
      const existing = await byDate(date);
      if (!existing) throw new DataError('Le résultat PULSE du jour n’est pas encore enregistré.');
      return base.update(existing.id, { choice, choiceAt: now.toISOString() }, now);
    },
  };
}

/** Notes de semaine : une par semaine ; une nouvelle saisie remplace la précédente. */
export function createWeekNoteRepo(db: ForgeDB) {
  const base = entityRepo<WeekNote>(db.weekNotes, (i) => {
    if (i.weekStart !== undefined) check(isDateKey(i.weekStart), 'Semaine invalide.');
    for (const k of ['wentWell', 'toAdjust', 'intention'] as const) {
      const v = i[k];
      if (v !== undefined) check(v.length <= 600, 'Texte trop long (600 caractères maximum).');
    }
  });
  return {
    ...base,
    async save(weekStart: string, fields: Pick<WeekNote, 'wentWell' | 'toAdjust' | 'intention'>, now: Date = new Date()): Promise<WeekNote> {
      const existing = (await base.listActive()).find((n) => n.weekStart === weekStart);
      return existing ? base.update(existing.id, fields, now) : base.add({ weekStart, ...fields } as Input<WeekNote>, now);
    },
  };
}

export function createPainRepo(db: ForgeDB) {
  return entityRepo<Pain>(db.pains, (i) => {
    if (i.zone !== undefined) check(i.zone.length > 0 && i.zone.length <= 40, 'Zone invalide.');
    if (i.startedOn !== undefined) check(isDateKey(i.startedOn), 'Date de début invalide.');
    if (i.resolvedOn !== undefined && i.resolvedOn !== null) check(isDateKey(i.resolvedOn), 'Date de fin invalide.');
    if (i.activities !== undefined) check(i.activities.length <= 10 && i.activities.every((a) => a.length > 0 && a.length <= 40), 'Activités : 10 au plus, 40 caractères chacune.');
    if (i.note !== undefined) check(i.note.length <= 1000, 'Commentaire trop long (1 000 caractères maximum).');
    if (i.logs !== undefined) {
      check(i.logs.length <= 400, 'Journal trop long.');
      for (const l of i.logs) {
        check(isDateKey(l.date), 'Date invalide.');
        check(Number.isInteger(l.intensity) && between(l.intensity, 0, 10), 'Intensité de 0 à 10.');
        if (l.note !== undefined) check(l.note.length <= 500, 'Note trop longue (500 caractères maximum).');
      }
    }
  });
}
