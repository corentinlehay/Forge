import { useMemo } from 'react';
import { useCheckIns, useExercises, useFoodEntries, useProfile, useTemplates, useToday, useWaterLogs, useWeighIns, useWorkouts, useWorkoutSets } from '../../db/hooks';
import { DEFAULT_GAIN_RATE } from '../../db/repositories/profile';
import { buildDailyBrief } from '../../domain/coach';
import { dayNutrition, waterForDay } from '../../domain/nutrition';
import {
  completedWorkouts,
  findRecords,
  inProgressWorkout,
  lastPerformance,
  plannedPerWeek,
  plannedSoFar,
  sessionsInWeek,
  setsByWorkout,
  templateForDay,
  weeklyVolumes,
  workoutStats,
} from '../../domain/training';
import { average7Days, summarizeWeight } from '../../domain/weight';
import { averageCheckIns, checkInFor, recoveryScore } from '../../domain/wellbeing';

/**
 * Toutes les données du tableau de bord, calculées à partir de la base.
 * Chaque saisie met la base à jour ; les lectures réactives recalculent tout aussitôt.
 */
export function useDashboardData() {
  const today = useToday();
  const profile = useProfile();
  const weighIns = useWeighIns();
  const food = useFoodEntries();
  const exercises = useExercises();
  const templates = useTemplates();
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const checkIns = useCheckIns();
  const water = useWaterLogs();

  const loading = [profile, weighIns, food, exercises, templates, workouts, sets, checkIns, water].some((v) => v === undefined);

  return useMemo(() => {
    if (loading) return null;
    const gainRate = profile!.gainRate ?? DEFAULT_GAIN_RATE;
    const exerciseName = new Map(exercises!.map((e) => [e.id, e.name]));
    const nameOf = (id: string) => exerciseName.get(id) ?? 'Exercice';

    // Poids
    const weight = summarizeWeight(weighIns!, gainRate);
    const lastWeighIn = weighIns!.at(-1) ?? null;
    const weekAverage = average7Days(weighIns!, today);
    const weighedToday = weighIns!.find((w) => w.date === today) ?? null;

    // Nutrition
    const nutrition = dayNutrition(food!, today, profile!.nutritionTargets);
    const waterMl = waterForDay(water!, today);

    // Entraînement
    const grouped = setsByWorkout(sets!);
    const done = completedWorkouts(workouts!);
    const plannedToday = templateForDay(templates!, today);
    const inProgress = inProgressWorkout(workouts!);
    const doneTodayWorkout = done.find((w) => w.date === today) ?? null;
    const doneToday = doneTodayWorkout ? workoutStats(doneTodayWorkout, grouped.get(doneTodayWorkout.id) ?? []) : null;
    const lastWorkout = done[0] ? workoutStats(done[0], grouped.get(done[0].id) ?? []) : null;
    const weekSessions = sessionsInWeek(workouts!, today).length;
    const perWeek = plannedPerWeek(templates!);
    const volumes = weeklyVolumes(workouts!, sets!, today, 8);
    const records = findRecords(workouts!, sets!).map((r) => ({ ...r, exerciseName: nameOf(r.exerciseId) }));
    const toBeat = plannedToday?.exercises[0]
      ? { exerciseName: nameOf(plannedToday.exercises[0].exerciseId), performance: lastPerformance(plannedToday.exercises[0].exerciseId, workouts!, sets!) }
      : null;

    // Bien-être
    const todayCheckIn = checkInFor(checkIns!, today);
    const wellbeingToday = todayCheckIn ? { checkIn: todayCheckIn, score: recoveryScore(todayCheckIn) } : null;
    const wellbeingWeek = averageCheckIns(checkIns!, today, 7);

    const brief = buildDailyBrief({
      today,
      hour: new Date().getHours(),
      weight,
      lastWeighInDate: lastWeighIn?.date ?? null,
      nutrition,
      training: {
        plannedToday: plannedToday?.name ?? null,
        doneToday: doneToday ? { name: doneToday.workout.name, volumeKg: doneToday.volumeKg } : null,
        inProgress: Boolean(inProgress),
        sessionsThisWeek: weekSessions,
        plannedPerWeek: perWeek,
        plannedSoFar: plannedSoFar(templates!, today),
        recentRecords: records.slice(0, 5),
      },
      wellbeing: wellbeingToday ? { sleepHours: wellbeingToday.checkIn.sleepHours, score: wellbeingToday.score } : null,
    });

    return {
      today,
      profile: profile!,
      gainRate,
      weight,
      lastWeighIn,
      weighedToday,
      weekAverage,
      nutrition,
      waterMl,
      training: {
        plannedToday,
        inProgress,
        doneToday,
        lastWorkout,
        weekSessions,
        perWeek,
        volumes,
        records,
        toBeat,
        hasProgram: templates!.length > 0,
      },
      wellbeing: { today: wellbeingToday, week: wellbeingWeek },
      brief,
      nameOf,
    };
  }, [loading, today, profile, weighIns, food, exercises, templates, workouts, sets, checkIns, water]);
}

export type DashboardData = NonNullable<ReturnType<typeof useDashboardData>>;
