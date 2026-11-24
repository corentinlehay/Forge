import { addDays } from '../lib/dates';
import { formatHours, formatNumber } from '../lib/format';
import type { NutritionTargets } from '../db/types';
import { ALERT_TEXT, painStatus, zoneLabel, type PainAlert } from './body';
import { dayWeight, isActiveDay, mean, targetsAt, type DayIndex, type DayRecord, type LifeData } from './lifeIndex';
import type { BadgeProgress } from './motivation';
import { findRecords, plannedPerWeek, weekStart } from './training';
import { recoveryScore } from './wellbeing';

/**
 * Bilan de la semaine (lundi à dimanche) : les chiffres, ce qui a avancé, et au plus trois pistes.
 * Repères généraux, jamais un avis médical ; une semaine sans données n'est pas un reproche.
 */
export interface WeekStats {
  start: string;
  end: string;
  /** Jours écoulés de la semaine (7 pour une semaine passée). */
  elapsed: number;
  activeDays: number;
  sessions: number;
  setCount: number;
  volumeKg: number;
  planned: number | null;
  records: { exerciseId: string; name: string; weightKg: number; reps: number; date: string }[];
  foodDays: number;
  avgKcal: number | null;
  avgProteinG: number | null;
  targets: NutritionTargets | null;
  /** Coût estimé des repas dont tous les prix sont connus. */
  costEur: number | null;
  weighIns: number;
  avgWeightKg: number | null;
  measured: boolean;
  nights: number;
  avgSleep: number | null;
  shortNights: number;
  avgRecovery: number | null;
  moodDays: number;
  mood: number | null;
  stress: number | null;
  mentalEnergy: number | null;
  mindSessions: number;
  mindMinutes: number;
  pains: { id: string; zone: string; current: number | null; trend: 'mieux' | 'stable' | 'pire' | null; alerts: PainAlert[]; resolvedInWeek: boolean }[];
}

const days7 = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

export function weekStats(index: DayIndex, data: LifeData, start: string, today: string): WeekStats {
  const end = addDays(start, 6);
  const dates = days7(start).filter((d) => d <= today);
  const recs = dates.map((d) => index.get(d)).filter((d): d is DayRecord => !!d);
  const foodRecs = recs.filter((d) => d.food.entries > 0);
  const nights = recs.flatMap((d) => (d.checkIn ? [d.checkIn] : []));
  const moods = recs.flatMap((d) => (d.mood ? [d.mood] : []));
  const scale = (k: 'mood' | 'stress' | 'mentalEnergy') => mean(moods.flatMap((m) => (typeof m[k] === 'number' ? [m[k]] : [])));
  const weights = recs.flatMap((d) => (dayWeight(d) !== null ? [dayWeight(d)!] : []));
  const mind = recs.flatMap((d) => d.mind);
  const records = findRecords(data.workouts, data.sets)
    .filter((r) => r.date >= start && r.date <= end && r.date <= today)
    .reverse()
    .map((r) => ({ exerciseId: r.exerciseId, name: data.exerciseName(r.exerciseId), weightKg: r.weightKg, reps: r.reps, date: r.date }));
  const costed = foodRecs.filter((d) => d.food.costKnown > 0);
  const lastDay = end < today ? end : today;
  const pains = data.pains
    .filter((p) => !p.deletedAt && p.startedOn <= lastDay && (p.resolvedOn === null || p.resolvedOn >= start))
    .map((p) => {
      const st = painStatus({ ...p, logs: p.logs.filter((l) => l.date <= lastDay), resolvedOn: p.resolvedOn && p.resolvedOn <= lastDay ? p.resolvedOn : null }, lastDay);
      return {
        id: p.id,
        zone: zoneLabel(p.zone),
        current: st.current,
        trend: st.trend,
        alerts: st.alerts,
        resolvedInWeek: !!p.resolvedOn && p.resolvedOn >= start && p.resolvedOn <= lastDay,
      };
    });
  return {
    start,
    end,
    elapsed: dates.length,
    activeDays: recs.filter(isActiveDay).length,
    sessions: recs.reduce((n, d) => n + d.workouts.length, 0),
    setCount: recs.reduce((n, d) => n + d.workouts.reduce((m, w) => m + w.setCount, 0), 0),
    volumeKg: recs.reduce((n, d) => n + d.workouts.reduce((m, w) => m + w.volumeKg, 0), 0),
    planned: data.templates.some((t) => !t.deletedAt) ? plannedPerWeek(data.templates) || null : null,
    records,
    foodDays: foodRecs.length,
    avgKcal: mean(foodRecs.map((d) => d.food.kcal)),
    avgProteinG: mean(foodRecs.map((d) => d.food.proteinG)),
    targets: targetsAt(data.targets, data.targetChanges, lastDay),
    costEur: costed.length ? costed.reduce((n, d) => n + d.food.costEur, 0) : null,
    weighIns: weights.length,
    avgWeightKg: mean(weights),
    measured: recs.some((d) => !!d.measurement),
    nights: nights.length,
    avgSleep: mean(nights.map((c) => c.sleepHours)),
    shortNights: nights.filter((c) => c.sleepHours < 7).length,
    avgRecovery: mean(nights.map(recoveryScore)),
    moodDays: moods.length,
    mood: scale('mood'),
    stress: scale('stress'),
    mentalEnergy: scale('mentalEnergy'),
    mindSessions: mind.length,
    mindMinutes: Math.round(mind.reduce((n, s) => n + s.durationSec / 60, 0)),
    pains,
  };
}

export interface ReviewLine {
  text: string;
  /** Piste concrète, repère général. */
  piste?: string;
  source?: string;
  to?: string;
}

export interface WeekReview {
  stats: WeekStats;
  previous: WeekStats;
  isCurrent: boolean;
  highlights: ReviewLine[];
  focus: ReviewLine[];
}

const n1 = (v: number) => formatNumber(v, 1);
const n0 = (v: number) => formatNumber(v, 0);
const kg = (v: number) => formatNumber(v, v % 1 ? 1 : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n0(n)} ${n > 1 ? many : one}`;

export const SLEEP_SOURCE = 'AASM et SRS (Watson et al., 2015)';

export function weekReview(index: DayIndex, data: LifeData, start: string, today: string, badges: readonly BadgeProgress[] = []): WeekReview {
  const stats = weekStats(index, data, start, today);
  const previous = weekStats(index, data, addDays(start, -7), today);
  const isCurrent = start === weekStart(today);
  const complete = stats.end < today;
  const s = stats;

  const highlights: ReviewLine[] = [];
  if (s.records.length) {
    const [r] = s.records;
    const more = s.records.length - 1;
    highlights.push({
      text: `${plural(s.records.length, 'record')} : ${r!.name}, ${kg(r!.weightKg)} kg × ${r!.reps}${more ? `, et ${plural(more, 'autre')}` : ''}.`,
      to: '/progression?vue=entrainement',
    });
  }
  if (s.sessions > 0) {
    highlights.push({
      text:
        s.planned && s.sessions >= s.planned
          ? `${plural(s.sessions, 'séance')} sur ${s.planned} prévues, ${n0(s.volumeKg)} kg soulevés.`
          : `${plural(s.sessions, 'séance')}, ${n0(s.volumeKg)} kg soulevés.`,
      to: '/training',
    });
  }
  for (const badge of badges.filter((p) => p.earnedOn && p.earnedOn >= s.start && p.earnedOn <= s.end))
    highlights.push({ text: `Nouveau badge : ${badge.def.title}.`, to: '/progression/bilans?vue=badges' });
  for (const p of s.pains.filter((p) => p.resolvedInWeek)) highlights.push({ text: `Douleur passée : ${p.zone.toLocaleLowerCase('fr-FR')}.`, to: `/progression/douleur/${p.id}` });
  for (const p of s.pains.filter((p) => !p.resolvedInWeek && p.trend === 'mieux')) highlights.push({ text: `${p.zone} : la douleur diminue.`, to: `/progression/douleur/${p.id}` });
  if (s.nights >= 3 && s.avgSleep !== null && s.avgSleep >= 7)
    highlights.push({ text: `Sommeil : ${formatHours(s.avgSleep)} en moyenne sur ${plural(s.nights, 'nuit')}.`, to: '/mind/sommeil' });
  if (s.mindSessions >= 2) highlights.push({ text: `${plural(s.mindSessions, 'pratique')} Mind, ${plural(s.mindMinutes, 'minute')}.`, to: '/mind' });
  if (s.foodDays >= 3 && s.targets && s.avgProteinG !== null && s.avgProteinG >= 0.95 * s.targets.proteinG)
    highlights.push({ text: `Protéines au rendez-vous : ${n0(s.avgProteinG)} g par jour en moyenne pour ${n0(s.targets.proteinG)} g visés.`, to: '/nutrition' });
  if (s.mood !== null && previous.mood !== null && s.moodDays >= 3 && previous.moodDays >= 3 && s.mood >= previous.mood + 0.4)
    highlights.push({ text: `Humeur en hausse : ${n1(s.mood)}/5 en moyenne, contre ${n1(previous.mood)}/5 la semaine d’avant.`, to: '/mind/journal' });
  if (s.foodDays >= 5) highlights.push({ text: `Repas notés ${s.foodDays} jours sur ${s.elapsed}.`, to: '/nutrition' });

  const focus: ReviewLine[] = [];
  for (const p of s.pains.filter((p) => p.alerts.length && !p.resolvedInWeek)) {
    focus.push({ text: `${p.zone} : douleur à surveiller.`, piste: ALERT_TEXT[p.alerts[0]!], to: `/progression/douleur/${p.id}` });
  }
  if (s.nights >= 3 && s.avgSleep !== null && s.avgSleep < 7) {
    focus.push({
      text: `Sommeil : ${formatHours(s.avgSleep)} en moyenne sur ${plural(s.nights, 'nuit')}.`,
      piste: 'Repère : au moins 7 h par nuit pour un adulte. Avancer le coucher de 20 à 30 minutes et garder des horaires réguliers aide souvent.',
      source: SLEEP_SOURCE,
      to: '/mind/sommeil',
    });
  }
  if (s.moodDays >= 3 && s.stress !== null && s.stress >= 3.5) {
    focus.push({
      text: `Stress noté ${n1(s.stress)}/5 en moyenne.`,
      piste: 'Quelques minutes de respiration lente, comme la cohérence cardiaque, peuvent aider à relâcher la pression sur le moment.',
      to: '/mind/exercice/coherence',
    });
  }
  if (s.foodDays >= 3 && s.targets && s.avgProteinG !== null && s.avgProteinG < 0.85 * s.targets.proteinG) {
    focus.push({
      text: `Protéines : ${n0(s.avgProteinG)} g par jour en moyenne pour ${n0(s.targets.proteinG)} g visés.`,
      piste: 'Une source de protéines à chaque repas aide à atteindre ton objectif.',
      to: '/nutrition',
    });
  }
  if (s.foodDays >= 4 && s.targets && s.avgKcal !== null && Math.abs(s.avgKcal - s.targets.kcal) > 0.15 * s.targets.kcal) {
    const under = s.avgKcal < s.targets.kcal;
    focus.push({
      text: `Calories : ${n0(s.avgKcal)} kcal par jour en moyenne pour ${n0(s.targets.kcal)} visées.`,
      piste: under
        ? 'Si certains repas n’ont pas été notés en entier, la moyenne est sous-estimée : vérifie les jours concernés dans Nutrition.'
        : 'Regarde dans Nutrition quels repas pèsent le plus : c’est souvent là que l’ajustement est le plus simple.',
      to: '/nutrition',
    });
  }
  if (complete && s.planned && s.sessions <= s.planned - 2) {
    focus.push({
      text: `Semaine plus légère : ${plural(s.sessions, 'séance')} sur ${s.planned} prévues.`,
      piste: 'Ça arrive. Si c’est souvent le cas, un programme avec moins de séances par semaine tiendra mieux dans ton agenda.',
      to: '/training',
    });
  }
  if (complete && data.weighIns.some((w) => !w.deletedAt) && s.weighIns > 0 && s.weighIns < 3) {
    focus.push({
      text: `${plural(s.weighIns, 'pesée')} cette semaine.`,
      piste: 'La moyenne sur 7 jours devient fiable avec 3 ou 4 pesées, le matin à jeun.',
      to: '/progression',
    });
  }

  return { stats, previous, isCurrent, highlights: highlights.slice(0, 5), focus: focus.slice(0, 3) };
}

/** Semaines de l'historique, de la plus récente à la plus ancienne, depuis la première donnée notée. */
export function reviewWeeks(index: DayIndex, today: string): string[] {
  const first = [...index.values()].filter((d) => d.date <= today && isActiveDay(d)).reduce<string | null>((m, d) => (m === null || d.date < m ? d.date : m), null);
  const current = weekStart(today);
  if (!first) return [current];
  const out: string[] = [];
  for (let w = current; w >= weekStart(first); w = addDays(w, -7)) out.push(w);
  return out;
}
