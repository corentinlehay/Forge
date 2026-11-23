import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutSet } from '../db/types';
import { muscleHistory, muscleWeek, volumeLevel, volumeStatus, type MuscleResolver } from './muscleVolume';

const base = { createdAt: 'x', updatedAt: 'x', deletedAt: null };
let n = 0;
const w = (id: string, date: string, deleted = false): Workout => ({ ...base, id, date, name: id, exerciseIds: [], startedAt: `${date}T17:00:00Z`, deletedAt: deleted ? 'x' : null });
const s = (workoutId: string, exerciseId: string): WorkoutSet => ({ ...base, id: `s${++n}`, workoutId, exerciseId, position: n, weightKg: 50, reps: 8 });
const resolve: MuscleResolver = (id) =>
  ({
    bench: { muscle: 'pectoraux' as const, secondary: ['epaules' as const, 'triceps' as const] },
    pushdown: { muscle: 'triceps' as const, secondary: [] },
    old: { muscle: null, secondary: [] },
  })[id] ?? null;

describe('volume par muscle', () => {
  it('compte 1 pour le muscle principal et 0,5 pour chaque secondaire', () => {
    const workouts = [w('a', '2026-11-23'), w('b', '2026-11-25'), w('old', '2026-11-16'), w('gone', '2026-11-24', true)];
    const sets = [s('a', 'bench'), s('a', 'bench'), s('a', 'bench'), s('b', 'bench'), s('b', 'pushdown'), s('b', 'pushdown'), s('old', 'bench'), s('gone', 'bench'), s('a', 'old')];
    const { muscles, unknownExerciseIds } = muscleWeek(workouts, sets, resolve, '2026-11-26');
    expect(muscles.pectoraux).toMatchObject({ directSets: 4, indirectSets: 0, fractional: 4, days: 2 });
    expect(muscles.triceps).toMatchObject({ directSets: 2, indirectSets: 4, fractional: 4, days: 1 });
    expect(muscles.epaules).toMatchObject({ directSets: 0, indirectSets: 4, fractional: 2, days: 0 });
    expect(muscles.triceps.exercises).toEqual([
      { exerciseId: 'pushdown', sets: 2, direct: true },
      { exerciseId: 'bench', sets: 4, direct: false },
    ]);
    expect(unknownExerciseIds).toEqual(['old']);
  });

  it('retrace l’historique semaine par semaine', () => {
    const history = muscleHistory('pectoraux', [w('a', '2026-11-23'), w('old', '2026-11-16')], [s('a', 'bench'), s('old', 'bench'), s('old', 'bench')], resolve, '2026-11-26', 3);
    expect(history.map((h) => [h.weekStart, h.fractional])).toEqual([
      ['2026-11-09', 0],
      ['2026-11-16', 2],
      ['2026-11-23', 1],
    ]);
  });

  it('classe le volume par paliers', () => {
    expect([0, 3, 7.5, 12, 24].map(volumeLevel)).toEqual([0, 1, 2, 3, 4]);
    expect(volumeStatus(12).label).toBe('Dans le repère');
    expect(volumeStatus(6).label).toBe('Sous le repère');
  });
});
