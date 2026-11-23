import type { CheckIn } from '../db/types';
import { addDays } from '../lib/dates';

/**
 * Récupération estimée, de 0 à 100, à partir du check-in du jour :
 * sommeil (35 %, plein à 8 h), énergie (25 %), fatigue (20 %, inversée), courbatures (20 %, inversées).
 * C'est un repère, pas une mesure physiologique.
 */
export function recoveryScore(c: Pick<CheckIn, 'sleepHours' | 'energy' | 'fatigue' | 'soreness'>): number {
  const sleep = Math.min(c.sleepHours / 8, 1);
  const energy = (c.energy - 1) / 4;
  const fatigue = (5 - c.fatigue) / 4;
  const soreness = (5 - c.soreness) / 4;
  return Math.round(100 * (0.35 * sleep + 0.25 * energy + 0.2 * fatigue + 0.2 * soreness));
}

export function recoveryLabel(score: number): string {
  if (score >= 75) return 'Bonne';
  if (score >= 50) return 'Correcte';
  return 'Basse';
}

export function checkInFor(checkIns: readonly CheckIn[], date: string): CheckIn | null {
  return checkIns.find((c) => !c.deletedAt && c.date === date) ?? null;
}

export interface WellbeingAverage {
  sleepHours: number;
  energy: number;
  fatigue: number;
  score: number;
  count: number;
}

/** Moyennes des check-ins sur les `days` derniers jours ; null s'il n'y en a aucun. */
export function averageCheckIns(checkIns: readonly CheckIn[], endDate: string, days = 7): WellbeingAverage | null {
  const start = addDays(endDate, -(days - 1));
  const list = checkIns.filter((c) => !c.deletedAt && c.date >= start && c.date <= endDate);
  if (!list.length) return null;
  const avg = (f: (c: CheckIn) => number) => list.reduce((s, c) => s + f(c), 0) / list.length;
  return {
    sleepHours: avg((c) => c.sleepHours),
    energy: avg((c) => c.energy),
    fatigue: avg((c) => c.fatigue),
    score: Math.round(avg(recoveryScore)),
    count: list.length,
  };
}
