import type { CheckIn } from '../db/types';
import { addDays } from '../lib/dates';

/**
 * Récupération estimée, de 0 à 100, à partir du check-in du jour :
 * sommeil (35 %, plein à 8 h), énergie (25 %), fatigue (20 %, inversée), courbatures (20 %, inversées).
 * Une réponse passée ne compte pas : les poids des autres sont répartis. Null sans aucune réponse.
 * C'est un repère, pas une mesure physiologique.
 */
export function recoveryScore(c: Pick<CheckIn, 'sleepHours' | 'energy' | 'fatigue' | 'soreness'>): number | null {
  const parts: [number, number][] = [];
  if (c.sleepHours !== null && c.sleepHours !== undefined) parts.push([0.35, Math.min(c.sleepHours / 8, 1)]);
  if (c.energy) parts.push([0.25, (c.energy - 1) / 4]);
  if (c.fatigue) parts.push([0.2, (5 - c.fatigue) / 4]);
  if (c.soreness) parts.push([0.2, (5 - c.soreness) / 4]);
  const weight = parts.reduce((n, [w]) => n + w, 0);
  if (!weight) return null;
  return Math.round((100 * parts.reduce((n, [w, v]) => n + w * v, 0)) / weight);
}

const hoursLabel = (h: number) => {
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')}`;
};

/** « 7 h 30, énergie 4/5, fatigue 2/5 » : seules les réponses données. */
export function checkInSummary(c: Pick<CheckIn, 'sleepHours' | 'energy' | 'fatigue' | 'soreness'>, withSoreness = true): string {
  const parts = [
    c.sleepHours !== null && c.sleepHours !== undefined ? hoursLabel(c.sleepHours) : null,
    c.energy ? `énergie ${c.energy}/5` : null,
    c.fatigue ? `fatigue ${c.fatigue}/5` : null,
    withSoreness && c.soreness ? `courbatures ${c.soreness}/5` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'questions passées';
}

/** Le check-in a-t-il au moins une réponse ? */
export const hasAnswer = (c: Pick<CheckIn, 'sleepHours' | 'energy' | 'fatigue' | 'soreness'>) =>
  c.sleepHours !== null || c.energy !== null || c.fatigue !== null || c.soreness !== null;

export function recoveryLabel(score: number): string {
  if (score >= 75) return 'Bonne';
  if (score >= 50) return 'Correcte';
  return 'Basse';
}

export function checkInFor(checkIns: readonly CheckIn[], date: string): CheckIn | null {
  return checkIns.find((c) => !c.deletedAt && c.date === date) ?? null;
}

export interface WellbeingAverage {
  sleepHours: number | null;
  energy: number | null;
  fatigue: number | null;
  score: number | null;
  count: number;
}

/** Moyennes des check-ins sur les `days` derniers jours ; null s'il n'y en a aucun. */
export function averageCheckIns(checkIns: readonly CheckIn[], endDate: string, days = 7): WellbeingAverage | null {
  const start = addDays(endDate, -(days - 1));
  const list = checkIns.filter((c) => !c.deletedAt && c.date >= start && c.date <= endDate);
  if (!list.length) return null;
  /** Moyenne des réponses données (une question passée ne compte pas). */
  const avg = (f: (c: CheckIn) => number | null | undefined) => {
    const values = list.map(f).filter((v): v is number => typeof v === 'number');
    return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
  };
  const score = avg(recoveryScore);
  return {
    sleepHours: avg((c) => c.sleepHours),
    energy: avg((c) => c.energy),
    fatigue: avg((c) => c.fatigue),
    score: score === null ? null : Math.round(score),
    count: list.length,
  };
}
