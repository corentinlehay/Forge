import { MUSCLE_GROUPS, type MuscleGroup } from '../data/muscles';
import type { Workout, WorkoutSet } from '../db/types';
import { addDays } from '../lib/dates';
import { activeOnly, setsByWorkout, weekStart } from './training';

/**
 * Volume par groupe musculaire, en séries.
 * Comptage « fractionné » : une série compte 1 pour le muscle principal de l'exercice et 0,5 pour chaque muscle secondaire
 * (méthode qui prédit le mieux l'hypertrophie dans la méta-régression de Pelland et al., 2024).
 */

export interface MuscleTargets {
  muscle: MuscleGroup | null;
  secondary: MuscleGroup[];
}

/** Muscles d'un exercice (null : muscle principal pas encore précisé). */
export type MuscleResolver = (exerciseId: string) => MuscleTargets | null;

export interface MuscleWeek {
  muscle: MuscleGroup;
  directSets: number;
  indirectSets: number;
  /** Séries directes + 0,5 × séries indirectes. */
  fractional: number;
  /** Jours de la semaine où le muscle a reçu au moins une série directe. */
  days: number;
  /** Exercices qui ont travaillé ce muscle, avec leurs séries. */
  exercises: { exerciseId: string; sets: number; direct: boolean }[];
}

/** Repère : 10 séries par semaine et plus (Schoenfeld et al., 2017), au-delà de 20 les gains supplémentaires sont incertains. */
export const VOLUME_REFERENCE = { low: 10, high: 20 } as const;

function emptyWeek(muscle: MuscleGroup): MuscleWeek {
  return { muscle, directSets: 0, indirectSets: 0, fractional: 0, days: 0, exercises: [] };
}

/** Volume de chaque muscle entre deux dates incluses. */
export function muscleVolumeBetween(
  workouts: readonly Workout[],
  sets: readonly WorkoutSet[],
  resolve: MuscleResolver,
  from: string,
  to: string,
): { muscles: Record<MuscleGroup, MuscleWeek>; unknownExerciseIds: string[] } {
  const muscles = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, emptyWeek(m)])) as Record<MuscleGroup, MuscleWeek>;
  const days = new Map<MuscleGroup, Set<string>>();
  const unknown = new Set<string>();
  const grouped = setsByWorkout(sets);
  for (const w of activeOnly(workouts)) {
    if (w.date < from || w.date > to) continue;
    for (const s of grouped.get(w.id) ?? []) {
      const target = resolve(s.exerciseId);
      if (!target?.muscle) {
        unknown.add(s.exerciseId);
        continue;
      }
      const add = (m: MuscleGroup, direct: boolean) => {
        const entry = muscles[m];
        if (direct) entry.directSets += 1;
        else entry.indirectSets += 1;
        entry.fractional += direct ? 1 : 0.5;
        const ex = entry.exercises.find((e) => e.exerciseId === s.exerciseId);
        if (ex) ex.sets += 1;
        else entry.exercises.push({ exerciseId: s.exerciseId, sets: 1, direct });
      };
      add(target.muscle, true);
      const d = days.get(target.muscle) ?? new Set<string>();
      d.add(w.date);
      days.set(target.muscle, d);
      for (const m of new Set(target.secondary)) if (m !== target.muscle) add(m, false);
    }
  }
  for (const m of MUSCLE_GROUPS) {
    muscles[m].days = days.get(m)?.size ?? 0;
    muscles[m].exercises.sort((a, b) => Number(b.direct) - Number(a.direct) || b.sets - a.sets);
  }
  return { muscles, unknownExerciseIds: [...unknown] };
}

/** Volume de la semaine (lundi à dimanche) qui contient la date. */
export function muscleWeek(workouts: readonly Workout[], sets: readonly WorkoutSet[], resolve: MuscleResolver, dateKey: string) {
  const start = weekStart(dateKey);
  return muscleVolumeBetween(workouts, sets, resolve, start, addDays(start, 6));
}

/** Séries fractionnées d'un muscle, semaine par semaine, de la plus ancienne à la semaine en cours. */
export function muscleHistory(
  muscle: MuscleGroup,
  workouts: readonly Workout[],
  sets: readonly WorkoutSet[],
  resolve: MuscleResolver,
  dateKey: string,
  weeks = 12,
): { weekStart: string; fractional: number; directSets: number; indirectSets: number }[] {
  const current = weekStart(dateKey);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(current, -7 * (weeks - 1 - i));
    const m = muscleVolumeBetween(workouts, sets, resolve, start, addDays(start, 6)).muscles[muscle];
    return { weekStart: start, fractional: m.fractional, directSets: m.directSets, indirectSets: m.indirectSets };
  });
}

export type VolumeLevel = 0 | 1 | 2 | 3 | 4;

/** Paliers de couleur de la carte : 0, moins de 5, 5 à moins de 10, 10 à 20, plus de 20 séries. */
export function volumeLevel(fractional: number): VolumeLevel {
  if (fractional <= 0) return 0;
  if (fractional < 5) return 1;
  if (fractional < VOLUME_REFERENCE.low) return 2;
  if (fractional <= VOLUME_REFERENCE.high) return 3;
  return 4;
}

export function volumeStatus(fractional: number): { label: string; tone: 'good' | 'neutral' | 'alert' } {
  if (fractional <= 0) return { label: 'Pas travaillé', tone: 'neutral' };
  if (fractional < VOLUME_REFERENCE.low) return { label: 'Sous le repère', tone: 'neutral' };
  if (fractional <= VOLUME_REFERENCE.high) return { label: 'Dans le repère', tone: 'good' };
  return { label: 'Volume élevé', tone: 'neutral' };
}
