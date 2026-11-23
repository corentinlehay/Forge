import { describe, expect, it } from 'vitest';
import type { CheckIn } from '../db/types';
import { averageCheckIns, recoveryLabel, recoveryScore } from './wellbeing';

const c = (date: string, sleepHours: number, energy: 1 | 2 | 3 | 4 | 5, fatigue: 1 | 2 | 3 | 4 | 5, soreness: 1 | 2 | 3 | 4 | 5): CheckIn => ({ id: date, createdAt: 'x', updatedAt: 'x', deletedAt: null, date, sleepHours, energy, fatigue, soreness });

describe('récupération estimée', () => {
  it('vaut 100 au mieux et 0 au pire', () => {
    expect(recoveryScore(c('d', 8, 5, 1, 1))).toBe(100);
    expect(recoveryScore(c('d', 0, 1, 5, 5))).toBe(0);
  });
  it('pèse surtout le sommeil', () => {
    expect(recoveryScore(c('d', 6, 3, 3, 3))).toBe(59);
    expect(recoveryLabel(59)).toBe('Correcte');
  });
  it('fait la moyenne de la semaine', () => {
    const avg = averageCheckIns([c('2026-11-23', 8, 4, 2, 2), c('2026-11-20', 6, 2, 4, 4), c('2026-11-10', 4, 1, 5, 5)], '2026-11-23');
    expect(avg).toMatchObject({ sleepHours: 7, energy: 3, fatigue: 3, count: 2 });
    expect(averageCheckIns([], '2026-11-23')).toBeNull();
  });
});
