import type { CheckIn, MoodLog, PulseComponentKey, PulseConfidence, PulseMode } from '../../db/types';
import { addDays } from '../../lib/dates';
import { formatHours, formatNumber } from '../../lib/format';
import type { DayIndex } from '../lifeIndex';
import { COMPONENT_LABELS, COMPONENT_ORDER, type PulseSettings } from './settings';

/**
 * Readiness Score : disponibilité physique et mentale du jour, de 0 à 100.
 * Chaque composante est notée séparément, avec sa source et son explication ;
 * une composante sans donnée n'est pas inventée : son poids est réparti sur les autres.
 * La nutrition n'y entre pas (voir Nutrition Status).
 */

/** Résumé quotidien d'une source de mesure (montre, bague), fourni par l'import Apple Santé à partir de PULSE 2. */
export interface HealthDay {
  date: string;
  /** Nom lisible de la source, ex. « Apple Watch ». */
  source: string;
  sleepHours?: number | null;
  hrvMs?: number | null;
  restingHr?: number | null;
}

export type SourceKind = 'mesure' | 'declare' | 'calcule';

export interface ComponentResult {
  key: PulseComponentKey;
  label: string;
  /** Note sur 100, arrondie ; null si la donnée manque. */
  score: number | null;
  /** Poids réglé, et poids réel une fois les composantes manquantes réparties (en %). */
  baseWeight: number;
  weight: number;
  source: SourceKind | null;
  sourceLabel: string | null;
  lines: string[];
  missing: string | null;
}

export interface Readiness {
  score: number | null;
  /** Pourquoi il n'y a pas de score (check-in manquant). */
  unavailable: string | null;
  confidence: PulseConfidence | null;
  confidenceText: string;
  modeFromScore: PulseMode | null;
  components: ComponentResult[];
}

export interface ReadinessInput {
  date: string;
  index: DayIndex;
  health: readonly HealthDay[];
  settings: PulseSettings;
}

const round = Math.round;
const scale5 = (v: number) => ((v - 1) / 4) * 100;
const inv5 = (v: number) => ((5 - v) / 4) * 100;
const n1 = (v: number) => formatNumber(v, Number.isInteger(v) ? 0 : 1);

/** Note de durée : 100 à la cible et au-delà, 60 à une heure de moins, 30 à deux heures, 10 à trois heures et moins. */
export function sleepDurationScore(hours: number, target: number): number {
  const gap = target - hours;
  if (gap <= 0) return 100;
  const steps: [number, number][] = [
    [0, 100],
    [1, 60],
    [2, 30],
    [3, 10],
  ];
  for (let i = 1; i < steps.length; i++) {
    const [g0, s0] = steps[i - 1]!;
    const [g1, s1] = steps[i]!;
    if (gap <= g1) return s0 + ((gap - g0) / (g1 - g0)) * (s1 - s0);
  }
  return 10;
}

/** Écart type des heures de coucher, en minutes (heures ramenées autour de minuit). */
export function bedtimeSpreadMinutes(times: readonly string[]): number | null {
  if (times.length < 4) return null;
  const mins = times.map((t) => {
    const [h = 0, m = 0] = t.split(':').map(Number);
    return (h * 60 + m - 18 * 60 + 1440) % 1440;
  });
  const mean = mins.reduce((a, b) => a + b, 0) / mins.length;
  return Math.sqrt(mins.reduce((a, b) => a + (b - mean) ** 2, 0) / mins.length);
}

function component(key: PulseComponentKey, settings: PulseSettings, part: Partial<ComponentResult>): ComponentResult {
  return { key, label: COMPONENT_LABELS[key], score: null, baseWeight: settings.weights[key], weight: 0, source: null, sourceLabel: null, lines: [], missing: null, ...part };
}

function sleepComponent({ date, index, health, settings }: ReadinessInput): ComponentResult {
  const measured = health.find((h) => h.date === date && typeof h.sleepHours === 'number');
  const checkIn = index.get(date)?.checkIn ?? null;
  const hours = measured?.sleepHours ?? checkIn?.sleepHours ?? null;
  if (hours === null || hours === undefined) return component('sommeil', settings, { missing: 'Pas de check-in ni de nuit mesurée aujourd’hui.' });
  const duration = sleepDurationScore(hours, settings.sleepTargetHours);
  const lines = [`Nuit de ${formatHours(hours)} pour une cible de ${formatHours(settings.sleepTargetHours)} : ${round(duration)}/100.`];
  let score = duration;
  const quality = checkIn?.sleepQuality ?? null;
  if (quality) {
    score = 0.7 * duration + 0.3 * scale5(quality);
    lines.push(`Qualité ressentie ${quality}/5 : ${round(scale5(quality))}/100 (30 % de la note).`);
  }
  const bedTimes = Array.from({ length: 7 }, (_, i) => index.get(addDays(date, -i))?.checkIn?.bedTime).filter((t): t is string => !!t);
  const spread = bedtimeSpreadMinutes(bedTimes);
  if (spread !== null && spread > 60) {
    score = Math.max(0, score - 10);
    lines.push(`Heures de coucher irrégulières sur 7 jours (écart moyen ${formatHours(spread / 60)}) : −10.`);
  }
  return component('sommeil', settings, {
    score: round(score),
    source: measured ? 'mesure' : 'declare',
    sourceLabel: measured ? measured.source : 'Check-in du matin',
    lines,
  });
}

export interface Baseline {
  mean: number;
  sd: number;
  low: number;
  high: number;
  count: number;
}

/** Référence personnelle sur les 28 jours précédant la date (la date exclue) ; null sous 14 valeurs. */
export function personalBaseline(values: readonly { date: string; value: number }[], date: string, minCount = 14): Baseline | null {
  const since = addDays(date, -28);
  const list = values.filter((v) => v.date >= since && v.date < date).map((v) => v.value);
  if (list.length < minCount) return null;
  const mean = list.reduce((a, b) => a + b, 0) / list.length;
  const sd = Math.sqrt(list.reduce((a, b) => a + (b - mean) ** 2, 0) / list.length);
  const half = Math.max(sd, 0.05 * mean);
  return { mean, sd, low: mean - half, high: mean + half, count: list.length };
}

export interface PhysioSignals {
  hrvBelowDays: number;
  component: ComponentResult;
}

function physioComponent({ date, health, settings }: ReadinessInput): PhysioSignals {
  const series = (k: 'hrvMs' | 'restingHr') => health.flatMap((h) => (typeof h[k] === 'number' ? [{ date: h.date, value: h[k] as number }] : []));
  const hrv = series('hrvMs');
  const rhr = series('restingHr');
  if (!hrv.length && !rhr.length) return { hrvBelowDays: 0, component: component('physiologie', settings, { missing: 'Aucune donnée de montre pour l’instant.' }) };
  const scores: number[] = [];
  const lines: string[] = [];
  let hrvBelowDays = 0;
  const today = (list: typeof hrv) => list.find((v) => v.date === date)?.value ?? null;
  const hrvBase = personalBaseline(hrv, date);
  const hrvToday = today(hrv);
  if (hrvBase && hrvToday !== null) {
    for (let k = 0; k < 7; k++) {
      const v = hrv.find((x) => x.date === addDays(date, -k))?.value;
      if (v === undefined || v >= hrvBase.low) break;
      hrvBelowDays++;
    }
    const s = hrvBelowDays >= 3 ? 20 : hrvBelowDays >= 1 ? 35 : 85;
    scores.push(s);
    const zone = `zone habituelle ${formatNumber(hrvBase.low, 0)} à ${formatNumber(hrvBase.high, 0)} ms`;
    lines.push(
      hrvBelowDays >= 3
        ? `VFC ${formatNumber(hrvToday, 0)} ms, sous ta ${zone} depuis ${hrvBelowDays} jours : ${s}/100.`
        : hrvBelowDays
          ? `VFC ${formatNumber(hrvToday, 0)} ms, sous ta ${zone} : ${s}/100.`
          : `VFC ${formatNumber(hrvToday, 0)} ms, dans ta ${zone} ou au-dessus : ${s}/100.`,
    );
  }
  const rhrBase = personalBaseline(rhr, date);
  const rhrToday = today(rhr);
  if (rhrBase && rhrToday !== null) {
    const diff = rhrToday - rhrBase.mean;
    const s = diff <= 2 ? 85 : diff <= 5 ? 55 : 25;
    scores.push(s);
    lines.push(`Fréquence cardiaque au repos ${formatNumber(rhrToday, 0)}, pour une référence de ${formatNumber(rhrBase.mean, 0)} : ${s}/100.`);
  }
  if (!scores.length) {
    const count = Math.max(
      hrvBase?.count ?? hrv.filter((v) => v.date < date && v.date >= addDays(date, -28)).length,
      rhr.filter((v) => v.date < date && v.date >= addDays(date, -28)).length,
    );
    return {
      hrvBelowDays: 0,
      component: component('physiologie', settings, {
        missing:
          hrvToday === null && rhrToday === null ? 'Pas de mesure de la montre aujourd’hui.' : `Il faut 14 jours de mesures pour connaître ta référence : ${count} pour l’instant.`,
      }),
    };
  }
  const source = health.find((h) => h.date === date)?.source ?? health.at(-1)?.source ?? 'Montre';
  return {
    hrvBelowDays,
    component: component('physiologie', settings, { score: round(scores.reduce((a, b) => a + b, 0) / scores.length), source: 'mesure', sourceLabel: source, lines }),
  };
}

function feelingComponent({ date, index, settings }: ReadinessInput): ComponentResult {
  const c: CheckIn | null = index.get(date)?.checkIn ?? null;
  if (!c) return component('ressenti', settings, { missing: 'Pas de check-in aujourd’hui.' });
  const parts = [scale5(c.energy), inv5(c.fatigue), inv5(c.soreness)];
  return component('ressenti', settings, {
    score: round(parts.reduce((a, b) => a + b, 0) / 3),
    source: 'declare',
    sourceLabel: 'Check-in du matin',
    lines: [`Énergie ${c.energy}/5, fatigue ${c.fatigue}/5, courbatures ${c.soreness}/5 (moyenne des trois, fatigue et courbatures inversées).`],
  });
}

export interface LoadSignals {
  ratio: number | null;
  component: ComponentResult;
}

/** Charge : séries des 7 derniers jours rapportées à la moyenne hebdomadaire des 28 derniers (aujourd'hui exclu). */
export function loadSignals({ date, index, settings }: ReadinessInput): LoadSignals {
  const firstWorkout = [...index.values()].filter((d) => d.workouts.length > 0 && d.date < date).reduce<string | null>((m, d) => (m === null || d.date < m ? d.date : m), null);
  if (!firstWorkout) return { ratio: null, component: component('charge', settings, { missing: 'Aucune séance notée avant aujourd’hui.' }) };
  if (firstWorkout > addDays(date, -28))
    return { ratio: null, component: component('charge', settings, { missing: 'Il faut 4 semaines de séances pour connaître ta charge habituelle.' }) };
  const setsOn = (d: string) => (index.get(d)?.workouts ?? []).reduce((n, w) => n + w.setCount, 0);
  const acute = Array.from({ length: 7 }, (_, i) => setsOn(addDays(date, -1 - i))).reduce((a, b) => a + b, 0);
  const chronic = Array.from({ length: 28 }, (_, i) => setsOn(addDays(date, -1 - i))).reduce((a, b) => a + b, 0) / 4;
  if (chronic === 0) {
    return {
      ratio: null,
      component: component('charge', settings, {
        score: 80,
        source: 'calcule',
        sourceLabel: 'Séances notées',
        lines: ['Aucune séance depuis 4 semaines : reprise à faire en douceur.'],
      }),
    };
  }
  const ratio = acute / chronic;
  const s = ratio < settings.loadLow ? 80 : ratio <= settings.loadHigh ? 90 : ratio <= settings.loadVeryHigh ? 60 : 30;
  return {
    ratio,
    component: component('charge', settings, {
      score: s,
      source: 'calcule',
      sourceLabel: 'Séances notées',
      lines: [`${acute} séries sur 7 jours, pour ${n1(chronic)} par semaine en moyenne sur 4 semaines : rapport ${formatNumber(ratio, 2)}, ${s}/100.`],
    }),
  };
}

/** Le journal du jour, ou celui d'hier soir s'il n'y en a pas encore. */
export function recentMood(index: DayIndex, date: string): MoodLog | null {
  return index.get(date)?.mood ?? index.get(addDays(date, -1))?.mood ?? null;
}

function mentalComponent({ date, index, settings }: ReadinessInput): ComponentResult {
  const m = recentMood(index, date);
  const parts: number[] = [];
  const words: string[] = [];
  if (m?.mood) {
    parts.push(scale5(m.mood));
    words.push(`humeur ${m.mood}/5`);
  }
  if (m?.stress) {
    parts.push(inv5(m.stress));
    words.push(`stress ${m.stress}/5`);
  }
  if (!m || !parts.length) return component('mental', settings, { missing: 'Pas de journal Mind aujourd’hui ni hier.' });
  return component('mental', settings, {
    score: round(parts.reduce((a, b) => a + b, 0) / parts.length),
    source: 'declare',
    sourceLabel: m.date === date ? 'Journal Mind du jour' : 'Journal Mind d’hier',
    lines: [`${words.join(', ').replace(/^./, (c) => c.toLocaleUpperCase('fr-FR'))}${m.stress ? ' (stress inversé)' : ''}.`],
  });
}

export function modeFor(score: number, settings: PulseSettings): PulseMode {
  if (score >= settings.modes.feuVert) return 'feu-vert';
  if (score >= settings.modes.normal) return 'normal';
  if (score >= settings.modes.allege) return 'allege';
  return 'recuperation';
}

export interface ReadinessResult {
  readiness: Readiness;
  load: LoadSignals;
  hrvBelowDays: number;
}

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const { settings } = input;
  const physio = physioComponent(input);
  const load = loadSignals(input);
  const byKey = { sommeil: sleepComponent(input), physiologie: physio.component, ressenti: feelingComponent(input), charge: load.component, mental: mentalComponent(input) };
  const components = COMPONENT_ORDER.map((k) => byKey[k]);
  const active = components.filter((c) => c.baseWeight > 0);
  const present = active.filter((c) => c.score !== null);
  const presentWeight = present.reduce((n, c) => n + c.baseWeight, 0);
  const totalWeight = active.reduce((n, c) => n + c.baseWeight, 0);
  for (const c of present) c.weight = round((100 * c.baseWeight) / presentWeight);
  const hasCheckIn = !!input.index.get(input.date)?.checkIn;
  const core = present.some((c) => c.key === 'sommeil' || c.key === 'ressenti');
  if (!core || !presentWeight) {
    return {
      readiness: {
        score: null,
        unavailable: hasCheckIn ? 'Pas assez de données pour calculer ton score aujourd’hui.' : 'Ton score du jour se calcule après ton check-in du matin.',
        confidence: null,
        confidenceText: '',
        modeFromScore: null,
        components,
      },
      load,
      hrvBelowDays: physio.hrvBelowDays,
    };
  }
  const score = round(present.reduce((n, c) => n + c.baseWeight * c.score!, 0) / presentWeight);
  const coverage = presentWeight / totalWeight;
  const confidence: PulseConfidence = coverage >= 0.9 ? 'haute' : coverage >= 0.6 ? 'moyenne' : 'basse';
  const missing = active.filter((c) => c.score === null).map((c) => c.label.toLocaleLowerCase('fr-FR'));
  const confidenceText =
    missing.length === 0
      ? 'Toutes les composantes sont renseignées.'
      : `Sans ${missing.join(', ').replace(/, ([^,]*)$/, ' ni $1')} : ${missing.length > 1 ? 'leur' : 'son'} poids est réparti sur les autres composantes.`;
  return {
    readiness: { score, unavailable: null, confidence, confidenceText, modeFromScore: modeFor(score, settings), components },
    load,
    hrvBelowDays: physio.hrvBelowDays,
  };
}
