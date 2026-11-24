import type {
  CheckIn,
  FoodEntry,
  MealPlan,
  Measurement,
  MindSession,
  MoodLog,
  NutritionTargets,
  Pain,
  PainLog,
  TargetChange,
  WaterLog,
  WeighIn,
  Workout,
  WorkoutSet,
  WorkoutTemplate,
} from '../db/types';
import { setVolume } from './training';

/**
 * Toutes les données de FORGE rangées jour par jour : la base commune des bilans,
 * du calendrier, des analyses croisées et des badges. Fonctions pures, sans accès à la base.
 */
export interface LifeData {
  workouts: readonly Workout[];
  sets: readonly WorkoutSet[];
  /** Séances du programme actif (jours prévus). */
  templates: readonly WorkoutTemplate[];
  foodEntries: readonly FoodEntry[];
  waterLogs: readonly WaterLog[];
  /** Objectifs actuels et leur historique (pour lire l'objectif en vigueur à une date passée). */
  targets: NutritionTargets | null;
  targetChanges: readonly TargetChange[];
  weighIns: readonly WeighIn[];
  measurements: readonly Measurement[];
  checkIns: readonly CheckIn[];
  moodLogs: readonly MoodLog[];
  mindSessions: readonly MindSession[];
  pains: readonly Pain[];
  mealPlans: readonly MealPlan[];
  exerciseName: (id: string) => string;
  recipeName: (key: string) => string;
}

export interface DayWorkout {
  workout: Workout;
  setCount: number;
  volumeKg: number;
}

export interface DayRecord {
  date: string;
  /** Séances terminées. */
  workouts: DayWorkout[];
  food: { entries: number; kcal: number; proteinG: number; costEur: number; costKnown: number };
  waterMl: number;
  weighIns: WeighIn[];
  measurement: Measurement | null;
  checkIn: CheckIn | null;
  mood: MoodLog | null;
  mind: MindSession[];
  painLogs: { pain: Pain; log: PainLog }[];
  /** Repas prévus dans le planning Kitchen (pas encore mangés). */
  plans: MealPlan[];
}

const alive = <T extends { deletedAt?: string | null }>(rows: readonly T[]) => rows.filter((r) => !r.deletedAt);

export function emptyDay(date: string): DayRecord {
  return {
    date,
    workouts: [],
    food: { entries: 0, kcal: 0, proteinG: 0, costEur: 0, costKnown: 0 },
    waterMl: 0,
    weighIns: [],
    measurement: null,
    checkIn: null,
    mood: null,
    mind: [],
    painLogs: [],
    plans: [],
  };
}

export type DayIndex = Map<string, DayRecord>;

export function buildDayIndex(data: LifeData): DayIndex {
  const index: DayIndex = new Map();
  const day = (date: string) => {
    let d = index.get(date);
    if (!d) index.set(date, (d = emptyDay(date)));
    return d;
  };
  const setsOf = new Map<string, WorkoutSet[]>();
  for (const s of alive(data.sets)) setsOf.set(s.workoutId, [...(setsOf.get(s.workoutId) ?? []), s]);
  for (const w of alive(data.workouts)) {
    if (!w.endedAt) continue;
    const sets = setsOf.get(w.id) ?? [];
    day(w.date).workouts.push({ workout: w, setCount: sets.length, volumeKg: Math.round(sets.reduce((n, s) => n + setVolume(s), 0)) });
  }
  for (const e of alive(data.foodEntries)) {
    const f = day(e.date).food;
    f.entries++;
    f.kcal += e.kcal;
    f.proteinG += e.proteinG;
    if (typeof e.costEur === 'number') {
      f.costEur += e.costEur;
      f.costKnown++;
    }
  }
  for (const w of alive(data.waterLogs)) day(w.date).waterMl += w.ml;
  for (const w of alive(data.weighIns)) day(w.date).weighIns.push(w);
  for (const m of alive(data.measurements)) day(m.date).measurement = m;
  for (const c of alive(data.checkIns)) day(c.date).checkIn = c;
  for (const m of alive(data.moodLogs)) day(m.date).mood = m;
  for (const s of alive(data.mindSessions)) day(s.date).mind.push(s);
  for (const p of alive(data.pains)) for (const log of p.logs) day(log.date).painLogs.push({ pain: p, log });
  for (const p of alive(data.mealPlans)) if (p.status === 'planned') day(p.date).plans.push(p);
  for (const d of index.values()) {
    d.workouts.sort((a, b) => a.workout.startedAt.localeCompare(b.workout.startedAt));
    d.weighIns.sort((a, b) => a.time.localeCompare(b.time));
    d.mind.sort((a, b) => a.time.localeCompare(b.time));
  }
  return index;
}

/** Un jour actif : au moins une donnée notée (un repas prévu ne compte pas). */
export function isActiveDay(d: DayRecord | undefined): boolean {
  if (!d) return false;
  return (
    d.workouts.length > 0 ||
    d.food.entries > 0 ||
    d.waterMl > 0 ||
    d.weighIns.length > 0 ||
    !!d.measurement ||
    !!d.checkIn ||
    !!d.mood ||
    d.mind.length > 0 ||
    d.painLogs.length > 0
  );
}

/** Pesée de référence du jour : la première (le matin, à jeun le plus souvent). */
export function dayWeight(d: DayRecord | undefined): number | null {
  return d?.weighIns[0]?.weightKg ?? null;
}

/** Objectifs nutritionnels en vigueur à une date, d'après l'historique des changements. */
export function targetsAt(current: NutritionTargets | null, changes: readonly TargetChange[], date: string): NutritionTargets | null {
  const list = alive(changes).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const before = list.filter((c) => c.date <= date).at(-1);
  if (before) return before.after;
  const after = list.find((c) => c.date > date);
  if (after) return after.before;
  return current;
}

export const mean = (values: readonly number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
