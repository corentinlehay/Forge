import { useLiveQuery } from 'dexie-react-hooks';
import { EFFORT_SCALE_KEY, isEffortScale, type EffortScale } from '../domain/effort';
import { useEffect, useState } from 'react';
import { toLocalDateKey } from '../lib/dates';
import { getDb } from './schema';
import { createMetaRepo } from './repositories/meta';
import { createProfileRepo } from './repositories/profile';
import { createWeighInRepo } from './repositories/weighIns';
import {
  createMindSessionRepo,
  createWeekNoteRepo,
  createPulseDayRepo,
  createMeasurementRepo,
  createBodyPhotoRepo,
  createPainRepo,
  createMoodLogRepo,
  createCheckInRepo,
  createExerciseRepo,
  createFoodCatalogRepo,
  createFoodRepo,
  createMealPlanRepo,
  createMealTemplateRepo,
  createPriceRepo,
  createProgramRepo,
  createProgramVersionRepo,
  createRecipePhotoRepo,
  createRecipeRepo,
  createSetRepo,
  createShoppingListRepo,
  createTemplateRepo,
  createWaterRepo,
  createWorkoutRepo,
  createTargetChangeRepo,
} from './repositories/entities';
import type {
  AudioState,
  BodyPhoto,
  PulseDay,
  WeekNote,
  Measurement,
  MindSession,
  MoodLog,
  Pain,
  TargetChange,
  CheckIn,
  Exercise,
  Food,
  FoodEntry,
  MealPlan,
  MealTemplate,
  PriceRecord,
  Profile,
  Program,
  ProgramVersion,
  RecipePhoto,
  RecipeRecord,
  ShoppingList,
  WaterLog,
  WeighIn,
  Workout,
  WorkoutSet,
  WorkoutTemplate,
} from './types';
import { programTemplates } from '../domain/training';

/**
 * Lectures réactives : chaque écran se met à jour dès qu'une donnée change en base.
 * `undefined` = encore en chargement.
 */

export const repos = {
  get weighIns() {
    return createWeighInRepo(getDb());
  },
  get profile() {
    return createProfileRepo(getDb());
  },
  get meta() {
    return createMetaRepo(getDb());
  },
  get food() {
    return createFoodRepo(getDb());
  },
  get exercises() {
    return createExerciseRepo(getDb());
  },
  get templates() {
    return createTemplateRepo(getDb());
  },
  get workouts() {
    return createWorkoutRepo(getDb());
  },
  get sets() {
    return createSetRepo(getDb());
  },
  get checkIns() {
    return createCheckInRepo(getDb());
  },
  get foods() {
    return createFoodCatalogRepo(getDb());
  },
  get mealTemplates() {
    return createMealTemplateRepo(getDb());
  },
  get water() {
    return createWaterRepo(getDb());
  },
  get programs() {
    return createProgramRepo(getDb());
  },
  get programVersions() {
    return createProgramVersionRepo(getDb());
  },
  get recipes() {
    return createRecipeRepo(getDb());
  },
  get recipePhotos() {
    return createRecipePhotoRepo(getDb());
  },
  get mealPlans() {
    return createMealPlanRepo(getDb());
  },
  get shoppingLists() {
    return createShoppingListRepo(getDb());
  },
  get prices() {
    return createPriceRepo(getDb());
  },
  get targetChanges() {
    return createTargetChangeRepo(getDb());
  },
  get moodLogs() {
    return createMoodLogRepo(getDb());
  },
  get mindSessions() {
    return createMindSessionRepo(getDb());
  },
  get measurements() {
    return createMeasurementRepo(getDb());
  },
  get bodyPhotos() {
    return createBodyPhotoRepo(getDb());
  },
  get pains() {
    return createPainRepo(getDb());
  },
  get weekNotes() {
    return createWeekNoteRepo(getDb());
  },
  get pulseDays() {
    return createPulseDayRepo(getDb());
  },
};

/** Journal PULSE d'un jour : `null` si rien n'est enregistré, `undefined` pendant le chargement. */
export function usePulseDay(date: string): PulseDay | null | undefined {
  return useLiveQuery(() => repos.pulseDays.byDate(date), [date]);
}

/** Journal PULSE complet, du plus ancien au plus récent. */
export function usePulseDays(): PulseDay[] | undefined {
  return useLiveQuery(async () => (await repos.pulseDays.listActive()).sort((a, b) => a.date.localeCompare(b.date)), []);
}

/** Notes de semaine des bilans, la plus récente d'abord. */
export function useWeekNotes(): WeekNote[] | undefined {
  return useLiveQuery(async () => (await repos.weekNotes.listActive()).sort((a, b) => b.weekStart.localeCompare(a.weekStart)), []);
}

/** Mensurations, de la plus ancienne à la plus récente. */
export function useMeasurements(): Measurement[] | undefined {
  return useLiveQuery(async () => (await repos.measurements.listActive()).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)), []);
}

/** Photos du corps, de la plus récente à la plus ancienne. */
export function useBodyPhotos(): BodyPhoto[] | undefined {
  return useLiveQuery(async () => (await repos.bodyPhotos.listActive()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), []);
}

/** Douleurs suivies, la plus récemment commencée d'abord. */
export function usePains(): Pain[] | undefined {
  return useLiveQuery(async () => (await repos.pains.listActive()).sort((a, b) => b.startedOn.localeCompare(a.startedOn)), []);
}

/** Journal émotionnel, du plus ancien au plus récent. */
export function useMoodLogs(): MoodLog[] | undefined {
  return useLiveQuery(async () => (await repos.moodLogs.listActive()).sort((a, b) => a.date.localeCompare(b.date)), []);
}

/** Pratiques Mind, de la plus récente à la plus ancienne. */
export function useMindSessions(): MindSession[] | undefined {
  return useLiveQuery(async () => (await repos.mindSessions.listActive()).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)), []);
}

export function useTargetChanges(): TargetChange[] | undefined {
  return useLiveQuery(async () => (await repos.targetChanges.listActive()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), []);
}

export function useRecipeRecords(): RecipeRecord[] | undefined {
  return useLiveQuery(() => repos.recipes.listActive(), []);
}

export function useRecipePhotos(): RecipePhoto[] | undefined {
  return useLiveQuery(() => repos.recipePhotos.listActive(), []);
}

export function useMealPlans(): MealPlan[] | undefined {
  return useLiveQuery(() => repos.mealPlans.listActive(), []);
}

export function useShoppingLists(): ShoppingList[] | undefined {
  return useLiveQuery(async () => (await repos.shoppingLists.listActive()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), []);
}

export function usePrices(): PriceRecord[] | undefined {
  return useLiveQuery(() => repos.prices.listActive(), []);
}

export function usePrograms(): Program[] | undefined {
  return useLiveQuery(async () => (await repos.programs.listActive()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), []);
}

/** Versions d'un programme, de la première à la plus récente. */
export function useProgramVersions(programId: string | null | undefined): ProgramVersion[] | undefined {
  return useLiveQuery(async () => (programId ? repos.programVersions.list(programId) : []), [programId]);
}

/** Toutes les séances-types, tous programmes confondus. */
export function useAllTemplates(): WorkoutTemplate[] | undefined {
  return useLiveQuery(async () => (await repos.templates.listActive()).sort((a, b) => a.position - b.position), []);
}

export function useFoods(): Food[] | undefined {
  return useLiveQuery(() => repos.foods.listActive(), []);
}

export function useMealTemplates(): MealTemplate[] | undefined {
  return useLiveQuery(async () => (await repos.mealTemplates.listActive()).sort((a, b) => a.name.localeCompare(b.name, 'fr')), []);
}

export function useWaterLogs(): WaterLog[] | undefined {
  return useLiveQuery(() => repos.water.listActive(), []);
}

export function useFoodEntries(): FoodEntry[] | undefined {
  return useLiveQuery(() => repos.food.listActive(), []);
}

export function useExercises(): Exercise[] | undefined {
  return useLiveQuery(() => repos.exercises.listActive(), []);
}

/** Les séances du programme actif. */
export function useTemplates(): WorkoutTemplate[] | undefined {
  return useLiveQuery(async () => programTemplates(await repos.templates.listActive(), await repos.programs.listActive()), []);
}

export function useWorkouts(): Workout[] | undefined {
  return useLiveQuery(() => repos.workouts.listActive(), []);
}

export function useWorkoutSets(): WorkoutSet[] | undefined {
  return useLiveQuery(() => repos.sets.listActive(), []);
}

export function useCheckIns(): CheckIn[] | undefined {
  return useLiveQuery(async () => (await repos.checkIns.listActive()).sort((a, b) => a.date.localeCompare(b.date)), []);
}

export function useWeighIns(): WeighIn[] | undefined {
  return useLiveQuery(() => repos.weighIns.listActive(), []);
}

export function useProfile(): Profile | undefined {
  return useLiveQuery(() => repos.profile.get(), []);
}

/** Valeur d'un réglage : `null` si absente, `undefined` pendant le chargement. */
export function useMeta<T>(key: string): T | null | undefined {
  return useLiveQuery(() => repos.meta.get<T>(key), [key]);
}

/** Échelle d'effort choisie dans Réglages : RIR par défaut. */
export function useEffortScale(): EffortScale {
  const value = useMeta<EffortScale>(EFFORT_SCALE_KEY);
  return isEffortScale(value) ? value : 'rir';
}

/** Le jour local, mis à jour au retour dans l'app et à minuit. */
export function useToday(): string {
  const [today, setToday] = useState(() => toLocalDateKey(new Date()));
  useEffect(() => {
    const refresh = () => setToday(toLocalDateKey(new Date()));
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return today;
}

/** État local des séances audio (reprise, favoris), par identifiant. */
export function useAudioStates(): Map<string, AudioState> | undefined {
  return useLiveQuery(async () => new Map((await getDb().audioStates.toArray()).map((s) => [s.id, s])), []);
}

/** Séances téléchargées sur l'appareil : identifiant, version et taille. */
export function useAudioDownloads(): Map<string, { version: string; size: number }> | undefined {
  return useLiveQuery(async () => {
    const out = new Map<string, { version: string; size: number }>();
    await getDb().audioDownloads.each((d) => void out.set(d.id, { version: d.version, size: d.size }));
    return out;
  }, []);
}
