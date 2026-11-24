import { addDays } from '../lib/dates';
import { formatHours, formatNumber } from '../lib/format';
import { zoneLabel } from './body';
import { mean, type DayIndex, type DayRecord, type LifeData } from './lifeIndex';

/**
 * Liens entre les espaces de FORGE : deux groupes de jours comparés sur une même mesure.
 * Une différence observée n'est jamais présentée comme une cause : seulement une coïncidence à regarder.
 */
export type InsightUnit = 'scale5' | 'scale10' | 'hours' | 'pct';

export interface InsightGroup {
  label: string;
  value: number;
  n: number;
}

export interface Insight {
  id: string;
  title: string;
  text: string;
  a: InsightGroup;
  b: InsightGroup;
  unit: InsightUnit;
  /** Nuance propre à ce lien (sens inverse possible, etc.). */
  caveat?: string;
}

export interface InsightsResult {
  days: number;
  found: Insight[];
  /** Assez de données, pas de différence nette. */
  flat: { id: string; title: string; text: string }[];
  /** Pas encore assez de jours dans chaque groupe. */
  pending: { id: string; title: string; text: string }[];
}

export const INSIGHT_WINDOW_DAYS = 60;
export const MIN_DAYS = 5;

export function formatInsightValue(v: number, unit: InsightUnit): string {
  if (unit === 'hours') return formatHours(v);
  if (unit === 'pct') {
    const r = Math.round(v);
    return `${r > 0 ? '+' : r < 0 ? '−' : ''}${formatNumber(Math.abs(r), 0)} %`;
  }
  return `${formatNumber(v, 1)}/${unit === 'scale5' ? 5 : 10}`;
}

interface Spec {
  id: string;
  title: string;
  unit: InsightUnit;
  labels: [string, string];
  a: number[];
  b: number[];
  min: number;
  threshold: number;
  sentence: (a: string, b: string) => string;
  caveat?: string;
}

const MIN_PAIN_DAYS = 3;
const scale = (v: number | null | undefined): v is number => typeof v === 'number';

export function crossInsights(index: DayIndex, data: LifeData, today: string, days = INSIGHT_WINDOW_DAYS): InsightsResult {
  const since = addDays(today, -(days - 1));
  const window = [...index.values()].filter((d) => d.date >= since && d.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const get = (date: string): DayRecord | undefined => index.get(date);
  const trainingDay = (d: DayRecord | undefined) => !!d && d.workouts.length > 0;
  const specs: Spec[] = [];

  // Le check-in du jour J décrit la nuit qui précède J ; l'humeur du journal est notée dans la journée de J.
  const withNight = window.filter((d) => d.checkIn && d.mood);
  for (const [key, field, title, word] of [
    ['humeur', 'mood', 'Sommeil et humeur', 'ton humeur est notée'],
    ['stress', 'stress', 'Sommeil et stress', 'ton stress est noté'],
  ] as const) {
    const rows = withNight.filter((d) => scale(d.mood![field]));
    specs.push({
      id: `sommeil-${key}`,
      title,
      unit: 'scale5',
      labels: ['Après 7 h ou plus', 'Après une nuit plus courte'],
      a: rows.filter((d) => d.checkIn!.sleepHours >= 7).map((d) => d.mood![field]!),
      b: rows.filter((d) => d.checkIn!.sleepHours < 7).map((d) => d.mood![field]!),
      min: MIN_DAYS,
      threshold: 0.4,
      sentence: (a, b) => `Les jours qui suivent une nuit de 7 h ou plus, ${word} ${a} en moyenne, contre ${b} après une nuit plus courte.`,
    });
  }

  // Stress du jour J, nuit qui suit (check-in de J+1).
  const stressThenNight = window.filter((d) => scale(d.mood?.stress) && get(addDays(d.date, 1))?.checkIn && addDays(d.date, 1) <= today);
  specs.push({
    id: 'stress-sommeil',
    title: 'Stress et nuit suivante',
    unit: 'hours',
    labels: ['Après un stress de 4 ou 5', 'Après une journée plus calme'],
    a: stressThenNight.filter((d) => d.mood!.stress! >= 4).map((d) => get(addDays(d.date, 1))!.checkIn!.sleepHours),
    b: stressThenNight.filter((d) => d.mood!.stress! <= 3).map((d) => get(addDays(d.date, 1))!.checkIn!.sleepHours),
    min: MIN_DAYS,
    threshold: 1 / 3,
    sentence: (a, b) => `Après une journée où ton stress est noté 4 ou 5, tu dors en moyenne ${a}, contre ${b} après une journée plus calme.`,
  });

  for (const [key, field, title, word] of [
    ['humeur', 'mood', 'Séance et humeur', 'ton humeur est notée'],
    ['stress', 'stress', 'Séance et stress', 'ton stress est noté'],
  ] as const) {
    const rows = window.filter((d) => scale(d.mood?.[field]));
    specs.push({
      id: `seance-${key}`,
      title,
      unit: 'scale5',
      labels: ['Jours de séance', 'Autres jours'],
      a: rows.filter(trainingDay).map((d) => d.mood![field]!),
      b: rows.filter((d) => !trainingDay(d)).map((d) => d.mood![field]!),
      min: MIN_DAYS,
      threshold: 0.4,
      sentence: (a, b) => `Les jours de séance, ${word} ${a} en moyenne, contre ${b} les autres jours.`,
    });
  }

  const stressRows = window.filter((d) => scale(d.mood?.stress));
  specs.push({
    id: 'mind-stress',
    title: 'Pratique Mind et stress',
    unit: 'scale5',
    labels: ['Jours avec une pratique', 'Jours sans'],
    a: stressRows.filter((d) => d.mind.length > 0).map((d) => d.mood!.stress!),
    b: stressRows.filter((d) => d.mind.length === 0).map((d) => d.mood!.stress!),
    min: MIN_DAYS,
    threshold: 0.4,
    sentence: (a, b) => `Les jours où tu pratiques, ton stress est noté ${a} en moyenne, contre ${b} les jours sans pratique.`,
    caveat: 'Le lien peut aller dans les deux sens : on pratique souvent justement les jours plus tendus.',
  });

  // Volume d'une séance comparé à la moyenne de la même séance du programme, selon la nuit d'avant.
  const sessions = window.flatMap((d) => d.workouts.map((w) => ({ d, w })));
  const byTemplate = new Map<string, number[]>();
  for (const { w } of sessions) if (w.workout.templateId && w.volumeKg > 0) byTemplate.set(w.workout.templateId, [...(byTemplate.get(w.workout.templateId) ?? []), w.volumeKg]);
  const ratios = sessions.flatMap(({ d, w }) => {
    const list = w.workout.templateId ? byTemplate.get(w.workout.templateId) : undefined;
    if (!list || list.length < 2 || !d.checkIn || w.volumeKg <= 0) return [];
    return [{ sleep: d.checkIn.sleepHours, pct: (100 * w.volumeKg) / mean(list)! - 100 }];
  });
  specs.push({
    id: 'sommeil-seance',
    title: 'Sommeil et séance',
    unit: 'pct',
    labels: ['Après 7 h ou plus', 'Après une nuit plus courte'],
    a: ratios.filter((r) => r.sleep >= 7).map((r) => r.pct),
    b: ratios.filter((r) => r.sleep < 7).map((r) => r.pct),
    min: 4,
    threshold: 5,
    sentence: (a, b) => `Après une nuit de 7 h ou plus, le volume de tes séances est à ${a} de ta moyenne pour la même séance, contre ${b} après une nuit plus courte.`,
  });

  const found: Insight[] = [];
  const flat: InsightsResult['flat'] = [];
  const pending: InsightsResult['pending'] = [];
  const consider = (s: Spec) => {
    const total = s.a.length + s.b.length;
    if (total === 0) return;
    if (s.a.length < s.min || s.b.length < s.min) {
      pending.push({
        id: s.id,
        title: s.title,
        text: `Il faut au moins ${s.min} jours dans chaque groupe. Pour l’instant : ${s.a.length} (${s.labels[0].toLocaleLowerCase('fr-FR')}) et ${s.b.length} (${s.labels[1].toLocaleLowerCase('fr-FR')}).`,
      });
      return;
    }
    const a = mean(s.a)!;
    const b = mean(s.b)!;
    if (Math.abs(a - b) < s.threshold) {
      flat.push({ id: s.id, title: s.title, text: `Pas de différence nette pour l’instant (${formatInsightValue(a, s.unit)} et ${formatInsightValue(b, s.unit)}).` });
      return;
    }
    found.push({
      id: s.id,
      title: s.title,
      unit: s.unit,
      text: s.sentence(formatInsightValue(a, s.unit), formatInsightValue(b, s.unit)),
      a: { label: s.labels[0], value: a, n: s.a.length },
      b: { label: s.labels[1], value: b, n: s.b.length },
      caveat: s.caveat,
    });
  };
  specs.forEach(consider);

  // Tension notée avant et après les pratiques : une mesure directe, pas une comparaison de jours.
  const rated = window.flatMap((d) => d.mind).filter((s) => scale(s.tensionBefore) && scale(s.tensionAfter));
  if (rated.length > 0) {
    const before = mean(rated.map((s) => s.tensionBefore!))!;
    const after = mean(rated.map((s) => s.tensionAfter!))!;
    if (rated.length < 3)
      pending.push({
        id: 'mind-tension',
        title: 'Tension avant et après tes pratiques',
        text: `Il faut au moins 3 pratiques notées avant et après : ${rated.length} pour l’instant.`,
      });
    else if (before - after < 0.3)
      flat.push({ id: 'mind-tension', title: 'Tension avant et après tes pratiques', text: 'Pas de baisse nette de la tension notée pour l’instant.' });
    else
      found.push({
        id: 'mind-tension',
        title: 'Tension avant et après tes pratiques',
        unit: 'scale5',
        text: `Sur tes ${rated.length} pratiques notées, la tension passe en moyenne de ${formatInsightValue(before, 'scale5')} à ${formatInsightValue(after, 'scale5')}.`,
        a: { label: 'Avant', value: before, n: rated.length },
        b: { label: 'Après', value: after, n: rated.length },
      });
  }

  // Douleurs : intensité le lendemain d'une séance, comparée aux autres jours.
  for (const pain of data.pains.filter((p) => !p.deletedAt)) {
    const logs = pain.logs.filter((l) => l.date >= since && l.date <= today);
    if (logs.length < 2) continue;
    const after = logs.filter((l) => trainingDay(get(addDays(l.date, -1)))).map((l) => l.intensity);
    const other = logs.filter((l) => !trainingDay(get(addDays(l.date, -1)))).map((l) => l.intensity);
    const zone = zoneLabel(pain.zone);
    const title = `${zone} et séances`;
    const id = `douleur-${pain.id}`;
    if (after.length < MIN_PAIN_DAYS || other.length < MIN_PAIN_DAYS) {
      pending.push({
        id,
        title,
        text: `Il faut au moins ${MIN_PAIN_DAYS} notes le lendemain d’une séance et ${MIN_PAIN_DAYS} les autres jours. Pour l’instant : ${after.length} et ${other.length}.`,
      });
      continue;
    }
    const a = mean(after)!;
    const b = mean(other)!;
    if (Math.abs(a - b) < 1) {
      flat.push({
        id,
        title,
        text: `Pas de différence nette entre le lendemain d’une séance et les autres jours (${formatInsightValue(a, 'scale10')} et ${formatInsightValue(b, 'scale10')}).`,
      });
      continue;
    }
    found.push({
      id,
      title,
      unit: 'scale10',
      text: `${zone} : notée ${formatInsightValue(a, 'scale10')} en moyenne le lendemain d’une séance, contre ${formatInsightValue(b, 'scale10')} les autres jours.`,
      a: { label: 'Lendemain de séance', value: a, n: after.length },
      b: { label: 'Autres jours', value: b, n: other.length },
      caveat: 'Si une séance réveille la douleur, parles-en à un médecin ou à un kinésithérapeute avant de continuer les mouvements en cause.',
    });
  }

  return { days, found, flat, pending };
}
