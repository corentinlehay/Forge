import type { TemplateExercise, WorkoutAdjustment } from '../../db/types';

/** Version allégée proposée par défaut : une série de moins par exercice, 2 répétitions en réserve de plus. */
export const LIGHTEN: WorkoutAdjustment = { source: 'pulse', setsDelta: -1, rirDelta: 2 };

/** Bornes d'une version allégée modifiée à la main. */
export const ADJUST_BOUNDS = { setsLess: { min: 0, max: 2 }, rirMore: { min: 0, max: 3 } };

/** Objectifs d'une séance allégée : séries en moins (au moins une), répétitions en réserve en plus (5 au plus). */
export function adjustTargets(targets: readonly TemplateExercise[], adjustment: WorkoutAdjustment | null | undefined): TemplateExercise[] {
  if (!adjustment) return [...targets];
  return targets.map((t) => ({ ...t, sets: Math.max(1, t.sets + adjustment.setsDelta), rir: Math.min(5, (t.rir ?? 1) + adjustment.rirDelta) }));
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** « 1 série de moins par exercice, 2 répétitions en réserve de plus » ; null sans changement. */
export function describeAdjustment(a: WorkoutAdjustment | null | undefined): string | null {
  if (!a) return null;
  const parts = [
    a.setsDelta < 0 ? `${plural(-a.setsDelta, 'série')} de moins par exercice` : null,
    a.rirDelta > 0 ? `${plural(a.rirDelta, 'répétition')} en réserve de plus` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export interface Volume {
  sets: number;
  rirMin: number;
  rirMax: number;
}

export function volumeOf(targets: readonly TemplateExercise[]): Volume {
  const rirs = targets.map((t) => t.rir ?? 1);
  return { sets: targets.reduce((n, t) => n + t.sets, 0), rirMin: rirs.length ? Math.min(...rirs) : 1, rirMax: rirs.length ? Math.max(...rirs) : 1 };
}

/** « 24 séries, 1 à 2 répétitions en réserve ». */
export function volumeText(v: Volume): string {
  const rir = v.rirMin === v.rirMax ? `${v.rirMin}` : `${v.rirMin} à ${v.rirMax}`;
  return `${plural(v.sets, 'série')}, ${rir} répétition${v.rirMax > 1 ? 's' : ''} en réserve`;
}
