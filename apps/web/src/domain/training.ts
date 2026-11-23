import type { Workout, WorkoutSet, WorkoutTemplate } from '../db/types';
import { addDays } from '../lib/dates';

/**
 * Indicateurs d'entraînement, calculés à partir des séances et des séries enregistrées.
 * Volume = Σ charge × répétitions. 1RM estimé : formule d'Epley.
 */

/** Jour de la semaine ISO : 1 = lundi … 7 = dimanche. */
export function isoWeekday(dateKey: string): number {
  const d = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return ((d + 6) % 7) + 1;
}

/** Lundi de la semaine du jour donné. */
export function weekStart(dateKey: string): string {
  return addDays(dateKey, 1 - isoWeekday(dateKey));
}

export function setVolume(set: Pick<WorkoutSet, 'weightKg' | 'reps'>): number {
  return set.weightKg * set.reps;
}

/** 1RM estimé (Epley). Au-delà de 12 répétitions, l'estimation devient peu fiable mais reste comparable. */
export function e1rm(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30);
}

const byChrono = (a: Workout, b: Workout) => (a.date === b.date ? a.startedAt.localeCompare(b.startedAt) : a.date.localeCompare(b.date));

export function activeOnly<T extends { deletedAt?: string | null }>(rows: readonly T[]): T[] {
  return rows.filter((r) => !r.deletedAt);
}

export function setsByWorkout(sets: readonly WorkoutSet[]): Map<string, WorkoutSet[]> {
  const map = new Map<string, WorkoutSet[]>();
  for (const s of activeOnly(sets)) {
    const list = map.get(s.workoutId) ?? [];
    list.push(s);
    map.set(s.workoutId, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.position - b.position);
  return map;
}

export interface WorkoutStats {
  workout: Workout;
  setCount: number;
  exerciseCount: number;
  volumeKg: number;
}

export function workoutStats(workout: Workout, sets: readonly WorkoutSet[]): WorkoutStats {
  return {
    workout,
    setCount: sets.length,
    exerciseCount: new Set(sets.map((s) => s.exerciseId)).size,
    volumeKg: Math.round(sets.reduce((sum, s) => sum + setVolume(s), 0)),
  };
}

/** Séances terminées, de la plus récente à la plus ancienne. */
export function completedWorkouts(workouts: readonly Workout[]): Workout[] {
  return activeOnly(workouts)
    .filter((w) => w.endedAt)
    .sort((a, b) => byChrono(b, a));
}

export function inProgressWorkout(workouts: readonly Workout[]): Workout | null {
  return activeOnly(workouts).find((w) => !w.endedAt) ?? null;
}

/** Séance du programme prévue ce jour-là (la première dans l'ordre du programme). */
export function templateForDay(templates: readonly WorkoutTemplate[], dateKey: string): WorkoutTemplate | null {
  const day = isoWeekday(dateKey);
  return (
    activeOnly(templates)
      .filter((t) => t.weekdays.includes(day))
      .sort((a, b) => a.position - b.position)[0] ?? null
  );
}

/** Nombre de séances prévues par semaine dans le programme. */
export function plannedPerWeek(templates: readonly WorkoutTemplate[]): number {
  return activeOnly(templates).reduce((n, t) => n + t.weekdays.length, 0);
}

/** Séances prévues du lundi jusqu'au jour donné inclus. */
export function plannedSoFar(templates: readonly WorkoutTemplate[], dateKey: string): number {
  const day = isoWeekday(dateKey);
  return activeOnly(templates).reduce((n, t) => n + t.weekdays.filter((d) => d <= day).length, 0);
}

export function sessionsInWeek(workouts: readonly Workout[], dateKey: string): Workout[] {
  const start = weekStart(dateKey);
  const end = addDays(start, 6);
  return completedWorkouts(workouts).filter((w) => w.date >= start && w.date <= end);
}

export interface WeekVolume {
  weekStart: string;
  volumeKg: number;
  sessions: number;
}

/** Volume et nombre de séances terminées par semaine, de la plus ancienne à la semaine en cours. */
export function weeklyVolumes(workouts: readonly Workout[], sets: readonly WorkoutSet[], dateKey: string, weeks = 8): WeekVolume[] {
  const grouped = setsByWorkout(sets);
  const current = weekStart(dateKey);
  const out: WeekVolume[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(current, -7 * i);
    const end = addDays(start, 6);
    const inWeek = completedWorkouts(workouts).filter((w) => w.date >= start && w.date <= end);
    const volume = inWeek.reduce((sum, w) => sum + workoutStats(w, grouped.get(w.id) ?? []).volumeKg, 0);
    out.push({ weekStart: start, volumeKg: volume, sessions: inWeek.length });
  }
  return out;
}

export interface PersonalRecord {
  exerciseId: string;
  workoutId: string;
  date: string;
  weightKg: number;
  reps: number;
  e1rmKg: number;
  previousE1rmKg: number;
}

/**
 * Records : une séance bat le meilleur 1RM estimé de toutes les séances précédentes sur un exercice.
 * La toute première fois qu'un exercice est fait ne compte pas comme un record.
 * Résultat du plus récent au plus ancien.
 */
export function findRecords(workouts: readonly Workout[], sets: readonly WorkoutSet[]): PersonalRecord[] {
  const grouped = setsByWorkout(sets);
  const best = new Map<string, number>();
  const records: PersonalRecord[] = [];
  for (const w of activeOnly(workouts).sort(byChrono)) {
    const top = new Map<string, WorkoutSet>();
    for (const s of grouped.get(w.id) ?? []) {
      const current = top.get(s.exerciseId);
      if (!current || e1rm(s.weightKg, s.reps) > e1rm(current.weightKg, current.reps)) top.set(s.exerciseId, s);
    }
    for (const [exerciseId, s] of top) {
      const value = e1rm(s.weightKg, s.reps);
      const previous = best.get(exerciseId);
      if (previous !== undefined && value > previous + 1e-9) {
        records.push({ exerciseId, workoutId: w.id, date: w.date, weightKg: s.weightKg, reps: s.reps, e1rmKg: value, previousE1rmKg: previous });
      }
      if (previous === undefined || value > previous) best.set(exerciseId, value);
    }
  }
  return records.reverse();
}

/** Meilleur 1RM estimé sur un exercice, en excluant une séance (celle en cours). */
export function bestE1rm(exerciseId: string, workouts: readonly Workout[], sets: readonly WorkoutSet[], excludeWorkoutId?: string): number | null {
  const ids = new Set(activeOnly(workouts).filter((w) => w.id !== excludeWorkoutId).map((w) => w.id));
  let best: number | null = null;
  for (const s of activeOnly(sets)) {
    if (s.exerciseId !== exerciseId || !ids.has(s.workoutId)) continue;
    const v = e1rm(s.weightKg, s.reps);
    if (best === null || v > best) best = v;
  }
  return best;
}

export interface Performance {
  date: string;
  weightKg: number;
  reps: number;
  sets: number;
}

/** « À battre » : la meilleure série de la dernière séance où l'exercice a été fait (hors séance courante). */
export function lastPerformance(
  exerciseId: string,
  workouts: readonly Workout[],
  sets: readonly WorkoutSet[],
  excludeWorkoutId?: string,
): Performance | null {
  const grouped = setsByWorkout(sets);
  for (const w of activeOnly(workouts).filter((x) => x.id !== excludeWorkoutId).sort((a, b) => byChrono(b, a))) {
    const mine = (grouped.get(w.id) ?? []).filter((s) => s.exerciseId === exerciseId);
    if (!mine.length) continue;
    const top = mine.reduce((a, b) => (e1rm(b.weightKg, b.reps) > e1rm(a.weightKg, a.reps) ? b : a));
    return { date: w.date, weightKg: top.weightKg, reps: top.reps, sets: mine.length };
  }
  return null;
}
