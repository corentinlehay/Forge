import { addDays } from '../lib/dates';
import { formatHours, formatLitres, formatMeasuredKg, formatNumber } from '../lib/format';
import { zoneLabel } from './body';
import type { DayRecord, LifeData } from './lifeIndex';
import { formatDuration } from './mind';
import { MEAL_LABELS } from './nutrition';
import { isoWeekday, templateForDay } from './training';
import { recoveryScore } from './wellbeing';

/** Calendrier global : chaque jour, ce qui a été fait (et, à venir, ce qui est prévu) dans les quatre espaces. */
export type CalModule = 'training' | 'nutrition' | 'corps' | 'mind';
export const CAL_MODULES: { key: CalModule; label: string }[] = [
  { key: 'training', label: 'Training' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'corps', label: 'Corps et récup' },
  { key: 'mind', label: 'Mind' },
];

export interface CalItem {
  module: CalModule;
  title: string;
  detail?: string;
  to?: string;
  planned?: boolean;
}

const kcal = (v: number) => `${formatNumber(v, 0)} kcal`;

export function dayItems(d: DayRecord | undefined, date: string, today: string, data: Pick<LifeData, 'templates' | 'recipeName'>): CalItem[] {
  const items: CalItem[] = [];
  for (const w of d?.workouts ?? []) {
    items.push({
      module: 'training',
      title: w.workout.name,
      detail: `${w.setCount} série${w.setCount > 1 ? 's' : ''}, ${formatNumber(w.volumeKg, 0)} kg`,
      to: `/training/seance/${w.workout.id}`,
    });
  }
  // Une séance prévue n'apparaît qu'à venir : un jour passé sans séance n'est pas un manque à signaler.
  if (date >= today && !d?.workouts.length) {
    const t = templateForDay(data.templates, date);
    if (t) items.push({ module: 'training', title: `Prévu : ${t.name}`, to: `/training/programme/${t.id}`, planned: true });
  }
  if (d && d.food.entries > 0)
    items.push({ module: 'nutrition', title: 'Repas notés', detail: `${kcal(d.food.kcal)}, ${formatNumber(d.food.proteinG, 0)} g de protéines`, to: `/nutrition?jour=${date}` });
  if (d && d.waterMl > 0) items.push({ module: 'nutrition', title: 'Boissons', detail: formatLitres(d.waterMl), to: `/nutrition?jour=${date}` });
  for (const p of d?.plans ?? [])
    items.push({ module: 'nutrition', title: `Au menu : ${data.recipeName(p.recipeKey)}`, detail: MEAL_LABELS[p.meal], to: `/nutrition/recettes/${p.recipeKey}`, planned: true });
  if (d?.weighIns.length) items.push({ module: 'corps', title: 'Pesée', detail: formatMeasuredKg(d.weighIns[0]!.weightKg), to: '/progression' });
  if (d?.measurement) items.push({ module: 'corps', title: 'Mensurations', to: '/progression/mensurations' });
  if (d?.checkIn)
    items.push({
      module: 'corps',
      title: 'Check-in',
      detail:
        [
          d.checkIn.sleepHours !== null ? `Nuit de ${formatHours(d.checkIn.sleepHours)}` : null,
          recoveryScore(d.checkIn) !== null ? `récupération ${recoveryScore(d.checkIn)}/100` : null,
        ]
          .filter(Boolean)
          .join(', ')
          .replace(/^r/, 'R') || 'Réponses passées',
      to: '/progression?vue=bien-etre',
    });
  for (const { pain, log } of d?.painLogs ?? [])
    items.push({ module: 'corps', title: `Douleur : ${zoneLabel(pain.zone).toLocaleLowerCase('fr-FR')}`, detail: `${log.intensity}/10`, to: `/progression/douleur/${pain.id}` });
  if (d?.mood) {
    const parts = [d.mood.mood && `humeur ${d.mood.mood}/5`, d.mood.stress && `stress ${d.mood.stress}/5`].filter(Boolean) as string[];
    items.push({
      module: 'mind',
      title: 'Journal',
      detail: parts.length ? parts.join(', ').replace(/^./, (c) => c.toLocaleUpperCase('fr-FR')) : undefined,
      to: `/mind/journal?jour=${date}`,
    });
  }
  for (const s of d?.mind ?? []) {
    const to = s.kind === 'exercise' ? `/mind/exercice/${s.ref}` : s.kind === 'routine' ? `/mind/routine/${s.ref}` : `/mind/audio/${s.ref}`;
    items.push({ module: 'mind', title: s.title, detail: formatDuration(s.durationSec), to });
  }
  return items;
}

/** Espaces présents ce jour-là : réalisés (done) et prévus seulement (planned). */
export function dayModules(items: readonly CalItem[]): { done: Set<CalModule>; planned: Set<CalModule> } {
  const done = new Set(items.filter((i) => !i.planned).map((i) => i.module));
  const planned = new Set(items.filter((i) => i.planned && !done.has(i.module)).map((i) => i.module));
  return { done, planned };
}

/** Grille d'un mois (AAAA-MM) en semaines du lundi au dimanche. */
export function monthGrid(month: string): { date: string; inMonth: boolean }[][] {
  const first = `${month}-01`;
  const start = addDays(first, -(isoWeekday(first) - 1));
  const weeks: { date: string; inMonth: boolean }[][] = [];
  for (let w = start; w.slice(0, 7) <= month; w = addDays(w, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)).map((date) => ({ date, inMonth: date.slice(0, 7) === month })));
  }
  return weeks;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
