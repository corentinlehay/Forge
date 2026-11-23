import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { toLocalDateKey } from '../lib/dates';
import { getDb } from './schema';
import { createMetaRepo } from './repositories/meta';
import { createProfileRepo } from './repositories/profile';
import { createWeighInRepo } from './repositories/weighIns';
import { createCheckInRepo, createExerciseRepo, createFoodCatalogRepo, createFoodRepo, createMealTemplateRepo, createSetRepo, createTemplateRepo, createWaterRepo, createWorkoutRepo } from './repositories/entities';
import type { CheckIn, Exercise, Food, FoodEntry, MealTemplate, Profile, WaterLog, WeighIn, Workout, WorkoutSet, WorkoutTemplate } from './types';

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
};

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

export function useTemplates(): WorkoutTemplate[] | undefined {
  return useLiveQuery(async () => (await repos.templates.listActive()).sort((a, b) => a.position - b.position), []);
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
