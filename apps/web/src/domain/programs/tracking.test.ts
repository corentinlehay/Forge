import { describe, expect, it } from 'vitest';
import type { ProgramVersion, PulseDay, Workout, WorkoutSet, WorkoutTemplate } from '../../db/types';
import type { MuscleResolver } from '../muscleVolume';
import { adherence, cycleWeeks, exerciseProgress, musclePlanVsDone, programHistory, programRecords, programWorkouts, sessionsOn, type TrackingInput } from './tracking';

const T = '2026-11-01T08:00:00.000Z';
const sync = (id: string, createdAt = T) => ({ id, createdAt, updatedAt: createdAt, deletedAt: null });
// Le 2 novembre 2026 est un lundi.
const tpl = (id: string, name: string, weekdays: number[], programId = 'p', exercises = [{ exerciseId: 'bench', sets: 3, reps: '8-12', restSec: 120, rir: 2 }]): WorkoutTemplate =>
  ({ ...sync(id), name, weekdays, exercises, position: 0, programId }) as WorkoutTemplate;
const workout = (id: string, date: string, templateId: string | null, extra: Partial<Workout> = {}): Workout =>
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
const set = (workoutId: string, weightKg: number, reps: number, exerciseId = 'bench'): WorkoutSet =>
  ({ ...sync(`${workoutId}-${weightKg}-${reps}`), workoutId, exerciseId, position: 0, weightKg, reps }) as WorkoutSet;
const version = (n: number, createdAt: string, sessions: { templateId: string; name: string; weekdays: number[] }[], summary = 'Version de départ'): ProgramVersion =>
  ({
    ...sync(`v${n}`, createdAt),
    programId: 'p',
    version: n,
    snapshot: { name: 'P', sessions: sessions.map((s, i) => ({ ...s, position: i, exercises: [] })) },
    changeSummary: summary,
  }) as ProgramVersion;

const A = tpl('A', 'Haut', [1]);
const B = tpl('B', 'Bas', [4]);
const base: TrackingInput = {
  program: { id: 'p', startDate: '2026-11-02', durationWeeks: 4 },
  templates: [A, B],
  versions: [],
  workouts: [],
  sets: [],
  pulseDays: [],
  today: '2026-11-19',
};

describe('suivi du programme', () => {
  it('séances du programme : liées, ou faites depuis une de ses séances avant les versions ; terminées seulement', () => {
    const ws = [
      workout('1', '2026-11-02', 'A'),
      workout('2', '2026-11-03', 'A', { programId: null }),
      workout('3', '2026-11-04', 'Z', { programId: null }),
      workout('4', '2026-11-05', 'B', { endedAt: null }),
      workout('5', '2026-11-06', 'A', { programId: 'autre' }),
    ];
    expect(programWorkouts('p', ws, [A, B]).map((w) => w.id)).toEqual(['1', '2']);
  });

  it('semaines du cycle : faite, allégée, manquée, déplacée, récupération, aujourd’hui, à venir, en plus', () => {
    const input: TrackingInput = {
      ...base,
      workouts: [
        workout('w1', '2026-11-02', 'A'),
        workout('w2', '2026-11-06', 'B'), // Bas fait le vendredi au lieu du jeudi : compte quand même.
        workout('w3', '2026-11-07', 'A'), // Une séance Haut de plus.
        workout('w4', '2026-11-09', 'A', { adjustment: { source: 'pulse', setsDelta: -1, rirDelta: 1 } }),
      ],
      pulseDays: [{ ...sync('d1'), date: '2026-11-16', choice: 'remplacer' } as PulseDay],
    };
    const weeks = cycleWeeks(input);
    expect(weeks).toHaveLength(4);
    expect(weeks.map((w) => w.slots.map((s) => s.state))).toEqual([
      ['faite', 'faite'],
      ['allegee', 'manquee'],
      ['recuperation', 'aujourdhui'],
      ['a-venir', 'a-venir'],
    ]);
    expect(weeks[0]!.extra).toEqual([{ date: '2026-11-07', name: 'A', workoutId: 'w3' }]);
    expect(weeks[2]!.current).toBe(true);
    expect(weeks[1]!.past).toBe(true);
    expect(adherence(weeks)).toEqual({ planned: 4, done: 3, lightened: 1, recovered: 1, extra: 1, rate: 75 });
  });

  it('sans date de début : pas de semaines de cycle ; sans durée : une semaine à venir de plus ; cycle dépassé : toutes les semaines', () => {
    expect(cycleWeeks({ ...base, program: { id: 'p', startDate: null, durationWeeks: 4 } })).toEqual([]);
    expect(cycleWeeks({ ...base, program: { id: 'p', startDate: '2026-11-02', durationWeeks: null } })).toHaveLength(4);
    expect(cycleWeeks({ ...base, program: { id: 'p', startDate: '2026-11-02', durationWeeks: 2 } })).toHaveLength(3);
    expect(adherence([]).rate).toBeNull();
  });

  it('les séances prévues suivent la version en vigueur chaque jour', () => {
    const versions = [
      version(1, '2026-11-01T08:00:00.000Z', [{ templateId: 'A', name: 'Haut', weekdays: [1, 3] }]),
      version(2, '2026-11-10T08:00:00.000Z', [{ templateId: 'A', name: 'Haut', weekdays: [1] }]),
    ];
    expect(sessionsOn('2026-11-04', versions, [])[0]!.weekdays).toEqual([1, 3]);
    expect(sessionsOn('2026-11-11', versions, [])[0]!.weekdays).toEqual([1]);
    // Avant la première version (programme migré), la première version sert.
    expect(sessionsOn('2026-10-01', versions.slice(1), [])[0]!.weekdays).toEqual([1]);
    const weeks = cycleWeeks({ ...base, templates: [A], versions });
    expect(weeks[0]!.slots.map((s) => s.date)).toEqual(['2026-11-02', '2026-11-04']);
    expect(weeks[1]!.slots.map((s) => s.date)).toEqual(['2026-11-09']);
  });

  it('volume de chaque semaine et séries par muscle, prévues et faites', () => {
    const input = { ...base, workouts: [workout('w1', '2026-11-02', 'A')], sets: [set('w1', 100, 5), set('w1', 100, 5)] };
    expect(cycleWeeks(input)[0]!.volumeKg).toBe(1000);
    const resolve: MuscleResolver = (id) => (id === 'bench' ? { muscle: 'pectoraux', secondary: ['triceps'] } : null);
    expect(musclePlanVsDone([A, B], 'p', input.workouts, input.sets, resolve, '2026-11-02', '2026-11-08')).toEqual([{ muscle: 'pectoraux', planned: 6, done: 2 }]);
  });

  it('progression des exercices et records du programme', () => {
    const ws = [workout('w1', '2026-11-02', 'A'), workout('w2', '2026-11-09', 'A'), workout('w3', '2026-11-16', 'A')];
    const sets = [set('w1', 80, 8), set('w2', 82.5, 8), set('w3', 85, 8), set('w1', 10, 12, 'curl')];
    const [bench] = exerciseProgress(['bench', 'curl'], ws, sets);
    expect(bench).toMatchObject({ exerciseId: 'bench', sessions: 3, change: 6.2 });
    expect(exerciseProgress(['curl'], ws, sets)).toEqual([]);
    const records = programRecords(new Set(['w2', 'w3']), ws, sets, '2026-11-10');
    expect(records.map((r) => r.workoutId)).toEqual(['w3']);
  });

  it('historique : versions et choix PULSE sur les séances du programme, du plus récent au plus ancien', () => {
    const versions = [version(1, '2026-11-01T08:00:00.000Z', []), version(2, '2026-11-12T08:00:00.000Z', [], 'Haut : 4 séries (avant 3)')];
    const pulse = [
      {
        ...sync('d1'),
        date: '2026-11-09',
        plannedTemplateId: 'A',
        choice: 'alleger',
        decisions: [{ at: T, action: 'accepter', choice: 'alleger', adjustment: { source: 'pulse', setsDelta: -1, rirDelta: 0 } }],
      },
      { ...sync('d2'), date: '2026-11-10', plannedTemplateId: 'A', choice: 'garder' },
      { ...sync('d3'), date: '2026-11-11', plannedTemplateId: 'Z', choice: 'alleger' },
    ] as PulseDay[];
    const h = programHistory('p', versions, pulse, [A, B], null);
    expect(h.map((e) => [e.kind, e.date])).toEqual([
      ['version', '2026-11-12'],
      ['pulse', '2026-11-09'],
      ['version', '2026-11-01'],
    ]);
    expect(h[1]).toMatchObject({ session: 'Haut' });
    expect(h[1]!.text).toMatch(/^Accepté : version allégée/);
  });
});
