import type { GainRate, WeighIn } from '../db/types';
import { addDays, daysBetween } from '../lib/dates';

/**
 * Logique du poids : une valeur par jour, poids tendance lissé, rythme de prise
 * et position par rapport à la fourchette visée. Fonctions pures, sans React ni base.
 */

/** Lissage exponentiel de 10 % par jour : gomme l'eau, le sel et le transit. */
export const TREND_ALPHA = 0.1;
/** Fenêtre de calcul du rythme : les 14 derniers jours de tendance. */
export const RATE_WINDOW_DAYS = 14;
/** En dessous de 7 jours de série, le rythme n'est pas calculé. */
export const MIN_DAYS_FOR_RATE = 7;
/** Pendant les 14 premiers jours mesurés, la tendance est « en calibrage ». */
export const CALIBRATION_DAYS = 14;

export interface DailyWeight {
  date: string;
  weightKg: number;
  /** false pour un jour sans pesée, comblé par interpolation. */
  measured: boolean;
}

export interface TrendPoint extends DailyWeight {
  trendKg: number;
}

export type WeighInLike = Pick<WeighIn, 'date' | 'time' | 'weightKg'> & { deletedAt?: string | null };

/** Une valeur par jour : la première pesée de la journée (protocole conseillé : au réveil, à jeun). */
export function toDailyWeights(weighIns: readonly WeighInLike[]): DailyWeight[] {
  const firstOfDay = new Map<string, WeighInLike>();
  for (const w of weighIns) {
    if (w.deletedAt) continue;
    const current = firstOfDay.get(w.date);
    if (!current || w.time < current.time) firstOfDay.set(w.date, w);
  }
  return [...firstOfDay.values()]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((w) => ({ date: w.date, weightKg: w.weightKg, measured: true }));
}

/** Comble les jours sans pesée par interpolation linéaire, pour obtenir une série continue. */
export function fillGaps(daily: readonly DailyWeight[]): DailyWeight[] {
  const out: DailyWeight[] = [];
  for (let i = 0; i < daily.length; i++) {
    const current = daily[i]!;
    out.push(current);
    const next = daily[i + 1];
    if (!next) break;
    const gap = daysBetween(current.date, next.date);
    for (let d = 1; d < gap; d++) {
      const t = d / gap;
      out.push({
        date: addDays(current.date, d),
        weightKg: current.weightKg + t * (next.weightKg - current.weightKg),
        measured: false,
      });
    }
  }
  return out;
}

/** Poids tendance jour par jour (moyenne mobile exponentielle sur la série continue). */
export function computeTrend(daily: readonly DailyWeight[], alpha = TREND_ALPHA): TrendPoint[] {
  const out: TrendPoint[] = [];
  let trend: number | null = null;
  for (const day of fillGaps(daily)) {
    trend = trend === null ? day.weightKg : trend + alpha * (day.weightKg - trend);
    out.push({ ...day, trendKg: trend });
  }
  return out;
}

/** Pente de la tendance sur la fenêtre récente, en kg par semaine (régression linéaire). */
export function weeklyRateKg(points: readonly TrendPoint[], windowDays = RATE_WINDOW_DAYS): number | null {
  if (points.length < MIN_DAYS_FOR_RATE) return null;
  const window = points.slice(-windowDays);
  const n = window.length;
  const meanX = (n - 1) / 2;
  const meanY = window.reduce((sum, p) => sum + p.trendKg, 0) / n;
  let num = 0;
  let den = 0;
  window.forEach((p, x) => {
    num += (x - meanX) * (p.trendKg - meanY);
    den += (x - meanX) ** 2;
  });
  return den === 0 ? 0 : (num / den) * 7;
}

export interface GainBand {
  lowKgPerWeek: number;
  highKgPerWeek: number;
}

/** Fourchette de prise en kg par semaine, à partir du poids tendance et des % visés. */
export function gainBandKg(trendKg: number, rate: GainRate): GainBand {
  return {
    lowKgPerWeek: (trendKg * rate.lowPctPerWeek) / 100,
    highKgPerWeek: (trendKg * rate.highPctPerWeek) / 100,
  };
}

export type GainStatus = 'insufficient_data' | 'below' | 'within' | 'above';

export function gainStatus(rate: number | null, band: GainBand): GainStatus {
  if (rate === null) return 'insufficient_data';
  if (rate < band.lowKgPerWeek) return 'below';
  if (rate > band.highKgPerWeek) return 'above';
  return 'within';
}

export interface WeightSummary {
  points: TrendPoint[];
  latestTrendKg: number | null;
  latestMeasured: DailyWeight | null;
  weeklyRateKg: number | null;
  band: GainBand | null;
  status: GainStatus;
  /** Vrai tant qu'il y a moins de 14 jours mesurés : la tendance se stabilise. */
  calibrating: boolean;
}

export function summarizeWeight(weighIns: readonly WeighInLike[], gainRate: GainRate): WeightSummary {
  const daily = toDailyWeights(weighIns);
  const points = computeTrend(daily);
  const last = points.at(-1);
  if (!last) {
    return { points, latestTrendKg: null, latestMeasured: null, weeklyRateKg: null, band: null, status: 'insufficient_data', calibrating: true };
  }
  const rate = weeklyRateKg(points);
  const band = gainBandKg(last.trendKg, gainRate);
  return {
    points,
    latestTrendKg: last.trendKg,
    latestMeasured: daily.at(-1) ?? null,
    weeklyRateKg: rate,
    band,
    status: gainStatus(rate, band),
    calibrating: daily.length < CALIBRATION_DAYS,
  };
}

/**
 * Moyenne des pesées des 7 derniers jours (aujourd'hui compris), une valeur par jour.
 * Null s'il n'y a aucune pesée sur la période.
 */
export function average7Days(weighIns: readonly WeighInLike[], today: string): { averageKg: number; days: number } | null {
  const start = addDays(today, -6);
  const days = toDailyWeights(weighIns).filter((d) => d.date >= start && d.date <= today);
  if (!days.length) return null;
  return { averageKg: days.reduce((s, d) => s + d.weightKg, 0) / days.length, days: days.length };
}
