import { describe, expect, it } from 'vitest';
import type { Activity, CheckIn, Exercise, FoodEntry, MindSession, Program, WeekNote, Workout, WorkoutSet, WorkoutTemplate } from '../../db/types';
import { addDays } from '../../lib/dates';
import type { MuscleResolver } from '../muscleVolume';
import { PRIORITY_MUSCLES } from '../plan';
import { badgeUnlocks } from './badges';
import { characteristics } from './characteristics';
import { computeLevel } from './level';
import { baseXpEvents, buildModel, levelFor, levelUps, xpForLevel, type LevelInput } from './xp';

const T = '2026-01-01T08:00:00.000Z';
const sync = (id: string, createdAt = T) => ({ id, createdAt, updatedAt: createdAt, deletedAt: null });
// Le 5 octobre 2026 est un lundi.
const MONDAY = '2026-10-05';
const ex = (id: string, kind: 'compound' | 'isolation' = 'compound'): Exercise => ({ ...sync(id), name: id, kind, muscle: 'pectoraux' }) as unknown as Exercise;
const tpl = (id: string, weekdays: number[]): WorkoutTemplate =>
  ({ ...sync(id), name: id, weekdays, exercises: [{ exerciseId: 'bench', sets: 3, reps: '8-12', restSec: 120, rir: 2 }], position: 0, programId: 'p' }) as WorkoutTemplate;
const workout = (id: string, date: string, templateId: string | null = 'A', extra: Partial<Workout> = {}): Workout =>
  ({
    ...sync(id),
    date,
    name: templateId ?? 'Libre',
    templateId,
    exerciseIds: [],
    startedAt: `${date}T18:00:00.000Z`,
    endedAt: `${date}T19:00:00.000Z`,
    programId: 'p',
    ...extra,
  }) as Workout;
const sets = (workoutId: string, weightKg: number, reps: number, n = 3, exerciseId = 'bench'): WorkoutSet[] =>
  Array.from({ length: n }, (_, i) => ({ ...sync(`${workoutId}-${exerciseId}-${i}`), workoutId, exerciseId, position: i, weightKg, reps }) as WorkoutSet);
const program = (extra: Partial<Program> = {}): Program =>
  ({ ...sync('p'), name: 'Prog', active: true, status: 'actif', startDate: MONDAY, durationWeeks: 4, ...extra }) as Program;

const empty = (today: string): LevelInput => ({
  workouts: [],
  sets: [],
  exercises: [ex('bench'), ex('curl', 'isolation')],
  templates: [],
  programs: [],
  versions: [],
  pulseDays: [],
  mindSessions: [],
  activities: [],
  foodEntries: [],
  targets: null,
  targetChanges: [],
  weekNotes: [],
  checkIns: [],
  today,
});
const resolve: MuscleResolver = (id) => (id === 'bench' ? { muscle: 'pectoraux', secondary: ['triceps'] } : id === 'curl' ? { muscle: 'biceps', secondary: [] } : null);
const xp = (input: LevelInput) => baseXpEvents(buildModel(input));

describe('niveaux', () => {
  it('suit la courbe de l’audit, arrondie à la dizaine', () => {
    expect([2, 5, 10, 20, 30, 50].map(xpForLevel)).toEqual([130, 1740, 7810, 31100, 68010, 179460]);
    expect(levelFor(0)).toMatchObject({ level: 1, floor: 0, next: 130, progress: 0 });
    expect(levelFor(130).level).toBe(2);
    expect(levelFor(129).level).toBe(1);
    expect(levelFor(10_000_000)).toMatchObject({ level: 50, next: null, progress: 1 });
  });

  it('date chaque passage de niveau', () => {
    const ups = levelUps([
      { key: 'a', date: '2026-10-01', kind: 'seance', xp: 100, label: '' },
      { key: 'b', date: '2026-10-02', kind: 'seance', xp: 100, label: '' },
    ]);
    expect(ups).toEqual([{ level: 2, date: '2026-10-02' }]);
  });
});

describe('XP', () => {
  it('séance : 3 séries au moins, une par jour, 6 au plus par semaine ; allégée = normale', () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(MONDAY, i));
    const ws = [
      ...days.map((d, i) => workout(`w${i}`, d, null)),
      workout('double', MONDAY, null),
      workout('court', '2026-10-12', null),
      workout('leger', '2026-10-13', null, { adjustment: { source: 'pulse', setsDelta: -1, rirDelta: 1 } }),
    ];
    const s = [...ws.filter((w) => w.id !== 'court').flatMap((w) => sets(w.id, 50, 10)), ...sets('court', 50, 10, 2)];
    const events = xp({ ...empty('2026-10-20'), workouts: ws, sets: s }).filter((e) => e.kind === 'seance');
    expect(events).toHaveLength(7);
    expect(events.filter((e) => e.date < '2026-10-12')).toHaveLength(6);
    expect(events.find((e) => e.key === 'seance:leger')).toMatchObject({ xp: 100, label: 'Libre, allégée avec PULSE' });
  });

  it('records et objectifs de charge : 3 au plus par séance ; la première séance ne compte pas', () => {
    const ws = [workout('w1', MONDAY), workout('w2', '2026-10-08')];
    const s = [...sets('w1', 60, 12), ...sets('w2', 62.5, 12)];
    const events = xp({ ...empty('2026-10-20'), workouts: ws, sets: s, templates: [tpl('A', [1, 4])] });
    expect(events.filter((e) => e.kind === 'record').map((e) => e.key)).toEqual(['record:w2:bench']);
    // 12 répétitions partout à 60 kg dans 8-12 : FORGE proposait 62,5 kg × 8, atteint.
    expect(events.filter((e) => e.kind === 'charge').map((e) => e.key)).toEqual(['charge:w2:bench']);
    const many = ['a', 'b', 'c', 'd'];
    const big = xp({
      ...empty('2026-10-20'),
      workouts: ws,
      sets: many.flatMap((x) => [...sets('w1', 50, 5, 1, x), ...sets('w2', 60, 5, 1, x)]),
    });
    expect(big.filter((e) => e.kind === 'record')).toHaveLength(3);
  });

  it('Mind, activité, protéines contre l’objectif du jour, bilan de la semaine', () => {
    const mind = [
      { ...sync('m1'), date: MONDAY, time: '07:00', kind: 'routine', ref: 'r', title: 'Réveil', durationSec: 300, completed: true },
      { ...sync('m2'), date: MONDAY, time: '21:00', kind: 'audio', ref: 'a', title: 'Soir', durationSec: 600, completed: true },
      { ...sync('m3'), date: '2026-10-06', time: '07:00', kind: 'routine', ref: 'r', title: 'Réveil', durationSec: 60, completed: false },
    ] as MindSession[];
    const activities = [
      { ...sync('a1'), date: MONDAY, kind: 'cardio', minutes: 30 },
      { ...sync('a2'), date: MONDAY, kind: 'mobilite', minutes: 10 },
    ] as Activity[];
    const food = Array.from({ length: 7 }, (_, i) => ({ ...sync(`f${i}`), date: addDays(MONDAY, i), proteinG: 150, kcal: 2000 })) as unknown as FoodEntry[];
    const notes = [
      { ...sync('n1', '2026-10-11T19:00:00.000Z'), weekStart: MONDAY, wentWell: 'Régulier' },
      { ...sync('n2'), weekStart: '2026-10-12', wentWell: '  ' },
    ] as WeekNote[];
    const targets = { kcal: 2500, proteinG: 150, carbsG: 300, fatG: 70 };
    const change = { ...sync('t1'), date: '2026-10-10', before: { ...targets, proteinG: 200 }, after: targets, source: 'manuel' as const };
    const events = xp({ ...empty('2026-10-20'), mindSessions: mind, activities, foodEntries: food, targets, targetChanges: [change], weekNotes: notes });
    const count = (k: string) => events.filter((e) => e.kind === k).length;
    expect(count('mind')).toBe(1);
    expect(count('activite')).toBe(1);
    // Avant le 10 octobre, l'objectif était de 200 g : seuls les 10 et 11 octobre comptent.
    expect(events.filter((e) => e.kind === 'proteines').map((e) => e.date)).toEqual(['2026-10-10', '2026-10-11']);
    expect(events.filter((e) => e.kind === 'bilan')).toEqual([{ key: `bilan:${MONDAY}`, date: '2026-10-11', kind: 'bilan', xp: 30, label: 'Bilan de la semaine rempli' }]);
    const noChange = xp({ ...empty('2026-10-20'), foodEntries: food, targets });
    expect(noChange.filter((e) => e.kind === 'proteines')).toHaveLength(5);
  });

  it('semaines respectées et cycle terminé ; une récupération PULSE n’empêche rien', () => {
    const weeks = [0, 1, 2, 3];
    const ws = weeks.flatMap((i) => [workout(`a${i}`, addDays(MONDAY, 7 * i), 'A'), ...(i === 2 ? [] : [workout(`b${i}`, addDays(MONDAY, 7 * i + 3), 'B')])]);
    const input: LevelInput = {
      ...empty('2026-11-10'),
      programs: [program()],
      templates: [tpl('A', [1]), tpl('B', [4])],
      workouts: ws,
      sets: ws.flatMap((w) => sets(w.id, 50, 10)),
      pulseDays: [{ ...sync('d'), date: addDays(MONDAY, 17), choice: 'remplacer' } as never],
    };
    const events = xp(input);
    expect(events.filter((e) => e.kind === 'semaine')).toHaveLength(4);
    expect(events.find((e) => e.kind === 'cycle')).toMatchObject({ key: 'cycle:p', date: '2026-11-01', xp: 500 });
    const unlocks = badgeUnlocks(buildModel(input)).map((u) => u.id);
    expect(unlocks).toEqual(expect.arrayContaining(['premiere-semaine', 'programme-respecte', 'premier-cycle', 'actif-4']));
    // Sans la récupération PULSE, la séance manquée compte : une semaine de moins, mais le cycle reste à 7 sur 8 (87 %).
    const missing = xp({ ...input, pulseDays: [] });
    expect(missing.filter((e) => e.kind === 'semaine')).toHaveLength(3);
    expect(missing.find((e) => e.kind === 'cycle')).toBeDefined();
  });

  it('sans doublon, et l’XP suit les données : une séance supprimée ne rapporte plus rien', () => {
    const ws = [workout('w1', MONDAY), workout('w2', '2026-10-08')];
    const input = { ...empty('2026-10-20'), workouts: ws, sets: [...sets('w1', 60, 12), ...sets('w2', 62.5, 8)] };
    const a = computeLevel(input, resolve, PRIORITY_MUSCLES);
    expect(new Set(a.events.map((e) => e.key)).size).toBe(a.events.length);
    expect(computeLevel(input, resolve, PRIORITY_MUSCLES)).toEqual(a);
    const removed = computeLevel({ ...input, workouts: [ws[0]!, { ...ws[1]!, deletedAt: T }] }, resolve, PRIORITY_MUSCLES);
    expect(removed.progress.totalXp).toBeLessThan(a.progress.totalXp);
    expect(removed.events.some((e) => e.key.includes('w2'))).toBe(false);
  });
});

describe('badges', () => {
  it('paliers de charge sur les polyarticulaires seulement, +10 %, 100 séances, tonnage', () => {
    const ws = Array.from({ length: 100 }, (_, i) => workout(`w${i}`, addDays('2026-01-05', i), null));
    const s = [...ws.flatMap((w, i) => sets(w.id, 40 + i * 0.25, 10)), ...sets('w0', 70, 10, 1, 'curl')];
    const input = { ...empty('2026-12-01'), workouts: ws, sets: s };
    const unlocks = new Map(badgeUnlocks(buildModel(input)).map((u) => [u.id, u.date]));
    expect(unlocks.has('charge-60')).toBe(true);
    expect(unlocks.get('charge-60')).toBe(addDays('2026-01-05', 80));
    expect(unlocks.has('charge-100')).toBe(false);
    expect(unlocks.get('seances-100')).toBe(addDays('2026-01-05', 99));
    expect(unlocks.get('plus-10')).toBe(addDays('2026-01-05', 16));
    expect(unlocks.has('tonnes-total')).toBe(true);
    expect(unlocks.has('tonnes-seance')).toBe(false);
    expect(
      computeLevel(input, resolve, PRIORITY_MUSCLES)
        .events.filter((e) => e.kind === 'badge')
        .find((e) => e.key === 'badge:seances-100')?.xp,
    ).toBe(200);
  });

  it('cardio, routines et série Mind', () => {
    const acts = [
      { ...sync('a1'), date: MONDAY, kind: 'cardio', minutes: 30 },
      { ...sync('a2'), date: '2026-10-07', kind: 'cardio', minutes: 25 },
      { ...sync('a3'), date: '2026-10-09', kind: 'cardio', minutes: 40 },
    ] as Activity[];
    const mind = Array.from({ length: 14 }, (_, i) => ({
      ...sync(`m${i}`),
      date: addDays(MONDAY, i),
      time: '07:00',
      kind: i % 2 ? 'audio' : 'routine',
      ref: 'r',
      title: 'R',
      durationSec: 300,
      completed: i % 7 < 5,
    })) as MindSession[];
    const unlocks = new Map(badgeUnlocks(buildModel({ ...empty('2026-10-30'), activities: acts, mindSessions: mind })).map((u) => [u.id, u.date]));
    expect(unlocks.get('premier-cardio')).toBe(MONDAY);
    expect(unlocks.get('record-duree')).toBe('2026-10-09');
    expect(unlocks.get('premiere-routine')).toBe(MONDAY);
    expect(unlocks.get('serie-mind')).toBe(addDays(MONDAY, 11));
    expect(unlocks.has('routines-7')).toBe(false);
  });
});

describe('caractéristiques', () => {
  const today = '2026-12-27';
  it('sans données : pas de note, mais ce qu’il faut enregistrer', () => {
    const c = characteristics(buildModel(empty(today)), resolve, PRIORITY_MUSCLES);
    expect(c.every((x) => x.score === null && x.missing)).toBe(true);
    expect(c.find((x) => x.key === 'endurance')!.missing).toBe('Note tes séances de cardio dans le journal d’activité, pendant 4 semaines.');
    expect(c.find((x) => x.key === 'recuperation')!.missing).toBe('Il faut 14 check-ins sur les 28 derniers jours : tu en as 0.');
  });

  it('notes, confiance et variation expliquée', () => {
    const start = addDays(today, -83);
    const ws = Array.from({ length: 24 }, (_, i) => workout(`w${i}`, addDays(start, Math.floor(i / 2) * 7 + (i % 2) * 3), i % 2 ? 'B' : 'A'));
    const s = ws.flatMap((w, i) => ['bench', 'squat', 'row'].flatMap((x) => sets(w.id, 50 + i, 8, 4, x)));
    const acts = Array.from({ length: 12 }, (_, i) => ({ ...sync(`a${i}`), date: addDays(start, i * 7), kind: i % 3 ? 'cardio' : 'mobilite', minutes: 30 + i })) as Activity[];
    const checks = Array.from({ length: 30 }, (_, i) => ({ ...sync(`c${i}`), date: addDays(today, -i), sleepHours: i % 2 ? 7.5 : 6.5 })) as CheckIn[];
    const input: LevelInput = {
      ...empty(today),
      exercises: [ex('bench'), ex('squat'), ex('row')],
      workouts: ws,
      sets: s,
      activities: acts,
      checkIns: checks,
      programs: [program({ startDate: start, durationWeeks: 12 })],
      templates: [tpl('A', [isoDay(start)]), tpl('B', [isoDay(addDays(start, 3))])],
    };
    const c = new Map(characteristics(buildModel(input), resolve, PRIORITY_MUSCLES).map((x) => [x.key, x]));
    const f = c.get('force')!;
    expect(f.score).toBeGreaterThan(30);
    expect(f.confidence).toBe('elevee');
    expect(f.factors[0]!.detail).toMatch(/^\+\d+,?\d* % en moyenne sur 3 exercices$/);
    expect(c.get('regularite')).toMatchObject({ confidence: 'elevee' });
    expect(c.get('regularite')!.score).toBeGreaterThanOrEqual(90);
    expect(c.get('endurance')!.score).not.toBeNull();
    expect(c.get('mobilite')!.factors[0]!.detail).toBe('0,3 sur 2');
    expect(c.get('recuperation')!.factors[0]).toMatchObject({ label: 'Nuits de 7 h ou plus', value: 50 });
    expect(f.change).toMatchObject({ factor: expect.any(String) });
  });
});

function isoDay(date: string) {
  return new Date(`${date}T12:00:00`).getDay() || 7;
}
