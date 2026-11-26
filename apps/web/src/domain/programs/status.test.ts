import { describe, expect, it } from 'vitest';
import type { Program, WorkoutTemplate } from '../../db/types';
import { actionLabel, canDelete, cycleWeek, groupByStatus, programStatus, sessionsOf, sessionsPerWeek, statusActions } from './status';

const base = { createdAt: 'x', updatedAt: '2026-11-01', deletedAt: null };
const program = (id: string, o: Partial<Program> = {}): Program => ({ ...base, id, name: id, active: false, ...o });

describe('statut des programmes', () => {
  it('un programme d’avant la v12 tire son statut de `active`', () => {
    expect(programStatus({ active: true })).toBe('actif');
    expect(programStatus({ active: false })).toBe('pause');
    expect(programStatus({ active: false, status: 'brouillon' })).toBe('brouillon');
  });

  it('groupe par statut, dans l’ordre, le plus récent d’abord, sans les supprimés', () => {
    const groups = groupByStatus([
      program('a', { status: 'pause', updatedAt: '2026-11-02' }),
      program('b', { status: 'pause', updatedAt: '2026-11-05' }),
      program('c', { active: true }),
      program('d', { status: 'archive' }),
      program('e', { status: 'brouillon', deletedAt: 'x' }),
    ]);
    expect(groups.map((g) => [g.status, g.programs.map((p) => p.id)])).toEqual([
      ['actif', ['c']],
      ['pause', ['b', 'a']],
      ['archive', ['d']],
    ]);
  });

  it('actions et libellés selon le statut ; l’actif ne se supprime pas', () => {
    expect(statusActions('brouillon')).toEqual(['actif']);
    expect(statusActions('actif')).toEqual(['pause', 'termine']);
    expect(actionLabel('termine', 'actif')).toBe('Recommencer un cycle');
    expect(actionLabel('pause', 'actif')).toBe('Reprendre ce programme');
    expect(actionLabel('archive', 'pause')).toBe('Sortir des archives');
    expect(canDelete('actif')).toBe(false);
    expect(canDelete('pause')).toBe(true);
  });
});

describe('cycle', () => {
  it('semaine en cours, à venir, ou cycle fini ; sans date de début, rien de deviné', () => {
    expect(cycleWeek({ startDate: null, durationWeeks: 8 }, '2026-11-26')).toBeNull();
    expect(cycleWeek({ startDate: '2026-11-26', durationWeeks: 8 }, '2026-11-26')).toEqual({ kind: 'en-cours', week: 1, total: 8 });
    expect(cycleWeek({ startDate: '2026-11-02', durationWeeks: 8 }, '2026-11-26')).toEqual({ kind: 'en-cours', week: 4, total: 8 });
    expect(cycleWeek({ startDate: '2026-11-02', durationWeeks: null }, '2026-11-26')).toEqual({ kind: 'en-cours', week: 4, total: null });
    expect(cycleWeek({ startDate: '2026-12-01', durationWeeks: 8 }, '2026-11-26')).toEqual({ kind: 'a-venir', startDate: '2026-12-01' });
    expect(cycleWeek({ startDate: '2026-09-01', durationWeeks: 8 }, '2026-11-26')).toEqual({ kind: 'fini', total: 8, overBy: 5 });
  });

  it('séances du programme dans l’ordre et séances par semaine', () => {
    const t = (id: string, programId: string, position: number, weekdays: number[]): WorkoutTemplate => ({ ...base, id, name: id, programId, position, weekdays, exercises: [] });
    const list = [t('b', 'p', 1, [3]), t('a', 'p', 0, [1, 4]), t('x', 'q', 0, [2])];
    expect(sessionsOf('p', list).map((s) => s.id)).toEqual(['a', 'b']);
    expect(sessionsPerWeek(sessionsOf('p', list))).toBe(3);
  });
});
