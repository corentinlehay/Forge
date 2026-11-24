import { addDays } from '../lib/dates';
import { isActiveDay, type DayIndex, type LifeData } from './lifeIndex';
import { findRecords, weekStart } from './training';

/**
 * Motivation sans culpabilisation : des paliers cumulés qui ne se perdent jamais
 * (une pause ne remet rien à zéro), et une régularité comptée en semaines actives, pas en série à tenir.
 */
export type BadgeFamily = 'training' | 'nutrition' | 'corps' | 'mind' | 'regularite';

export const BADGE_FAMILIES: { key: BadgeFamily; label: string }[] = [
  { key: 'training', label: 'Training' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'corps', label: 'Corps et récupération' },
  { key: 'mind', label: 'Mind' },
  { key: 'regularite', label: 'Régularité' },
];

type Counter = 'seances' | 'records' | 'tonnage' | 'joursRepas' | 'joursPesee' | 'mensurations' | 'checkins' | 'pratiques' | 'minutesMind' | 'joursJournal' | 'semainesActives';

export interface BadgeDef {
  id: string;
  family: BadgeFamily;
  title: string;
  counter: Counter;
  target: number;
}

const b = (id: string, family: BadgeFamily, title: string, counter: Counter, target: number): BadgeDef => ({ id, family, title, counter, target });

export const BADGES: BadgeDef[] = [
  b('seance-1', 'training', 'Première séance', 'seances', 1),
  b('seances-10', 'training', '10 séances', 'seances', 10),
  b('seances-25', 'training', '25 séances', 'seances', 25),
  b('seances-50', 'training', '50 séances', 'seances', 50),
  b('seances-100', 'training', '100 séances', 'seances', 100),
  b('record-1', 'training', 'Premier record', 'records', 1),
  b('records-10', 'training', '10 records', 'records', 10),
  b('records-25', 'training', '25 records', 'records', 25),
  b('tonnes-10', 'training', '10 tonnes soulevées', 'tonnage', 10_000),
  b('tonnes-100', 'training', '100 tonnes soulevées', 'tonnage', 100_000),
  b('tonnes-500', 'training', '500 tonnes soulevées', 'tonnage', 500_000),
  b('repas-1', 'nutrition', 'Premier jour noté', 'joursRepas', 1),
  b('repas-7', 'nutrition', '7 jours de repas notés', 'joursRepas', 7),
  b('repas-30', 'nutrition', '30 jours de repas notés', 'joursRepas', 30),
  b('repas-100', 'nutrition', '100 jours de repas notés', 'joursRepas', 100),
  b('pesee-1', 'corps', 'Première pesée', 'joursPesee', 1),
  b('pesees-30', 'corps', '30 jours de pesée', 'joursPesee', 30),
  b('pesees-100', 'corps', '100 jours de pesée', 'joursPesee', 100),
  b('mesures-1', 'corps', 'Premières mensurations', 'mensurations', 1),
  b('checkins-7', 'corps', '7 check-ins', 'checkins', 7),
  b('checkins-30', 'corps', '30 check-ins', 'checkins', 30),
  b('checkins-100', 'corps', '100 check-ins', 'checkins', 100),
  b('pratique-1', 'mind', 'Première pratique', 'pratiques', 1),
  b('pratiques-10', 'mind', '10 pratiques', 'pratiques', 10),
  b('pratiques-50', 'mind', '50 pratiques', 'pratiques', 50),
  b('minutes-60', 'mind', '1 heure de pratique', 'minutesMind', 60),
  b('minutes-600', 'mind', '10 heures de pratique', 'minutesMind', 600),
  b('journal-7', 'mind', '7 jours de journal', 'joursJournal', 7),
  b('journal-30', 'mind', '30 jours de journal', 'joursJournal', 30),
  b('semaines-4', 'regularite', '4 semaines actives', 'semainesActives', 4),
  b('semaines-12', 'regularite', '12 semaines actives', 'semainesActives', 12),
  b('semaines-26', 'regularite', '26 semaines actives', 'semainesActives', 26),
  b('semaines-52', 'regularite', '52 semaines actives', 'semainesActives', 52),
];

/** Une semaine active : au moins 3 jours avec une donnée notée, dans n'importe quel espace. */
export const ACTIVE_WEEK_DAYS = 3;

export interface BadgeProgress {
  def: BadgeDef;
  value: number;
  /** Jour où le palier a été atteint, null s'il ne l'est pas encore. */
  earnedOn: string | null;
}

/** Événements datés et leur poids (1 par événement, ou kilos, minutes). */
type Events = { date: string; amount: number }[];

function counters(index: DayIndex, data: LifeData, today: string): Record<Counter, Events> {
  const days = [...index.values()].filter((d) => d.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const each = (pick: (d: (typeof days)[number]) => number): Events => days.flatMap((d) => (pick(d) > 0 ? [{ date: d.date, amount: pick(d) }] : []));
  const weeks = new Map<string, number>();
  for (const d of days) if (isActiveDay(d)) weeks.set(weekStart(d.date), (weeks.get(weekStart(d.date)) ?? 0) + 1);
  const activeWeeks: Events = [...weeks.entries()]
    .filter(([, n]) => n >= ACTIVE_WEEK_DAYS)
    .map(([start]) => ({ date: start, amount: 1 }))
    .sort((a, b) => a.date.localeCompare(b.date));
  // La semaine compte le jour où elle devient active : le 3e jour actif.
  for (const w of activeWeeks) {
    const active = days.filter((d) => d.date >= w.date && d.date <= addDays(w.date, 6) && isActiveDay(d));
    w.date = active[ACTIVE_WEEK_DAYS - 1]?.date ?? w.date;
  }
  return {
    seances: each((d) => d.workouts.length),
    records: findRecords(data.workouts, data.sets)
      .filter((r) => r.date <= today)
      .map((r) => ({ date: r.date, amount: 1 }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    tonnage: each((d) => d.workouts.reduce((n, w) => n + w.volumeKg, 0)),
    joursRepas: each((d) => (d.food.entries > 0 ? 1 : 0)),
    joursPesee: each((d) => (d.weighIns.length > 0 ? 1 : 0)),
    mensurations: each((d) => (d.measurement ? 1 : 0)),
    checkins: each((d) => (d.checkIn ? 1 : 0)),
    pratiques: each((d) => d.mind.length),
    minutesMind: each((d) => d.mind.reduce((n, s) => n + s.durationSec / 60, 0)),
    joursJournal: each((d) => (d.mood ? 1 : 0)),
    semainesActives: activeWeeks,
  };
}

export function badgeProgress(index: DayIndex, data: LifeData, today: string): BadgeProgress[] {
  const all = counters(index, data, today);
  return BADGES.map((def) => {
    let value = 0;
    let earnedOn: string | null = null;
    for (const e of all[def.counter]) {
      value += e.amount;
      if (earnedOn === null && value >= def.target - 1e-9) earnedOn = e.date;
    }
    return { def, value: Math.floor(value), earnedOn };
  });
}

/** Le prochain palier de chaque famille (un seul), pour montrer le chemin sans pression. */
export function nextBadges(progress: readonly BadgeProgress[]): BadgeProgress[] {
  return BADGE_FAMILIES.flatMap((f) => progress.find((p) => p.def.family === f.key && !p.earnedOn) ?? []);
}

export interface RegularityWeek {
  start: string;
  activeDays: number;
  active: boolean;
  current: boolean;
}

/** Les `weeks` dernières semaines (la semaine en cours comprise), de la plus ancienne à la plus récente. */
export function regularity(index: DayIndex, today: string, weeks = 12): RegularityWeek[] {
  const current = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(current, -7 * (weeks - 1 - i));
    let activeDays = 0;
    for (let k = 0; k < 7; k++) {
      const date = addDays(start, k);
      if (date <= today && isActiveDay(index.get(date))) activeDays++;
    }
    return { start, activeDays, active: activeDays >= ACTIVE_WEEK_DAYS, current: start === current };
  });
}
