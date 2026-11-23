import { formatNumber, formatSignedKg, formatTime } from '../lib/format';
import type { DayNutrition } from './nutrition';
import type { WeightSummary } from './weight';

/**
 * Analyse du jour, calculée sur l'appareil par des règles simples à partir des données réelles.
 * Ce n'est pas encore le coach IA (Phase 5) : l'interface le dit explicitement.
 * Aucune règle ne produit de chiffre qui ne vient pas des données.
 */

export type CoachLink = '/nutrition' | '/training' | '/progression' | '/coach';
export type CoachTone = 'good' | 'neutral' | 'alert';

export interface CoachFinding {
  id: string;
  tone: CoachTone;
  observation: string;
  recommendation?: string;
  link: CoachLink;
  /** Plus haut = plus important. */
  priority: number;
}

export interface BriefInput {
  today: string;
  /** Heure locale (0 à 23), pour ne pas juger les repas trop tôt dans la journée. */
  hour: number;
  weight: WeightSummary;
  lastWeighInDate: string | null;
  nutrition: DayNutrition;
  training: {
    plannedToday: string | null;
    doneToday: { name: string; volumeKg: number } | null;
    inProgress: boolean;
    sessionsThisWeek: number;
    plannedPerWeek: number;
    plannedSoFar: number;
    recentRecords: { exerciseName: string; weightKg: number; reps: number; date: string }[];
  };
  wellbeing: { sleepHours: number; score: number } | null;
}

export interface DailyBrief {
  summary: string[];
  findings: CoachFinding[];
  top: CoachFinding | null;
  recommendation: CoachFinding | null;
  enoughData: boolean;
}

const kg = (v: number) => `${formatNumber(v, 1)} kg`;
const sleep = (h: number) => formatTime(`${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`);
const int = (v: number) => formatNumber(Math.round(v), 0);

function daysSince(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

export function buildDailyBrief(input: BriefInput): DailyBrief {
  const { weight, nutrition, training, wellbeing, today, hour } = input;
  const summary: string[] = [];
  const findings: CoachFinding[] = [];

  // Résumé : uniquement des faits enregistrés.
  if (training.doneToday) summary.push(`Séance faite : ${training.doneToday.name}.`);
  else if (training.inProgress) summary.push('Séance en cours.');
  else if (training.plannedToday) summary.push(`Séance prévue : ${training.plannedToday}.`);
  else if (training.plannedPerWeek > 0) summary.push('Repos prévu aujourd’hui.');

  const { totals, targets } = nutrition;
  if (targets) summary.push(`${int(totals.kcal)} kcal sur ${int(targets.kcal)}, protéines ${int(totals.proteinG)} g sur ${int(targets.proteinG)}.`);
  else if (nutrition.entries.length) summary.push(`${int(totals.kcal)} kcal enregistrées.`);

  if (weight.latestTrendKg !== null) {
    summary.push(
      weight.weeklyRateKg !== null
        ? `Poids tendance ${kg(weight.latestTrendKg)} (${formatSignedKg(weight.weeklyRateKg)} par semaine).`
        : `Poids tendance ${kg(weight.latestTrendKg)}.`,
    );
  }
  if (wellbeing) summary.push(`Sommeil ${sleep(wellbeing.sleepHours)}, récupération ${wellbeing.score}/100.`);

  // Poids : rythme par rapport à la fourchette (seulement hors calibrage).
  if (!weight.calibrating && weight.band && weight.weeklyRateKg !== null) {
    const band = `${formatSignedKg(weight.band.lowKgPerWeek).replace(' kg', '')} à ${formatSignedKg(weight.band.highKgPerWeek)}`;
    if (weight.status === 'above') {
      findings.push({
        id: 'rate-above',
        tone: 'alert',
        observation: `Tu prends ${formatSignedKg(weight.weeklyRateKg)} par semaine, au-dessus de ta fourchette (${band}).`,
        recommendation: 'Baisse l’apport d’environ 150 à 250 kcal par jour, puis observe la tendance pendant deux semaines.',
        link: '/progression',
        priority: 80,
      });
    } else if (weight.status === 'below') {
      findings.push({
        id: 'rate-below',
        tone: 'neutral',
        observation: `Tu prends ${formatSignedKg(weight.weeklyRateKg)} par semaine, sous ta fourchette (${band}).`,
        recommendation: 'Ajoute environ 150 à 250 kcal par jour, puis observe la tendance pendant deux semaines.',
        link: '/progression',
        priority: 75,
      });
    } else if (weight.status === 'within') {
      findings.push({ id: 'rate-within', tone: 'good', observation: `Rythme de prise dans ta fourchette : ${formatSignedKg(weight.weeklyRateKg)} par semaine.`, link: '/progression', priority: 20 });
    }
  }

  // Sommeil court.
  if (wellbeing && wellbeing.sleepHours < 6.5) {
    const sessionAhead = Boolean(training.plannedToday && !training.doneToday);
    findings.push({
      id: 'short-sleep',
      tone: sessionAhead ? 'alert' : 'neutral',
      observation: sessionAhead ? `Nuit courte (${sleep(wellbeing.sleepHours)}) avec une séance prévue.` : `Nuit courte (${sleep(wellbeing.sleepHours)}).`,
      recommendation: sessionAhead
        ? 'Garde tes charges habituelles et retire une série par exercice si la fatigue monte.'
        : 'Si tu peux, couche-toi plus tôt ce soir.',
      link: '/progression',
      priority: sessionAhead ? 70 : 50,
    });
  }

  // Nutrition : jugée seulement en fin de journée.
  if (targets && nutrition.progress) {
    if (hour >= 17 && nutrition.progress.protein < 0.7) {
      findings.push({
        id: 'protein-low',
        tone: 'neutral',
        observation: `Protéines à ${Math.round(nutrition.progress.protein * 100)} % de l’objectif (${int(totals.proteinG)} g sur ${int(targets.proteinG)}).`,
        recommendation: `Prévois une source de protéines au dîner : il en reste environ ${int(targets.proteinG - totals.proteinG)} g.`,
        link: '/nutrition',
        priority: 65,
      });
    }
    if (hour >= 20 && nutrition.progress.kcal < 0.8) {
      findings.push({
        id: 'kcal-low',
        tone: 'neutral',
        observation: `Il reste ${int(targets.kcal - totals.kcal)} kcal pour atteindre ton objectif.`,
        recommendation: 'Une collation dense (laitage, flocons d’avoine, fruits secs) aide à combler l’écart.',
        link: '/nutrition',
        priority: 60,
      });
    }
  }

  // Records des deux derniers jours.
  const fresh = training.recentRecords.filter((r) => daysSince(r.date, today) <= 2);
  if (fresh[0]) {
    const r = fresh[0];
    findings.push({
      id: 'record',
      tone: 'good',
      observation: `Record ${fresh.length > 1 ? `(et ${fresh.length - 1} autre${fresh.length > 2 ? 's' : ''}) ` : ''}: ${r.exerciseName}, ${formatNumber(r.weightKg, r.weightKg % 1 ? 1 : 0)} kg × ${r.reps}.`,
      link: '/training',
      priority: 55,
    });
  }

  // Séance faite aujourd'hui.
  if (training.doneToday) {
    findings.push({ id: 'done-today', tone: 'good', observation: `${training.doneToday.name} faite : ${int(training.doneToday.volumeKg)} kg soulevés.`, link: '/training', priority: 30 });
  }

  // Retard sur le programme.
  if (training.plannedSoFar > 0 && training.sessionsThisWeek < training.plannedSoFar - (training.plannedToday && !training.doneToday ? 1 : 0)) {
    findings.push({
      id: 'behind',
      tone: 'neutral',
      observation: `${training.sessionsThisWeek} séance${training.sessionsThisWeek > 1 ? 's' : ''} faite${training.sessionsThisWeek > 1 ? 's' : ''} sur ${training.plannedSoFar} prévue${training.plannedSoFar > 1 ? 's' : ''} à ce stade de la semaine.`,
      link: '/training',
      priority: 40,
    });
  }

  // Pesées manquantes.
  if (input.lastWeighInDate) {
    const gap = daysSince(input.lastWeighInDate, today);
    if (gap >= 3) {
      findings.push({
        id: 'no-weighin',
        tone: 'neutral',
        observation: `Aucune pesée depuis ${gap} jours : la tendance perd en précision.`,
        recommendation: 'Pèse-toi demain matin, au réveil et à jeun.',
        link: '/progression',
        priority: 45,
      });
    }
  }

  findings.sort((a, b) => b.priority - a.priority);
  return {
    summary,
    findings,
    top: findings[0] ?? null,
    recommendation: findings.find((f) => f.recommendation) ?? null,
    enoughData: summary.length > 0,
  };
}
