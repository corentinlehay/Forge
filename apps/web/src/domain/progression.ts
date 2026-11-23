import type { Workout, WorkoutSet } from '../db/types';
import { addDays, daysBetween } from '../lib/dates';
import { formatNumber } from '../lib/format';
import { activeOnly, e1rm, setsByWorkout, setVolume } from './training';

/**
 * Surcharge progressive : FORGE analyse les séances et PROPOSE l'objectif suivant.
 * Il ne modifie jamais une charge de lui-même.
 * Règle (double progression) : on ajoute des répétitions jusqu'au haut de la fourchette sur toutes les séries,
 * puis on augmente la charge et on repart du bas de la fourchette.
 */

export interface RepRange {
  min: number;
  max: number;
}

/** « 8-10 », « 8 à 10 », « 8–12 », « 10 » → fourchette. */
export function parseRepRange(text: string | undefined | null): RepRange | null {
  const nums = (text ?? '').match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return null;
  const min = nums[0]!;
  const max = nums[1] ?? min;
  return min >= 1 && max >= min && max <= 100 ? { min, max } : null;
}

export const rpeFromRir = (rir: number) => Math.max(0, 10 - rir);

export interface SessionPerf {
  workoutId: string;
  date: string;
  sets: WorkoutSet[];
  top: WorkoutSet;
  e1rmKg: number;
  volumeKg: number;
  maxReps: number;
  maxLoad: number;
}

/** Les séances où l'exercice a été fait, de la plus ancienne à la plus récente. */
export function exerciseSessions(exerciseId: string, workouts: readonly Workout[], sets: readonly WorkoutSet[], excludeWorkoutId?: string): SessionPerf[] {
  const grouped = setsByWorkout(sets);
  const out: SessionPerf[] = [];
  const list = activeOnly(workouts)
    .filter((w) => w.id !== excludeWorkoutId)
    .sort((a, b) => (a.date === b.date ? a.startedAt.localeCompare(b.startedAt) : a.date.localeCompare(b.date)));
  for (const w of list) {
    const mine = (grouped.get(w.id) ?? []).filter((s) => s.exerciseId === exerciseId);
    if (!mine.length) continue;
    const top = mine.reduce((a, b) => (e1rm(b.weightKg, b.reps) > e1rm(a.weightKg, a.reps) ? b : a));
    out.push({
      workoutId: w.id,
      date: w.date,
      sets: mine,
      top,
      e1rmKg: e1rm(top.weightKg, top.reps),
      volumeKg: Math.round(mine.reduce((s, x) => s + setVolume(x), 0)),
      maxReps: Math.max(...mine.map((x) => x.reps)),
      maxLoad: Math.max(...mine.map((x) => x.weightKg)),
    });
  }
  return out;
}

export interface Suggestion {
  weightKg: number;
  reps: number;
  reason: string;
}

const kg = (v: number) => `${formatNumber(v, v % 1 ? (Math.round(v * 100) % 10 ? 2 : 1) : 0)} kg`;

/** Pas de charge : 2,5 kg au-delà de 20 kg, 1 kg en dessous (haltères légers, élévations). */
export function loadIncrement(weightKg: number): number {
  return weightKg >= 20 ? 2.5 : 1;
}

/** Objectif proposé pour la prochaine séance d'un exercice, d'après la dernière séance. */
export function suggestNext(sessions: readonly SessionPerf[], range: RepRange | null): Suggestion | null {
  const last = sessions.at(-1);
  if (!last) return null;
  const load = last.maxLoad;
  const atLoad = last.sets.filter((s) => s.weightKg === load);
  const minReps = Math.min(...atLoad.map((s) => s.reps));
  const lastSet = last.sets.at(-1)!;
  const lastRir = lastSet.rir ?? null;

  if (load === 0) {
    return {
      weightKg: 0,
      reps: minReps + 1,
      reason: `Au poids du corps : vise ${minReps + 1} répétitions sur chaque série.`,
    };
  }
  if (range) {
    if (atLoad.every((s) => s.reps >= range.max) && (lastRir === null || lastRir >= 1)) {
      const next = load + loadIncrement(load);
      return {
        weightKg: next,
        reps: range.min,
        reason: `Toutes tes séries à ${kg(load)} ont atteint ${range.max} répétitions : passe à ${kg(next)} et vise ${range.min}.`,
      };
    }
    if (lastRir === 0 && minReps < range.min) {
      return {
        weightKg: load,
        reps: minReps,
        reason: `Dernière série à l’échec sous la fourchette : garde ${kg(load)} et consolide ${minReps} répétitions.`,
      };
    }
    const reps = Math.min(minReps + 1, range.max);
    return {
      weightKg: load,
      reps,
      reason: `Garde ${kg(load)} et vise ${reps} répétitions sur chaque série (fourchette ${range.min} à ${range.max}).`,
    };
  }
  return {
    weightKg: load,
    reps: minReps + 1,
    reason: `Garde ${kg(load)} et vise une répétition de plus : ${minReps + 1}.`,
  };
}

export type TrendKind = 'progression' | 'stagnation' | 'regression' | 'irregular' | 'insufficient';

export interface Trend {
  kind: TrendKind;
  text: string;
}

export const TREND_LABELS: Record<TrendKind, string> = {
  progression: 'Progression',
  stagnation: 'Stagnation',
  regression: 'Régression',
  irregular: 'Irrégulier',
  insufficient: 'À suivre',
};

/**
 * Tendance d'un exercice : meilleur 1RM estimé des 3 dernières séances comparé aux séances précédentes.
 * Irrégulier si plus de 14 jours séparent deux des 4 dernières séances.
 */
export function exerciseTrend(sessions: readonly SessionPerf[]): Trend {
  if (sessions.length < 3) {
    const missing = 3 - sessions.length;
    return {
      kind: 'insufficient',
      text: `Encore ${missing} séance${missing > 1 ? 's' : ''} pour dégager une tendance.`,
    };
  }
  const recent4 = sessions.slice(-4);
  const maxGap = Math.max(...recent4.slice(1).map((s, i) => daysBetween(recent4[i]!.date, s.date)));
  if (maxGap > 14)
    return {
      kind: 'irregular',
      text: `Jusqu’à ${maxGap} jours entre deux séances : la progression est difficile à juger.`,
    };

  const last3 = sessions.slice(-3);
  const before = sessions.slice(0, -3);
  const recent = Math.max(...last3.map((s) => s.e1rmKg));
  const previous = before.length ? Math.max(...before.map((s) => s.e1rmKg)) : last3[0]!.e1rmKg;
  const change = (recent - previous) / previous;
  const pct = `${formatNumber(Math.abs(change) * 100, 1)} %`;
  if (change > 0.01)
    return {
      kind: 'progression',
      text: `Force estimée en hausse de ${pct} sur les 3 dernières séances.`,
    };
  if (change < -0.03)
    return {
      kind: 'regression',
      text: `Force estimée en baisse de ${pct} : vérifie sommeil, apports et récupération.`,
    };
  return {
    kind: 'stagnation',
    text: 'Pas de progrès sur les 3 dernières séances : change une variable (répétitions, séries ou repos).',
  };
}

export interface ExerciseRecords {
  sessions: number;
  bestLoad: { weightKg: number; reps: number; date: string } | null;
  bestReps: { reps: number; weightKg: number; date: string } | null;
  bestE1rm: {
    valueKg: number;
    weightKg: number;
    reps: number;
    date: string;
  } | null;
  bestVolume: { volumeKg: number; date: string } | null;
}

/** Records d'un exercice depuis une date (null : depuis toujours). */
export function exerciseRecords(sessions: readonly SessionPerf[], sinceDate: string | null): ExerciseRecords {
  const list = sinceDate ? sessions.filter((s) => s.date >= sinceDate) : [...sessions];
  const out: ExerciseRecords = {
    sessions: list.length,
    bestLoad: null,
    bestReps: null,
    bestE1rm: null,
    bestVolume: null,
  };
  for (const s of list) {
    for (const set of s.sets) {
      if (!out.bestLoad || set.weightKg > out.bestLoad.weightKg || (set.weightKg === out.bestLoad.weightKg && set.reps > out.bestLoad.reps)) {
        out.bestLoad = { weightKg: set.weightKg, reps: set.reps, date: s.date };
      }
      if (!out.bestReps || set.reps > out.bestReps.reps || (set.reps === out.bestReps.reps && set.weightKg > out.bestReps.weightKg)) {
        out.bestReps = { reps: set.reps, weightKg: set.weightKg, date: s.date };
      }
    }
    if (!out.bestE1rm || s.e1rmKg > out.bestE1rm.valueKg)
      out.bestE1rm = {
        valueKg: s.e1rmKg,
        weightKg: s.top.weightKg,
        reps: s.top.reps,
        date: s.date,
      };
    if (!out.bestVolume || s.volumeKg > out.bestVolume.volumeKg) out.bestVolume = { volumeKg: s.volumeKg, date: s.date };
  }
  return out;
}

export function sinceForPeriod(today: string, days: 30 | 90 | 365 | null): string | null {
  return days === null ? null : addDays(today, -(days - 1));
}
