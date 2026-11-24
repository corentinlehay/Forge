import { describe, expect, it } from 'vitest';
import type { CheckIn, FoodEntry, MindSession, MoodLog, Pain, Scale5, TargetChange, WeighIn, Workout, WorkoutSet, WorkoutTemplate } from '../db/types';
import { addDays } from '../lib/dates';
import { dayItems, dayModules, monthGrid, shiftMonth } from './calendar';
import { crossInsights } from './insights';
import { buildDayIndex, isActiveDay, targetsAt, type LifeData } from './lifeIndex';
import { badgeProgress, nextBadges, regularity } from './motivation';
import { reviewWeeks, weekReview, weekStats } from './review';

const sync = (id: string) => ({ id, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null });
const TODAY = '2026-11-25'; // mercredi
const MONDAY = '2026-11-23';

function data(over: Partial<LifeData> = {}): LifeData {
  return {
    workouts: [],
    sets: [],
    templates: [],
    foodEntries: [],
    waterLogs: [],
    targets: null,
    targetChanges: [],
    weighIns: [],
    measurements: [],
    checkIns: [],
    moodLogs: [],
    mindSessions: [],
    pains: [],
    mealPlans: [],
    exerciseName: (id) => (id === 'dc' ? 'Développé couché' : id),
    recipeName: (k) => `Recette ${k}`,
    ...over,
  };
}

const workout = (id: string, date: string, templateId: string | null = null): Workout => ({
  ...sync(id),
  date,
  name: `Séance ${id}`,
  templateId,
  exerciseIds: ['dc'],
  startedAt: `${date}T18:00:00.000Z`,
  endedAt: `${date}T19:00:00.000Z`,
});
const set = (id: string, workoutId: string, weightKg: number, reps: number): WorkoutSet => ({ ...sync(id), workoutId, exerciseId: 'dc', position: 0, weightKg, reps });
const checkIn = (date: string, sleepHours: number): CheckIn => ({ ...sync(`c${date}`), date, sleepHours, energy: 3, fatigue: 3, soreness: 2 });
const mood = (date: string, m: number, stress = 3): MoodLog => ({ ...sync(`m${date}`), date, mood: m as Scale5, stress: stress as Scale5 });
const food = (date: string, kcal: number, proteinG: number): FoodEntry => ({ ...sync(`f${date}${kcal}`), date, meal: 'lunch', name: 'Repas', kcal, proteinG, carbsG: 0, fatG: 0 });
const weigh = (date: string, weightKg: number): WeighIn => ({ ...sync(`w${date}`), date, time: '07:00', weightKg });
const practice = (id: string, date: string, minutes: number, before?: number, after?: number): MindSession => ({
  ...sync(id),
  date,
  time: '08:00',
  kind: 'exercise',
  ref: 'coherence',
  title: 'Cohérence cardiaque',
  durationSec: minutes * 60,
  completed: true,
  tensionBefore: before as Scale5 | undefined,
  tensionAfter: after as Scale5 | undefined,
});

describe('index des jours', () => {
  it('range chaque donnée à son jour et repère les jours actifs', () => {
    const idx = buildDayIndex(
      data({ workouts: [workout('a', MONDAY), { ...workout('b', MONDAY), endedAt: null }], sets: [set('s1', 'a', 80, 5)], foodEntries: [food(TODAY, 600, 40)] }),
    );
    expect(idx.get(MONDAY)?.workouts).toHaveLength(1);
    expect(idx.get(MONDAY)?.workouts[0]?.volumeKg).toBe(400);
    expect(isActiveDay(idx.get(TODAY))).toBe(true);
    expect(isActiveDay(idx.get('2026-11-24'))).toBe(false);
  });

  it('lit l’objectif nutritionnel en vigueur à une date passée', () => {
    const t1 = { kcal: 2500, proteinG: 150, carbsG: 250, fatG: 80 };
    const t2 = { kcal: 2800, proteinG: 160, carbsG: 300, fatG: 85 };
    const change: TargetChange = { ...sync('t'), date: '2026-11-10', before: t1, after: t2, source: 'manuel' };
    expect(targetsAt(t2, [change], '2026-11-01')).toEqual(t1);
    expect(targetsAt(t2, [change], '2026-11-12')).toEqual(t2);
    expect(targetsAt(t2, [], '2026-11-01')).toEqual(t2);
  });
});

describe('bilan de la semaine', () => {
  it('compte les séances, records, nuits, repas et pesées de la semaine seulement', () => {
    const d = data({
      workouts: [workout('a', '2026-11-16'), workout('b', MONDAY)],
      sets: [set('s1', 'a', 80, 5), set('s2', 'b', 85, 5)],
      checkIns: [checkIn(MONDAY, 7.5), checkIn('2026-11-24', 6.5), checkIn(TODAY, 8)],
      foodEntries: [food(MONDAY, 2000, 100), food(MONDAY, 600, 40), food('2026-11-24', 2400, 150)],
      weighIns: [weigh(MONDAY, 80), weigh(TODAY, 81)],
      targets: { kcal: 2500, proteinG: 150, carbsG: 250, fatG: 80 },
    });
    const s = weekStats(buildDayIndex(d), d, MONDAY, TODAY);
    expect(s.elapsed).toBe(3);
    expect(s.sessions).toBe(1);
    expect(s.records.map((r) => r.name)).toEqual(['Développé couché']);
    expect(s.avgSleep).toBeCloseTo(22 / 3);
    expect(s.shortNights).toBe(1);
    expect(s.foodDays).toBe(2);
    expect(s.avgKcal).toBe(2500);
    expect(s.avgProteinG).toBe(145);
    expect(s.avgWeightKg).toBe(80.5);
  });

  it('souligne ce qui a avancé et donne au plus trois pistes, avec la source du repère sommeil', () => {
    const nights = [5.5, 6, 6.5, 6, 6.25, 6, 6].map((h, i) => checkIn(addDays('2026-11-16', i), h));
    const moods = [0, 1, 2, 3].map((i) => mood(addDays('2026-11-16', i), 3, 4));
    const d = data({ checkIns: nights, moodLogs: moods, mindSessions: [practice('p1', '2026-11-17', 5), practice('p2', '2026-11-18', 10)] });
    const r = weekReview(buildDayIndex(d), d, '2026-11-16', TODAY);
    expect(r.isCurrent).toBe(false);
    expect(r.highlights.map((h) => h.text)).toContain('2 pratiques Mind, 15 minutes.');
    expect(r.focus[0]?.text).toBe('Sommeil : 6 h 02 en moyenne sur 7 nuits.');
    expect(r.focus[0]?.source).toMatch(/Watson/);
    expect(r.focus[1]?.to).toBe('/mind/exercice/coherence');
  });

  it('ne signale pas les séances manquées d’une semaine en cours', () => {
    const tpl: WorkoutTemplate = { ...sync('t1'), name: 'Haut', weekdays: [1, 3, 5, 6], exercises: [], position: 0 };
    const d = data({ templates: [tpl], workouts: [], checkIns: [checkIn(MONDAY, 8)] });
    expect(weekReview(buildDayIndex(d), d, MONDAY, TODAY).focus).toEqual([]);
    const past = weekReview(buildDayIndex(d), d, '2026-11-16', TODAY);
    expect(past.focus.map((f) => f.text)).toEqual(['Semaine plus légère : 0 séance sur 4 prévues.']);
  });

  it('remonte une douleur avec un signe d’alerte en premier', () => {
    const pain: Pain = { ...sync('p'), zone: 'genou-d', startedOn: MONDAY, resolvedOn: null, activities: [], logs: [{ date: MONDAY, intensity: 8 }] };
    const d = data({ pains: [pain] });
    const r = weekReview(buildDayIndex(d), d, MONDAY, TODAY);
    expect(r.focus[0]?.to).toBe('/progression/douleur/p');
    expect(r.focus[0]?.piste).toMatch(/médecin/);
  });

  it('liste les semaines depuis la première donnée', () => {
    const d = data({ weighIns: [weigh('2026-11-04', 80)] });
    expect(reviewWeeks(buildDayIndex(d), TODAY)).toEqual(['2026-11-23', '2026-11-16', '2026-11-09', '2026-11-02']);
    expect(reviewWeeks(buildDayIndex(data()), TODAY)).toEqual(['2026-11-23']);
  });
});

describe('liens entre les données', () => {
  const days = Array.from({ length: 20 }, (_, i) => addDays(TODAY, -i));

  it('compare l’humeur après les bonnes nuits et les nuits courtes', () => {
    const d = data({
      checkIns: days.map((day, i) => checkIn(day, i % 2 ? 8 : 6)),
      moodLogs: days.map((day, i) => mood(day, i % 2 ? 4 : 3)),
    });
    const r = crossInsights(buildDayIndex(d), d, TODAY);
    const sleepMood = r.found.find((f) => f.id === 'sommeil-humeur');
    expect(sleepMood?.a).toEqual({ label: 'Après 7 h ou plus', value: 4, n: 10 });
    expect(sleepMood?.text).toBe('Les jours qui suivent une nuit de 7 h ou plus, ton humeur est notée 4,0/5 en moyenne, contre 3,0/5 après une nuit plus courte.');
    expect(r.flat.map((f) => f.id)).toContain('sommeil-stress');
  });

  it('attend d’avoir assez de jours dans chaque groupe', () => {
    const d = data({ checkIns: days.slice(0, 6).map((day) => checkIn(day, 8)), moodLogs: days.slice(0, 6).map((day) => mood(day, 4)) });
    const r = crossInsights(buildDayIndex(d), d, TODAY);
    expect(r.found).toEqual([]);
    expect(r.pending.find((p) => p.id === 'sommeil-humeur')?.text).toBe(
      'Il faut au moins 5 jours dans chaque groupe. Pour l’instant : 6 (après 7 h ou plus) et 0 (après une nuit plus courte).',
    );
  });

  it('mesure la tension avant et après les pratiques', () => {
    const d = data({ mindSessions: [1, 2, 3].map((k) => practice(`p${k}`, days[k]!, 5, 4, 2)) });
    const r = crossInsights(buildDayIndex(d), d, TODAY);
    expect(r.found[0]?.text).toBe('Sur tes 3 pratiques notées, la tension passe en moyenne de 4,0/5 à 2,0/5.');
  });

  it('compare une douleur le lendemain des séances et les autres jours', () => {
    const train = [10, 8, 6, 4].map((k) => workout(`w${k}`, days[k]!));
    const logs = days.slice(0, 12).map((date) => ({ date, intensity: [9, 7, 5, 3].some((k) => days[k] === date) ? 5 : 2 }));
    const pain: Pain = { ...sync('dos'), zone: 'bas-dos', startedOn: days[11]!, resolvedOn: null, activities: [], logs };
    const d = data({ workouts: train, pains: [pain] });
    const r = crossInsights(buildDayIndex(d), d, TODAY);
    expect(r.found.find((f) => f.id === 'douleur-dos')?.text).toBe('Bas du dos : notée 5,0/10 en moyenne le lendemain d’une séance, contre 2,0/10 les autres jours.');
  });
});

describe('calendrier', () => {
  const tpl: WorkoutTemplate = { ...sync('t1'), name: 'Haut A', weekdays: [3], exercises: [], position: 0 };

  it('montre le prévu à venir, jamais un jour passé sans séance', () => {
    const d = data({ templates: [tpl] });
    expect(dayItems(undefined, TODAY, TODAY, d).map((i) => i.title)).toEqual(['Prévu : Haut A']);
    expect(dayItems(undefined, '2026-11-18', TODAY, d)).toEqual([]);
  });

  it('sépare le réalisé du prévu par espace', () => {
    const d = data({ templates: [tpl], workouts: [workout('a', TODAY)], checkIns: [checkIn(TODAY, 7)] });
    const items = dayItems(buildDayIndex(d).get(TODAY), TODAY, TODAY, d);
    expect(items.map((i) => i.title)).toEqual(['Séance a', 'Check-in']);
    expect(dayModules(items).done).toEqual(new Set(['training', 'corps']));
  });

  it('découpe un mois en semaines du lundi au dimanche', () => {
    const grid = monthGrid('2026-11');
    expect(grid[0]?.[0]).toEqual({ date: '2026-10-26', inMonth: false });
    expect(grid.at(-1)?.[0]?.date).toBe('2026-11-30');
    expect(grid).toHaveLength(6);
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('badges et régularité', () => {
  it('date chaque palier le jour où il est atteint, sans jamais le retirer', () => {
    const ws = Array.from({ length: 12 }, (_, i) => workout(`w${i}`, addDays('2026-09-01', i * 3)));
    const d = data({ workouts: ws });
    const p = badgeProgress(buildDayIndex(d), d, TODAY);
    expect(p.find((b) => b.def.id === 'seance-1')?.earnedOn).toBe('2026-09-01');
    expect(p.find((b) => b.def.id === 'seances-10')?.earnedOn).toBe('2026-09-28');
    expect(p.find((b) => b.def.id === 'seances-25')).toMatchObject({ value: 12, earnedOn: null });
    expect(nextBadges(p).map((b) => b.def.id)).toEqual(['seances-25', 'repas-1', 'pesee-1', 'pratique-1', 'semaines-4']);
  });

  it('compte une semaine active à partir de trois jours notés', () => {
    const d = data({ weighIns: [MONDAY, '2026-11-24', TODAY, '2026-11-16'].map((day) => weigh(day, 80)) });
    const weeks = regularity(buildDayIndex(d), TODAY, 2);
    expect(weeks).toEqual([
      { start: '2026-11-16', activeDays: 1, active: false, current: false },
      { start: '2026-11-23', activeDays: 3, active: true, current: true },
    ]);
  });
});
