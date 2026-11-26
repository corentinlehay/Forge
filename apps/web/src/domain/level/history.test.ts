import { describe, expect, it } from 'vitest';
import type { Exercise, MindSession, Workout, WorkoutSet } from '../../db/types';
import { addDays } from '../../lib/dates';
import type { MuscleResolver } from '../muscleVolume';
import { PRIORITY_MUSCLES } from '../plan';
import { announcement, badgeProgress, characteristicHistory, readSeen, seenFrom, timeline, xpByWeek } from './history';
import { computeLevel } from './level';
import { buildModel, type LevelInput } from './xp';

const T = '2026-01-01T08:00:00.000Z';
const sync = (id: string) => ({ id, createdAt: T, updatedAt: T, deletedAt: null });
const MONDAY = '2026-10-05';
const workout = (id: string, date: string): Workout =>
  ({ ...sync(id), date, name: 'Séance', templateId: null, exerciseIds: [], startedAt: `${date}T18:00:00.000Z`, endedAt: `${date}T19:00:00.000Z` }) as Workout;
const sets = (workoutId: string, weightKg: number, reps: number, exerciseId = 'bench'): WorkoutSet[] =>
  Array.from({ length: 3 }, (_, i) => ({ ...sync(`${workoutId}-${exerciseId}-${i}`), workoutId, exerciseId, position: i, weightKg, reps }) as WorkoutSet);
const resolve: MuscleResolver = () => ({ muscle: 'pectoraux', secondary: [] });
const input = (today: string, workouts: Workout[], s: WorkoutSet[], extra: Partial<LevelInput> = {}): LevelInput => ({
  workouts,
  sets: s,
  exercises: [{ ...sync('bench'), name: 'Développé couché', kind: 'compound' } as unknown as Exercise],
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
  ...extra,
});

// Trois semaines : une séance par semaine, charge en hausse.
const ws = [0, 1, 2].map((i) => workout(`w${i}`, addDays(MONDAY, 7 * i)));
const ss = ws.flatMap((w, i) => sets(w.id, 45 + 5 * i, 10));

describe('historique FORGE LEVEL', () => {
  it('XP par semaine, du lundi au dimanche, la plus ancienne d’abord', () => {
    const state = computeLevel(input('2026-10-21', ws, ss), resolve, PRIORITY_MUSCLES);
    const weeks = xpByWeek(state.events, '2026-10-21', 4);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-09-28', MONDAY, '2026-10-12', '2026-10-19']);
    expect(weeks[1]!.byKind.seance).toBe(100);
    expect(weeks[2]!.byKind.record).toBe(40);
    expect(weeks.reduce((n, w) => n + w.xp, 0)).toBe(state.progress.totalXp);
  });

  it('frise : niveaux, badges et records, du plus récent au plus ancien', () => {
    const state = computeLevel(input('2026-10-21', ws, ss), resolve, PRIORITY_MUSCLES);
    const t = timeline(state);
    expect(t[0]!.date >= t.at(-1)!.date).toBe(true);
    expect(t.filter((e) => e.kind === 'record')).toHaveLength(2);
    expect(t.some((e) => e.kind === 'badge' && e.badgeId === 'premier-record')).toBe(true);
    expect(t.some((e) => e.kind === 'niveau' && e.level === 2)).toBe(true);
  });

  it('notes semaine par semaine', () => {
    const h = characteristicHistory(buildModel(input('2026-10-21', ws, ss)), resolve, PRIORITY_MUSCLES, 3);
    expect(h.map((p) => p.date)).toEqual(['2026-10-11', '2026-10-18', '2026-10-21']);
    expect(h.every((p) => p.scores.force === null)).toBe(true);
  });

  it('progression vers les badges à compter, et plus rien une fois débloqués', () => {
    const mind = [{ ...sync('m'), date: MONDAY, time: '07:00', kind: 'routine', ref: 'r', title: 'R', durationSec: 60, completed: true }] as MindSession[];
    const state = computeLevel(input('2026-10-21', ws, ss, { mindSessions: mind }), resolve, PRIORITY_MUSCLES);
    const p = badgeProgress(state.model, state.unlocks);
    expect(p.get('seances-100')).toEqual({ value: 3, target: 100, text: '3 séances sur 100' });
    expect(p.get('routines-7')?.text).toBe('1 routine sur 7');
    expect(p.get('charge-60')?.text).toBe('Meilleure charge : 55 kg sur 60');
    expect(p.get('actif-4')?.text).toBe('3 semaines d’affilée sur 4');
    expect(p.has('premier-record')).toBe(false);
    const heavy = computeLevel(input('2026-10-21', ws, [...ss, ...sets('w2', 61, 1)]), resolve, PRIORITY_MUSCLES);
    expect(badgeProgress(heavy.model, heavy.unlocks).has('charge-60')).toBe(false);
  });
});

describe('annonces', () => {
  it('rien sans visite enregistrée ; puis seulement ce qui est nouveau', () => {
    const before = computeLevel(input('2026-10-13', ws.slice(0, 2), ss.slice(0, 6)), resolve, PRIORITY_MUSCLES);
    expect(announcement(before, null, '2026-10-13')).toBeNull();
    const seen = seenFrom(before, '2026-10-13', T);
    expect(announcement(before, seen, '2026-10-13')).toBeNull();
    const after = computeLevel(input('2026-10-19', ws, ss), resolve, PRIORITY_MUSCLES);
    const a = announcement(after, seen, '2026-10-19')!;
    expect(a.records.map((e) => e.key)).toEqual(['record:w2:bench']);
    expect(a.badges).toEqual([]);
    expect(announcement(after, seenFrom(after, '2026-10-19', T), '2026-10-19')).toBeNull();
    // Un record de plus de 7 jours n'est plus annoncé ; le passage de niveau, si.
    expect(announcement(after, seen, '2026-10-30')).toMatchObject({ records: [], level: { from: before.progress.level, to: after.progress.level } });
  });

  it('passage de niveau et badges', () => {
    const many = Array.from({ length: 20 }, (_, i) => workout(`x${i}`, addDays(MONDAY, i)));
    const state = computeLevel(
      input(
        '2026-10-25',
        many,
        many.flatMap((w, i) => sets(w.id, 40 + i, 10)),
      ),
      resolve,
      PRIORITY_MUSCLES,
    );
    const a = announcement(state, { level: 1, badges: [], records: [], at: T }, '2026-10-25')!;
    expect(a.level).toEqual({ from: 1, to: state.progress.level });
    expect(a.badges.length).toBeGreaterThan(0);
    expect(a.xp).toBeGreaterThan(0);
  });

  it('relit un état abîmé sans planter', () => {
    expect(readSeen(null)).toBeNull();
    expect(readSeen({ level: 'x' })).toBeNull();
    expect(readSeen({ level: 3.7, badges: ['a', 2], records: [] })).toEqual({ level: 3, badges: ['a'], records: [], at: '' });
  });
});
