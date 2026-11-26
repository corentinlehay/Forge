import { useMemo } from 'react';
import {
  useActivities,
  useAllProgramVersions,
  useAllTemplates,
  useCheckIns,
  useExercises,
  useFoodEntries,
  useMindSessions,
  useProfile,
  usePrograms,
  usePulseDays,
  useTargetChanges,
  useToday,
  useWeekNotes,
  useWorkouts,
  useWorkoutSets,
} from '../../db/hooks';
import { buildCatalog, catalogItem } from '../../domain/exerciseCatalog';
import { computeLevel, type LevelState } from '../../domain/level/level';
import type { MuscleResolver } from '../../domain/muscleVolume';
import { PRIORITY_MUSCLES } from '../../domain/plan';

function resolverFor(exercises: NonNullable<ReturnType<typeof useExercises>>): MuscleResolver {
  const catalog = buildCatalog(exercises);
  return (id) => {
    const item = catalogItem(catalog, id);
    return item ? { muscle: item.muscle, secondary: item.secondary } : null;
  };
}

/** Le muscle de chaque exercice, pour les calculs de volume de FORGE LEVEL. */
export function useLevelResolver(): MuscleResolver | undefined {
  const exercises = useExercises();
  return useMemo(() => (exercises ? resolverFor(exercises) : undefined), [exercises]);
}

/** FORGE LEVEL calculé à partir de toutes les données enregistrées ; undefined pendant le chargement. */
export function useLevel(): LevelState | undefined {
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const exercises = useExercises();
  const templates = useAllTemplates();
  const programs = usePrograms();
  const versions = useAllProgramVersions();
  const pulseDays = usePulseDays();
  const mindSessions = useMindSessions();
  const activities = useActivities();
  const foodEntries = useFoodEntries();
  const profile = useProfile();
  const targetChanges = useTargetChanges();
  const weekNotes = useWeekNotes();
  const checkIns = useCheckIns();
  const today = useToday();
  return useMemo(() => {
    if (
      !workouts ||
      !sets ||
      !exercises ||
      !templates ||
      !programs ||
      !versions ||
      !pulseDays ||
      !mindSessions ||
      !activities ||
      !foodEntries ||
      profile === undefined ||
      !targetChanges ||
      !weekNotes ||
      !checkIns
    )
      return undefined;
    const resolve = resolverFor(exercises);
    return computeLevel(
      {
        workouts,
        sets,
        exercises,
        templates,
        programs,
        versions,
        pulseDays,
        mindSessions,
        activities,
        foodEntries,
        targets: profile?.nutritionTargets ?? null,
        targetChanges,
        weekNotes,
        checkIns,
        today,
      },
      resolve,
      PRIORITY_MUSCLES,
    );
  }, [workouts, sets, exercises, templates, programs, versions, pulseDays, mindSessions, activities, foodEntries, profile, targetChanges, weekNotes, checkIns, today]);
}
