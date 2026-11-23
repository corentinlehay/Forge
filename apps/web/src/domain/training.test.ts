import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutSet, WorkoutTemplate } from '../db/types';
import { bestE1rm, e1rm, findRecords, isoWeekday, lastPerformance, plannedPerWeek, plannedSoFar, sessionsInWeek, templateForDay, weekStart, weeklyVolumes, workoutStats } from './training';
import { activeProgram, programTemplates } from './training';

const base = { createdAt: 'x', updatedAt: 'x', deletedAt: null };
const workout = (id: string, date: string, ended = true): Workout => ({ ...base, id, date, name: id, exerciseIds: [], startedAt: `${date}T17:00:00.000Z`, endedAt: ended ? `${date}T18:00:00.000Z` : null });
let n = 0;
const set = (workoutId: string, exerciseId: string, weightKg: number, reps: number): WorkoutSet => ({ ...base, id: `s${++n}`, workoutId, exerciseId, position: n, weightKg, reps });
const template = (name: string, weekdays: number[], position = 0): WorkoutTemplate => ({ ...base, id: name, name, weekdays, exercises: [], position });

describe('calendrier', () => {
  it('compte la semaine du lundi au dimanche', () => {
    expect(isoWeekday('2026-11-23')).toBe(1);
    expect(isoWeekday('2026-11-29')).toBe(7);
    expect(weekStart('2026-11-29')).toBe('2026-11-23');
  });
});

describe('programme', () => {
  const program = [template('Upper A', [1]), template('Lower A', [2]), template('Upper B', [4, 6], 2)];
  it('trouve la séance du jour', () => {
    expect(templateForDay(program, '2026-11-23')?.name).toBe('Upper A');
    expect(templateForDay(program, '2026-11-25')).toBeNull();
    expect(templateForDay(program, '2026-11-28')?.name).toBe('Upper B');
  });
  it('compte les séances prévues', () => {
    expect(plannedPerWeek(program)).toBe(4);
    expect(plannedSoFar(program, '2026-11-26')).toBe(3);
  });
});

describe('séances', () => {
  const w1 = workout('w1', '2026-11-16');
  const w2 = workout('w2', '2026-11-23');
  const w3 = workout('w3', '2026-11-24', false);
  const sets = [set('w1', 'dc', 80, 8), set('w1', 'dc', 80, 7), set('w2', 'dc', 85, 6), set('w2', 'sq', 100, 5), set('w3', 'dc', 90, 3)];

  it('calcule le volume et les séries', () => {
    expect(workoutStats(w1, sets.filter((s) => s.workoutId === 'w1'))).toMatchObject({ setCount: 2, exerciseCount: 1, volumeKg: 1200 });
  });

  it('compte les séances terminées de la semaine', () => {
    expect(sessionsInWeek([w1, w2, w3], '2026-11-25').map((w) => w.id)).toEqual(['w2']);
  });

  it('cumule le volume par semaine', () => {
    const weeks = weeklyVolumes([w1, w2, w3], sets, '2026-11-25', 2);
    expect(weeks).toEqual([
      { weekStart: '2026-11-16', volumeKg: 1200, sessions: 1 },
      { weekStart: '2026-11-23', volumeKg: 1010, sessions: 1 },
    ]);
  });

  it('détecte un record de 1RM estimé, jamais la première fois', () => {
    expect(e1rm(85, 6)).toBeCloseTo(102, 6);
    const records = findRecords([w1, w2], sets);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ exerciseId: 'dc', workoutId: 'w2', weightKg: 85, reps: 6 });
  });

  it('donne la performance à battre, hors séance en cours', () => {
    expect(lastPerformance('dc', [w1, w2, w3], sets, 'w3')).toEqual({ date: '2026-11-23', weightKg: 85, reps: 6, sets: 1 });
    expect(bestE1rm('dc', [w1, w2, w3], sets, 'w3')).toBeCloseTo(102, 6);
    expect(lastPerformance('inconnu', [w1], sets)).toBeNull();
  });
});

describe('programmes', () => {
  const sync = { createdAt: 'x', updatedAt: 'x', deletedAt: null };
  const p = (id: string, active: boolean) => ({ ...sync, id, name: id, active });
  const t = (id: string, programId: string | null, position = 0) => ({ ...sync, id, name: id, weekdays: [1], exercises: [], position, programId });
  it('ne garde que les séances du programme actif, et rattache les séances sans programme', () => {
    const programs = [p('a', false), p('b', true)];
    const templates = [t('a1', 'a'), t('b2', 'b', 2), t('b1', 'b', 1), t('orphan', null, 3)];
    expect(activeProgram(programs)?.id).toBe('b');
    expect(programTemplates(templates, programs).map((x) => x.id)).toEqual(['b1', 'b2', 'orphan']);
    expect(programTemplates(templates, programs, 'a').map((x) => x.id)).toEqual(['a1']);
  });
  it('sans programme, montre les séances non rattachées', () => {
    expect(programTemplates([t('x', null)], []).map((x) => x.id)).toEqual(['x']);
  });
});
