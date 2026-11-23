import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutSet } from '../db/types';
import { exerciseRecords, exerciseSessions, exerciseTrend, parseRepRange, rpeFromRir, suggestNext } from './progression';

const base = { createdAt: 'x', updatedAt: 'x', deletedAt: null };
let n = 0;
const w = (id: string, date: string): Workout => ({
  ...base,
  id,
  date,
  name: id,
  exerciseIds: [],
  startedAt: `${date}T17:00:00Z`,
  endedAt: `${date}T18:00:00Z`,
});
const s = (workoutId: string, weightKg: number, reps: number, rir?: number, exerciseId = 'dc'): WorkoutSet => ({
  ...base,
  id: `s${++n}`,
  workoutId,
  exerciseId,
  position: n,
  weightKg,
  reps,
  ...(rir !== undefined ? { rir } : {}),
});

describe('fourchettes et RPE', () => {
  it('lit les fourchettes de répétitions', () => {
    expect(parseRepRange('8-10')).toEqual({ min: 8, max: 10 });
    expect(parseRepRange('8 à 12')).toEqual({ min: 8, max: 12 });
    expect(parseRepRange('10')).toEqual({ min: 10, max: 10 });
    expect(parseRepRange('libre')).toBeNull();
    expect(rpeFromRir(2)).toBe(8);
  });
});

describe('objectif proposé (double progression)', () => {
  const range = { min: 6, max: 10 };
  it('propose une répétition de plus à charge égale (exemple : 90 kg × 8 → 9)', () => {
    const sessions = exerciseSessions('dc', [w('a', '2026-11-16')], [s('a', 90, 8, 2), s('a', 90, 8, 2), s('a', 90, 8, 1)]);
    expect(suggestNext(sessions, range)).toMatchObject({
      weightKg: 90,
      reps: 9,
    });
  });
  it('propose +2,5 kg quand toutes les séries atteignent le haut de la fourchette', () => {
    const sessions = exerciseSessions('dc', [w('a', '2026-11-16')], [s('a', 90, 10, 2), s('a', 90, 10, 1)]);
    const next = suggestNext(sessions, range)!;
    expect(next).toMatchObject({ weightKg: 92.5, reps: 6 });
    expect(next.reason).toContain('passe à 92,5 kg');
  });
  it('ne monte pas la charge si la dernière série était à l’échec', () => {
    const sessions = exerciseSessions('dc', [w('a', '2026-11-16')], [s('a', 90, 10, 1), s('a', 90, 10, 0)]);
    expect(suggestNext(sessions, range)).toMatchObject({
      weightKg: 90,
      reps: 10,
    });
  });
  it('consolide sous la fourchette après un échec', () => {
    const sessions = exerciseSessions('dc', [w('a', '2026-11-16')], [s('a', 100, 5, 0)]);
    expect(suggestNext(sessions, range)).toMatchObject({
      weightKg: 100,
      reps: 5,
    });
  });
  it('ne propose rien sans historique', () => {
    expect(suggestNext([], range)).toBeNull();
  });
});

describe('tendance', () => {
  const dates = ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'];
  const make = (loads: number[], gapDays = false) => {
    const ws = loads.map((_, i) => w(`w${i}`, gapDays && i === loads.length - 1 ? '2026-12-20' : dates[i]!));
    const ss = loads.map((l, i) => s(`w${i}`, l, 8));
    return exerciseSessions('dc', ws, ss);
  };
  it('détecte progression, stagnation, régression et irrégularité', () => {
    expect(make([80, 80, 82.5, 85, 87.5]).length).toBe(5);
    expect(exerciseTrend(make([80, 80, 82.5, 85, 87.5])).kind).toBe('progression');
    expect(exerciseTrend(make([85, 85, 85, 85, 85])).kind).toBe('stagnation');
    expect(exerciseTrend(make([90, 90, 85, 82.5, 82.5])).kind).toBe('regression');
    expect(exerciseTrend(make([80, 82.5, 85, 87.5], true)).kind).toBe('irregular');
    expect(exerciseTrend(make([80, 82.5])).kind).toBe('insufficient');
  });
});

describe('records par période', () => {
  it('distingue meilleure charge, meilleures répétitions, force estimée et volume', () => {
    const sessions = exerciseSessions(
      'dc',
      [w('a', '2026-08-01'), w('b', '2026-11-10'), w('c', '2026-11-20')],
      [s('a', 100, 3), s('b', 80, 12), s('b', 80, 10), s('c', 90, 6), s('c', 90, 6)],
    );
    const all = exerciseRecords(sessions, null);
    expect(all.bestLoad).toMatchObject({ weightKg: 100, reps: 3 });
    expect(all.bestReps).toMatchObject({ reps: 12, weightKg: 80 });
    expect(all.bestE1rm?.valueKg).toBeCloseTo(112, 5);
    expect(all.bestVolume).toMatchObject({
      volumeKg: 1760,
      date: '2026-11-10',
    });
    const recent = exerciseRecords(sessions, '2026-11-15');
    expect(recent.sessions).toBe(1);
    expect(recent.bestLoad).toMatchObject({ weightKg: 90 });
  });
});
