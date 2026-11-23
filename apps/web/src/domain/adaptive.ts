import type { FoodEntry, GainRate, NutritionTargets, Workout } from '../db/types';
import { addDays, daysBetween } from '../lib/dates';
import { formatNumber, formatSignedKg } from '../lib/format';
import { entriesForDay, sumEntries } from './nutrition';
import { completedWorkouts } from './training';
import { computeTrend, toDailyWeights, weeklyRateKg, type WeighInLike } from './weight';

/**
 * Objectifs caloriques dynamiques.
 * FORGE compare l'évolution réelle du poids tendance à la fourchette visée, sur au moins 14 jours
 * de données suffisantes, et PROPOSE un ajustement expliqué. Il ne modifie jamais les objectifs sans validation.
 */

/** Jours minimum depuis le dernier changement d'objectif avant une nouvelle analyse. */
export const MIN_ANALYSIS_DAYS = 14;
/** Fenêtre d'analyse maximale. */
export const MAX_ANALYSIS_DAYS = 28;
/** Jours pesés et jours notés nécessaires dans la fenêtre (14 jours). */
export const MIN_WEIGH_IN_DAYS = 8;
export const MIN_LOGGED_DAYS = 10;
/** Un jour noté à moins de 50 % de l'objectif est probablement incomplet : il n'entre pas dans la moyenne. */
export const COMPLETE_DAY_RATIO = 0.5;
/**
 * Énergie d'un kilo de poids gagné ou perdu : environ 7 700 kcal (règle approximative de Wishnofsky, 1958,
 * qui surestime chez les personnes minces selon Hall, 2008). Elle sert seulement à dimensionner un petit pas, réévalué ensuite.
 */
export const KCAL_PER_KG = 7700;
export const MAX_STEP_KCAL = 200;
export const MIN_STEP_KCAL = 50;
/** Écart moyen à l'objectif au-delà duquel le problème est le suivi de l'objectif, pas l'objectif lui-même. */
export const ADHERENCE_GAP_KCAL = 150;

export interface TargetChangeLike {
  date: string;
}

export interface AdaptiveInput {
  today: string;
  weighIns: readonly WeighInLike[];
  entries: readonly FoodEntry[];
  workouts: readonly Workout[];
  targets: NutritionTargets | null;
  gainRate: GainRate;
  /** Date du dernier changement d'objectif (null : inconnue). */
  lastChange: string | null;
  /** Plancher calorique (métabolisme de base estimé), si connu. */
  floorKcal: number | null;
}

export type AnalysisStatus = 'no-targets' | 'waiting' | 'insufficient' | 'ok';

export interface Analysis {
  status: AnalysisStatus;
  from: string;
  to: string;
  days: number;
  /** Date à partir de laquelle une analyse sera possible (statut « waiting »). */
  availableOn: string | null;
  weighInDays: number;
  loggedDays: number;
  incompleteDays: number;
  avgIntakeKcal: number | null;
  avgProteinG: number | null;
  weeklyRateKg: number | null;
  latestTrendKg: number | null;
  band: { lowKg: number; highKg: number } | null;
  rateStatus: 'below' | 'within' | 'above' | null;
  maintenanceKcal: number | null;
  sessionsPerWeek: number;
  /** Ce qui manque pour analyser. */
  missing: string[];
  /** Constat en phrases. */
  findings: string[];
  proposal: Proposal | null;
  /** Conseil sans changement d'objectif (suivi, sécurité). */
  advice: string | null;
}

export interface Proposal {
  targets: NutritionTargets;
  deltaKcal: number;
  reasons: string[];
}

const round5 = (v: number) => Math.round(v / 5) * 5;
const round50 = (v: number) => Math.round(v / 50) * 50;
const kcal = (v: number) => `${formatNumber(Math.round(v), 0)} kcal`;

/** Nouveaux objectifs pour un écart calorique : protéines inchangées, lipides au moins 20 % des calories, le reste en glucides. */
export function adjustTargets(current: NutritionTargets, deltaKcal: number): NutritionTargets {
  const total = current.kcal + deltaKcal;
  const fatG = Math.max(current.fatG, round5((total * 0.2) / 9));
  const carbsG = Math.max(0, round5((total - current.proteinG * 4 - fatG * 9) / 4));
  return { ...current, kcal: total, fatG, carbsG };
}

export function analyzeTargets(input: AdaptiveInput): Analysis {
  const { today, targets } = input;
  const earliest = addDays(today, -(MAX_ANALYSIS_DAYS - 1));
  const from = input.lastChange && input.lastChange > earliest ? input.lastChange : earliest;
  const days = daysBetween(from, today) + 1;
  const base: Analysis = {
    status: 'ok',
    from,
    to: today,
    days,
    availableOn: null,
    weighInDays: 0,
    loggedDays: 0,
    incompleteDays: 0,
    avgIntakeKcal: null,
    avgProteinG: null,
    weeklyRateKg: null,
    latestTrendKg: null,
    band: null,
    rateStatus: null,
    maintenanceKcal: null,
    sessionsPerWeek: 0,
    missing: [],
    findings: [],
    proposal: null,
    advice: null,
  };
  if (!targets) return { ...base, status: 'no-targets' };

  // Poids : tendance lissée sur la fenêtre.
  const daily = toDailyWeights(input.weighIns);
  const inWindow = daily.filter((d) => d.date >= from && d.date <= today);
  const points = computeTrend(daily.filter((d) => d.date <= today));
  const windowPoints = points.filter((p) => p.date >= from);
  const rate = windowPoints.length >= 7 ? weeklyRateKg(windowPoints, windowPoints.length) : null;
  const latestTrendKg = points.at(-1)?.trendKg ?? null;

  // Apports : jours complets seulement.
  let logged = 0;
  let incomplete = 0;
  let sumKcal = 0;
  let sumProtein = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const day = entriesForDay(input.entries as FoodEntry[], d);
    if (!day.length) continue;
    const t = sumEntries(day);
    if (t.kcal < targets.kcal * COMPLETE_DAY_RATIO) {
      incomplete += 1;
      continue;
    }
    logged += 1;
    sumKcal += t.kcal;
    sumProtein += t.proteinG;
  }
  const sessions = completedWorkouts(input.workouts).filter((w) => w.date >= from && w.date <= today).length;
  const analysis: Analysis = {
    ...base,
    weighInDays: inWindow.length,
    loggedDays: logged,
    incompleteDays: incomplete,
    avgIntakeKcal: logged ? Math.round(sumKcal / logged) : null,
    avgProteinG: logged ? Math.round(sumProtein / logged) : null,
    weeklyRateKg: rate,
    latestTrendKg,
    sessionsPerWeek: Math.round((sessions / days) * 7 * 10) / 10,
  };

  if (days < MIN_ANALYSIS_DAYS) {
    return { ...analysis, status: 'waiting', availableOn: addDays(from, MIN_ANALYSIS_DAYS - 1) };
  }
  const neededWeighIns = Math.ceil((MIN_WEIGH_IN_DAYS * days) / MIN_ANALYSIS_DAYS);
  const neededLogged = Math.ceil((MIN_LOGGED_DAYS * days) / MIN_ANALYSIS_DAYS);
  const missing: string[] = [];
  if (analysis.weighInDays < Math.min(neededWeighIns, days)) missing.push(`${analysis.weighInDays} jours pesés sur les ${Math.min(neededWeighIns, days)} nécessaires`);
  if (logged < Math.min(neededLogged, days)) missing.push(`${logged} jours notés en entier sur les ${Math.min(neededLogged, days)} nécessaires`);
  if (rate === null || latestTrendKg === null) missing.push('pas encore de rythme de poids calculable');
  if (missing.length) return { ...analysis, status: 'insufficient', missing };

  const band = { lowKg: (latestTrendKg! * input.gainRate.lowPctPerWeek) / 100, highKg: (latestTrendKg! * input.gainRate.highPctPerWeek) / 100 };
  const rateStatus = rate! < band.lowKg ? 'below' : rate! > band.highKg ? 'above' : 'within';
  const maintenanceKcal = Math.round(analysis.avgIntakeKcal! - (rate! * KCAL_PER_KG) / 7);
  const findings = [
    `Poids tendance : ${formatSignedKg(rate!)} par semaine sur ${days} jours ; fourchette visée : ${formatSignedKg(band.lowKg).replace(' kg', '')} à ${formatSignedKg(band.highKg)}.`,
    `Apports moyens : ${kcal(analysis.avgIntakeKcal!)} par jour sur ${logged} jours notés en entier (objectif ${kcal(targets.kcal)})${incomplete ? ` ; ${incomplete} jour${incomplete > 1 ? 's' : ''} incomplet${incomplete > 1 ? 's' : ''} écarté${incomplete > 1 ? 's' : ''}` : ''}.`,
    `Dépense estimée d’après ces données : environ ${kcal(maintenanceKcal)} par jour.`,
    `Entraînement : ${formatNumber(analysis.sessionsPerWeek, 1)} séance${analysis.sessionsPerWeek >= 2 ? 's' : ''} par semaine sur la période.`,
  ];
  const done: Analysis = { ...analysis, band, rateStatus, maintenanceKcal, findings };
  if (rateStatus === 'within') return done;

  const gap = analysis.avgIntakeKcal! - targets.kcal;
  if (rateStatus === 'below' && gap < -ADHERENCE_GAP_KCAL) {
    return { ...done, advice: `Tu manges en moyenne ${kcal(-gap)} de moins que ton objectif : atteins d’abord ton objectif actuel avant de l’augmenter.` };
  }
  if (rateStatus === 'above' && gap > ADHERENCE_GAP_KCAL) {
    return { ...done, advice: `Tu manges en moyenne ${kcal(gap)} de plus que ton objectif : reviens d’abord à ton objectif actuel avant de le baisser.` };
  }

  const mid = (band.lowKg + band.highKg) / 2;
  const raw = ((mid - rate!) * KCAL_PER_KG) / 7;
  let delta = round50(Math.sign(raw) * Math.min(MAX_STEP_KCAL, Math.abs(raw)));
  if (Math.abs(delta) < MIN_STEP_KCAL) delta = MIN_STEP_KCAL * Math.sign(raw);
  const floor = Math.max(1200, input.floorKcal ?? 0);
  if (targets.kcal + delta < floor) {
    const allowed = round50(floor - targets.kcal);
    if (allowed >= 0 || Math.abs(allowed) < MIN_STEP_KCAL) {
      return {
        ...done,
        advice: `Ton objectif est déjà proche de ton métabolisme de base estimé : FORGE ne propose pas de le baisser. Parles-en à un professionnel de santé si tu veux aller plus loin.`,
      };
    }
    delta = allowed;
  }
  const next = adjustTargets(targets, delta);
  const reasons = [
    rateStatus === 'below'
      ? `Ton poids évolue moins vite que la fourchette visée${rate! < 0 && band.lowKg >= 0 ? ' (il baisse)' : ''}.`
      : 'Ton poids évolue plus vite que la fourchette visée.',
    `Un écart de ${formatSignedKg(mid - rate!)} par semaine correspond à environ ${kcal(Math.abs(raw))} par jour ; FORGE propose ${kcal(Math.abs(delta))}${Math.abs(raw) > MAX_STEP_KCAL ? ' (pas maximum)' : ''}, puis réanalyse après 14 jours.`,
    `Les calories sont ${delta > 0 ? 'ajoutées' : 'retirées'} sur les glucides : protéines inchangées, lipides au moins 20 % des calories.`,
  ];
  return { ...done, proposal: { targets: next, deltaKcal: delta, reasons } };
}
