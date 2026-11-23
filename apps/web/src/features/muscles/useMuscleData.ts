import { useMemo } from 'react';
import { useExercises, useToday, useWorkouts, useWorkoutSets } from '../../db/hooks';
import { buildCatalog, catalogItem, type CatalogItem } from '../../domain/exerciseCatalog';
import type { MuscleResolver } from '../../domain/muscleVolume';

/** Données communes aux écrans Muscles : séances, séries, catalogue et lecture des muscles de chaque exercice. */
export function useMuscleData() {
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const exercises = useExercises();
  const today = useToday();
  return useMemo(() => {
    if (!workouts || !sets || !exercises) return null;
    const catalog = buildCatalog(exercises);
    const cache = new Map<string, CatalogItem | undefined>();
    const itemOf = (exerciseId: string) => {
      if (!cache.has(exerciseId)) cache.set(exerciseId, catalogItem(catalog, exerciseId));
      return cache.get(exerciseId);
    };
    const resolve: MuscleResolver = (exerciseId) => {
      const item = itemOf(exerciseId);
      return item ? { muscle: item.muscle, secondary: item.secondary } : null;
    };
    return { workouts, sets, catalog, itemOf, resolve, today };
  }, [workouts, sets, exercises, today]);
}
