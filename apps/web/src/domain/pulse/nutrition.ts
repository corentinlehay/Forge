import type { GainRate, NutritionKind, NutritionTargets, WeighIn } from '../../db/types';
import { addDays } from '../../lib/dates';
import { formatNumber, formatSignedKg } from '../../lib/format';
import { targetsAt, type DayIndex, type LifeData } from '../lifeIndex';
import { bmi } from '../plan';
import { summarizeWeight } from '../weight';
import type { PulseSettings } from './settings';

/**
 * Nutrition Status : cohérence des apports récents avec les objectifs, séparée du Readiness Score.
 * Les repas d'aujourd'hui ne comptent pas (la journée n'est pas finie) : on regarde les 3 derniers jours notés.
 */
export interface NutritionStatus {
  kind: NutritionKind;
  label: string;
  /** Cohérence sur 100 : calories 40 %, protéines 40 %, régularité de la saisie 20 %. */
  score: number | null;
  lines: string[];
  targets: NutritionTargets | null;
  avgKcal: number | null;
  avgProteinG: number | null;
  daysLogged7: number;
  /** Jours notés consécutifs, jusqu'à hier, sous le seuil d'apport bas. */
  lowIntakeStreak: number;
  /** IMC sous 18,5 : aucun déficit n'est proposé. */
  lowWeight: boolean;
  proteinLow: boolean;
}

export const NUTRITION_LABELS: Record<NutritionKind, string> = {
  coherent: 'Cohérent avec tes objectifs',
  sous: 'Sous tes objectifs',
  'au-dessus': 'Au-dessus de tes objectifs',
  incomplet: 'Pas assez de repas notés',
  'sans-objectif': 'Pas d’objectif défini',
};

export interface NutritionInput {
  date: string;
  index: DayIndex;
  data: Pick<LifeData, 'targets' | 'targetChanges'>;
  weighIns: readonly WeighIn[];
  heightCm?: number;
  gainRate: GainRate;
  settings: PulseSettings;
}

const n0 = (v: number) => formatNumber(v, 0);

export function computeNutritionStatus({ date, index, data, weighIns, heightCm, gainRate, settings }: NutritionInput): NutritionStatus {
  const yesterday = addDays(date, -1);
  const targets = targetsAt(data.targets, data.targetChanges, yesterday);
  const logged = (d: string) => (index.get(d)?.food.entries ?? 0) > 0;
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(date, -1 - i));
  const daysLogged7 = last7.filter(logged).length;
  const recent = last7
    .slice(0, 3)
    .filter(logged)
    .map((d) => index.get(d)!.food);
  const avgKcal = recent.length ? recent.reduce((n, f) => n + f.kcal, 0) / recent.length : null;
  const avgProteinG = recent.length ? recent.reduce((n, f) => n + f.proteinG, 0) / recent.length : null;

  const latest = [...weighIns]
    .filter((w) => !w.deletedAt && w.date <= date)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .at(-1);
  const lowWeight = !!(latest && heightCm && bmi(latest.weightKg, heightCm) < 18.5);

  let lowIntakeStreak = 0;
  if (targets) {
    for (const d of last7) {
      const f = index.get(d)?.food;
      if (!f || f.entries === 0 || f.kcal >= (settings.lowIntakePct / 100) * targets.kcal) break;
      lowIntakeStreak++;
    }
  }

  const lines: string[] = [];
  const weight = summarizeWeight(
    weighIns.filter((w) => w.date <= date),
    gainRate,
  );
  const weightLine =
    weight.weeklyRateKg !== null && weight.band && !weight.calibrating
      ? `Poids tendance : ${formatSignedKg(Math.round(weight.weeklyRateKg * 100) / 100)} par semaine, pour une fourchette de ${formatSignedKg(weight.band.lowKgPerWeek).replace(' kg', '')} à ${formatSignedKg(weight.band.highKgPerWeek)}.`
      : null;

  const base = { targets, avgKcal, avgProteinG, daysLogged7, lowIntakeStreak, lowWeight };
  if (!targets) {
    return {
      ...base,
      kind: 'sans-objectif',
      label: NUTRITION_LABELS['sans-objectif'],
      score: null,
      lines: ['Définis tes objectifs dans Nutrition pour suivre la cohérence de tes apports.'],
      proteinLow: false,
    };
  }
  if (recent.length < 2) {
    return {
      ...base,
      kind: 'incomplet',
      label: NUTRITION_LABELS.incomplet,
      score: null,
      lines: [`${recent.length} jour noté sur les 3 derniers : il en faut au moins 2 pour juger tes apports.`, ...(weightLine ? [weightLine] : [])],
      proteinLow: false,
    };
  }
  const dev = (avgKcal! - targets.kcal) / targets.kcal;
  const tol = settings.kcalTolerancePct / 100;
  const kind: NutritionKind = dev < -tol ? 'sous' : dev > tol ? 'au-dessus' : 'coherent';
  const proteinRatio = avgProteinG! / targets.proteinG;
  const proteinLow = proteinRatio < settings.proteinMinPct / 100;
  const kcalScore = Math.max(0, 100 - Math.abs(dev) * 100 * 2.5);
  const proteinScore = Math.min(100, proteinRatio * 100);
  const regularity = (daysLogged7 / 7) * 100;
  lines.push(
    `Calories : ${n0(avgKcal!)} kcal par jour sur tes ${recent.length} derniers jours notés, pour ${n0(targets.kcal)} visées (${dev >= 0 ? '+' : '−'}${n0(Math.abs(dev) * 100)} %).`,
    `Protéines : ${n0(avgProteinG!)} g par jour, pour ${n0(targets.proteinG)} g visés.`,
    `Repas notés ${daysLogged7} jours sur les 7 derniers.`,
  );
  if (lowIntakeStreak >= 3) lines.push(`Apport sous ${settings.lowIntakePct} % de ton objectif depuis ${lowIntakeStreak} jours.`);
  if (weightLine) lines.push(weightLine);
  return { ...base, kind, label: NUTRITION_LABELS[kind], score: Math.round(0.4 * kcalScore + 0.4 * proteinScore + 0.2 * regularity), lines, proteinLow };
}
