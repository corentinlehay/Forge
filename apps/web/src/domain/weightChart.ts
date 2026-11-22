import type { GainRate } from '../db/types';
import { addDays, daysBetween } from '../lib/dates';
import type { TrendPoint } from './weight';

/**
 * Modèle du graphique de poids : fenêtre affichée, échelle verticale et fourchette visée.
 * La fourchette part du poids tendance au début de la fenêtre et suit les % de prise par semaine.
 */

export type ChartPeriod = '1m' | '3m' | '1y' | 'all';

export const PERIOD_DAYS: Record<Exclude<ChartPeriod, 'all'>, number> = { '1m': 30, '3m': 91, '1y': 365 };

export interface BandPoint {
  date: string;
  lowKg: number;
  highKg: number;
}

export interface WeightChartModel {
  startDate: string;
  endDate: string;
  /** Nombre de jours entre le début et la fin (au moins 1). */
  spanDays: number;
  points: TrendPoint[];
  measuredCount: number;
  band: BandPoint[];
  yMin: number;
  yMax: number;
  ticks: number[];
  xLabels: string[];
}

const TICK_STEPS = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50];
/** Écart vertical minimal affiché, pour ne pas grossir des variations de quelques grammes. */
const MIN_SPAN_KG = 2;

export function niceTicks(min: number, max: number, target = 4): { min: number; max: number; ticks: number[] } {
  let lo = min;
  let hi = max;
  if (hi - lo < MIN_SPAN_KG) {
    const mid = (lo + hi) / 2;
    lo = mid - MIN_SPAN_KG / 2;
    hi = mid + MIN_SPAN_KG / 2;
  }
  const step = TICK_STEPS.find((s) => (hi - lo) / s <= target) ?? TICK_STEPS.at(-1)!;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 1000; v += step) ticks.push(Math.round(v * 100) / 100);
  return { min: start, max: end, ticks };
}

/** Fourchette visée, du poids tendance de départ jusqu'à la fin de la fenêtre, un point par jour. */
export function gainCone(startDate: string, startKg: number, endDate: string, rate: GainRate): BandPoint[] {
  const span = Math.max(0, daysBetween(startDate, endDate));
  const out: BandPoint[] = [];
  for (let d = 0; d <= span; d++) {
    const weeks = d / 7;
    out.push({
      date: addDays(startDate, d),
      lowKg: startKg * (1 + rate.lowPctPerWeek / 100) ** weeks,
      highKg: startKg * (1 + rate.highPctPerWeek / 100) ** weeks,
    });
  }
  return out;
}

export function buildWeightChart(
  all: readonly TrendPoint[],
  period: ChartPeriod,
  rate: GainRate,
  today: string,
): WeightChartModel | null {
  const first = all[0];
  const last = all.at(-1);
  if (!first || !last) return null;

  const endDate = last.date > today ? last.date : today;
  const wanted = period === 'all' ? first.date : addDays(endDate, -(PERIOD_DAYS[period] - 1));
  const startDate = wanted > first.date ? wanted : first.date;
  const points = all.filter((p) => p.date >= startDate);
  const measured = points.filter((p) => p.measured);

  const values = points.flatMap((p) => (p.measured ? [p.weightKg, p.trendKg] : [p.trendKg]));
  const scale = values.length ? niceTicks(Math.min(...values), Math.max(...values)) : niceTicks(last.trendKg, last.trendKg);
  const startPoint = points[0];
  const band = startPoint ? gainCone(startPoint.date, startPoint.trendKg, endDate, rate) : [];
  const spanDays = Math.max(1, daysBetween(startDate, endDate));

  return {
    startDate,
    endDate,
    spanDays,
    points,
    measuredCount: measured.length,
    band,
    yMin: scale.min,
    yMax: scale.max,
    ticks: scale.ticks,
    xLabels: [startDate, addDays(startDate, Math.round(spanDays / 2)), endDate],
  };
}

/** Le jour de la fenêtre le plus proche d'une position horizontale (0 à 1), pour l'inspection au doigt. */
export function nearestPoint(model: WeightChartModel, ratio: number): TrendPoint | null {
  if (!model.points.length) return null;
  const clamped = Math.min(1, Math.max(0, ratio));
  const target = addDays(model.startDate, Math.round(clamped * model.spanDays));
  let best = model.points[0]!;
  let bestGap = Math.abs(daysBetween(best.date, target));
  for (const p of model.points) {
    const gap = Math.abs(daysBetween(p.date, target));
    if (gap < bestGap) {
      best = p;
      bestGap = gap;
    }
  }
  return best;
}
