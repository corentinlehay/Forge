import type { TemplateExercise, WorkoutSet } from '../db/types';

/**
 * Déroulé d'une séance en direct : quelle série vient ensuite, et combien de repos.
 */

export interface NextSet {
  exerciseId: string;
  /** Numéro de la série à faire (1, 2, 3…). */
  setNumber: number;
  /** Séries prévues (null : séance libre ou exercice ajouté). */
  plannedSets: number | null;
}

/**
 * La prochaine série : le premier exercice, dans l'ordre, qui n'a pas toutes ses séries prévues.
 * Sans objectif (séance libre), on continue l'exercice travaillé en dernier.
 * null : toutes les séries prévues sont faites.
 */
export function nextSet(order: readonly string[], sets: readonly WorkoutSet[], targets: readonly TemplateExercise[]): NextSet | null {
  const done = (id: string) => sets.filter((s) => s.exerciseId === id).length;
  const planned = (id: string) => targets.find((t) => t.exerciseId === id)?.sets ?? null;
  for (const id of order) {
    const p = planned(id);
    if (p !== null && done(id) < p) return { exerciseId: id, setNumber: done(id) + 1, plannedSets: p };
  }
  const unplanned = order.filter((id) => planned(id) === null);
  if (!unplanned.length) return null;
  const lastWorked = [...sets].sort((a, b) => a.position - b.position).at(-1)?.exerciseId;
  const id = lastWorked && unplanned.includes(lastWorked) ? lastWorked : unplanned.find((x) => done(x) === 0);
  return id ? { exerciseId: id, setNumber: done(id) + 1, plannedSets: null } : null;
}

export const DEFAULT_REST_SEC = 90;

export function restFor(exerciseId: string, targets: readonly TemplateExercise[], exerciseRest: number | null | undefined): number {
  return targets.find((t) => t.exerciseId === exerciseId)?.restSec ?? exerciseRest ?? DEFAULT_REST_SEC;
}

/** Secondes restantes (arrondi supérieur, jamais négatif). */
export function remainingSec(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** « 1 min 30 », « 2 min », « 45 s ». */
export function formatRest(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`;
}

/** Déplace un élément d'un cran (−1 : vers le haut, +1 : vers le bas). */
export function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
