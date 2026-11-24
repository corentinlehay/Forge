import { useMemo } from 'react';
import {
  useCheckIns,
  useExercises,
  useFoodEntries,
  useMealPlans,
  useMeasurements,
  useMindSessions,
  useMoodLogs,
  usePains,
  useProfile,
  useRecipeRecords,
  useTargetChanges,
  useTemplates,
  useToday,
  useWaterLogs,
  useWeekNotes,
  useWeighIns,
  useWorkouts,
  useWorkoutSets,
} from '../../db/hooks';
import type { WeekNote } from '../../db/types';
import { BUILTIN_RECIPES } from '../../data/recipes';
import { buildDayIndex, type DayIndex, type LifeData } from '../../domain/lifeIndex';
import { badgeProgress, type BadgeProgress } from '../../domain/motivation';

export interface LifeModel {
  today: string;
  data: LifeData;
  index: DayIndex;
  badges: BadgeProgress[];
  notes: Map<string, WeekNote>;
}

/** Toutes les données des bilans, rangées jour par jour, recalculées à chaque saisie. */
export function useLifeData(): LifeModel | null {
  const today = useToday();
  const profile = useProfile();
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const exercises = useExercises();
  const templates = useTemplates();
  const foodEntries = useFoodEntries();
  const waterLogs = useWaterLogs();
  const targetChanges = useTargetChanges();
  const weighIns = useWeighIns();
  const measurements = useMeasurements();
  const checkIns = useCheckIns();
  const moodLogs = useMoodLogs();
  const mindSessions = useMindSessions();
  const pains = usePains();
  const mealPlans = useMealPlans();
  const records = useRecipeRecords();
  const notes = useWeekNotes();

  return useMemo(() => {
    const parts = [
      profile,
      workouts,
      sets,
      exercises,
      templates,
      foodEntries,
      waterLogs,
      targetChanges,
      weighIns,
      measurements,
      checkIns,
      moodLogs,
      mindSessions,
      pains,
      mealPlans,
      records,
      notes,
    ];
    if (parts.some((p) => p === undefined)) return null;
    const exerciseNames = new Map(exercises!.map((e) => [e.id, e.name]));
    const recipeNames = new Map<string, string>([...BUILTIN_RECIPES.map((r) => [r.id, r.name] as const), ...records!.map((r) => [r.id, r.name] as const)]);
    const data: LifeData = {
      workouts: workouts!,
      sets: sets!,
      templates: templates!,
      foodEntries: foodEntries!,
      waterLogs: waterLogs!,
      targets: profile?.nutritionTargets ?? null,
      targetChanges: targetChanges!,
      weighIns: weighIns!,
      measurements: measurements!,
      checkIns: checkIns!,
      moodLogs: moodLogs!,
      mindSessions: mindSessions!,
      pains: pains!,
      mealPlans: mealPlans!,
      exerciseName: (id) => exerciseNames.get(id) ?? 'Exercice',
      recipeName: (key) => recipeNames.get(key) ?? 'Recette',
    };
    const index = buildDayIndex(data);
    return { today, data, index, badges: badgeProgress(index, data, today), notes: new Map(notes!.map((n) => [n.weekStart, n])) };
  }, [
    today,
    profile,
    workouts,
    sets,
    exercises,
    templates,
    foodEntries,
    waterLogs,
    targetChanges,
    weighIns,
    measurements,
    checkIns,
    moodLogs,
    mindSessions,
    pains,
    mealPlans,
    records,
    notes,
  ]);
}
