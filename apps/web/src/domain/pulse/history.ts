import type { PulseChoice, PulseComponentKey, PulseConfidence, PulseDay } from '../../db/types';
import { addDays } from '../../lib/dates';
import type { DayIndex } from '../lifeIndex';
import { computeReadiness, mergeHealth, type HealthDay } from './readiness';
import { COMPONENT_ORDER, type PulseSettings } from './settings';

/**
 * Historique PULSE. Les scores passés sont recalculés à partir des données de chaque jour,
 * avec les règles et réglages actuels : la série reste cohérente même les jours où l'app n'a pas été ouverte.
 * Le journal (pulseDays) garde ce qui a été montré et ton choix : il sert aux propositions et au taux d'acceptation.
 */
export interface SeriesPoint {
  date: string;
  score: number | null;
  confidence: PulseConfidence | null;
  components: Record<PulseComponentKey, number | null>;
  sleepHours: number | null;
  stress: number | null;
  sets: number;
}

export interface SeriesInput {
  index: DayIndex;
  health: readonly HealthDay[];
  settings: PulseSettings;
}

/** Un point par jour, de `from` à `to` inclus. */
export function readinessSeries({ index, health, settings }: SeriesInput, from: string, to: string): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  const merged = mergeHealth(health).days;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const { readiness } = computeReadiness({ date: d, index, health, settings });
    const day = index.get(d);
    const components = Object.fromEntries(
      COMPONENT_ORDER.map((k) => [k, readiness.score === null ? null : (readiness.components.find((c) => c.key === k)?.score ?? null)]),
    ) as SeriesPoint['components'];
    const measured = merged.find((h) => h.date === d && typeof h.sleepHours === 'number')?.sleepHours ?? null;
    out.push({
      date: d,
      score: readiness.score,
      confidence: readiness.confidence,
      components,
      sleepHours: measured ?? day?.checkIn?.sleepHours ?? null,
      stress: day?.mood?.stress ?? null,
      sets: (day?.workouts ?? []).reduce((n, w) => n + w.setCount, 0),
    });
  }
  return out;
}

export const mean = (values: readonly (number | null | undefined)[]): number | null => {
  const list = values.filter((v): v is number => typeof v === 'number');
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
};
const countOf = (values: readonly (number | null)[]) => values.filter((v) => v !== null).length;

/** Moyennes de comparaison : il en faut assez pour qu'elles veuillent dire quelque chose. */
export const TREND_MIN = { week: 3, month: 7 };
/** En dessous de cet écart (points), le score est dit stable. Convention d'interface. */
export const STABLE_POINTS = 5;

export interface Trend {
  yesterday: number | null;
  mean7: number | null;
  mean30: number | null;
  /** Écarts du jour, arrondis, ou null si la référence manque. */
  vsYesterday: number | null;
  vs7: number | null;
  vs30: number | null;
  direction: 'hausse' | 'baisse' | 'stable' | null;
  /** Moyenne de chaque dimension sur les 7 jours précédents (au moins 3 valeurs). */
  components7: Record<PulseComponentKey, number | null>;
}

/** Évolution du score du jour par rapport à hier et aux moyennes des 7 et 30 jours précédents (le jour exclu). */
export function trendAt(series: readonly SeriesPoint[], date: string, score: number | null): Trend {
  const before = (n: number) => series.filter((p) => p.date >= addDays(date, -n) && p.date < date);
  const week = before(7);
  const month = before(30);
  const yesterday = series.find((p) => p.date === addDays(date, -1))?.score ?? null;
  const mean7 = countOf(week.map((p) => p.score)) >= TREND_MIN.week ? mean(week.map((p) => p.score)) : null;
  const mean30 = countOf(month.map((p) => p.score)) >= TREND_MIN.month ? mean(month.map((p) => p.score)) : null;
  const diff = (ref: number | null) => (score === null || ref === null ? null : Math.round(score - ref));
  const vs7 = diff(mean7);
  const ref = vs7 ?? diff(mean30);
  const components7 = Object.fromEntries(
    COMPONENT_ORDER.map((k) => {
      const values = week.map((p) => p.components[k]);
      return [k, countOf(values) >= TREND_MIN.week ? mean(values) : null];
    }),
  ) as Trend['components7'];
  return {
    yesterday,
    mean7: mean7 === null ? null : Math.round(mean7),
    mean30: mean30 === null ? null : Math.round(mean30),
    vsYesterday: diff(yesterday),
    vs7,
    vs30: diff(mean30),
    direction: ref === null ? null : ref >= STABLE_POINTS ? 'hausse' : ref <= -STABLE_POINTS ? 'baisse' : 'stable',
    components7,
  };
}

/** Propositions de séance qui demandent un choix (version allégée, récupération active). */
export const PROPOSAL_KINDS = ['lighten', 'replace'] as const;
const ACCEPTED: PulseChoice[] = ['alleger', 'remplacer', 'deplacer'];

/** Le journal d'avant PULSE 1.1 n'enregistrait pas la proposition : elle se déduit du mode et de la séance prévue. */
export function proposalOf(day: PulseDay): string | null {
  if (day.trainingKind !== undefined) return day.trainingKind ?? null;
  if (!day.plannedTemplateId) return null;
  return day.mode === 'allege' ? 'lighten' : day.mode === 'recuperation' ? 'replace' : null;
}

export interface Acceptance {
  proposals: number;
  accepted: number;
  kept: number;
  unanswered: number;
  /** Part des propositions acceptées parmi celles qui ont reçu une réponse ; null sans réponse. */
  rate: number | null;
}

export function acceptance(journal: readonly PulseDay[], from: string, to: string): Acceptance {
  const days = journal.filter((d) => !d.deletedAt && d.date >= from && d.date <= to && (PROPOSAL_KINDS as readonly string[]).includes(proposalOf(d) ?? ''));
  const accepted = days.filter((d) => d.choice && ACCEPTED.includes(d.choice)).length;
  const kept = days.filter((d) => d.choice === 'garder').length;
  const answered = accepted + kept;
  return { proposals: days.length, accepted, kept, unanswered: days.length - answered, rate: answered ? accepted / answered : null };
}

export interface PeriodSummary {
  from: string;
  to: string;
  days: number;
  scoredDays: number;
  avgScore: number | null;
  components: Record<PulseComponentKey, number | null>;
  avgSleep: number | null;
  sleepNights: number;
  avgStress: number | null;
  stressDays: number;
  setsPerWeek: number;
  acceptance: Acceptance;
}

export function periodSummary(series: readonly SeriesPoint[], journal: readonly PulseDay[], from: string, to: string): PeriodSummary {
  const points = series.filter((p) => p.date >= from && p.date <= to);
  const r = (v: number | null, digits = 0) => (v === null ? null : Math.round(v * 10 ** digits) / 10 ** digits);
  const sets = points.reduce((n, p) => n + p.sets, 0);
  return {
    from,
    to,
    days: points.length,
    scoredDays: countOf(points.map((p) => p.score)),
    avgScore: r(mean(points.map((p) => p.score))),
    components: Object.fromEntries(COMPONENT_ORDER.map((k) => [k, r(mean(points.map((p) => p.components[k])))])) as PeriodSummary['components'],
    avgSleep: r(mean(points.map((p) => p.sleepHours)), 2),
    sleepNights: countOf(points.map((p) => p.sleepHours)),
    avgStress: r(mean(points.map((p) => p.stress)), 1),
    stressDays: countOf(points.map((p) => p.stress)),
    setsPerWeek: points.length ? Math.round((sets / points.length) * 7) : 0,
    acceptance: acceptance(journal, from, to),
  };
}

/** Choix « Garder » sur les 7 jours précédents, quand une version allégée ou une récupération était proposée. */
export function keptRecently(journal: readonly PulseDay[], date: string): number {
  return acceptance(journal, addDays(date, -7), addDays(date, -1)).kept;
}
