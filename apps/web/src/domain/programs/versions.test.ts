import { describe, expect, it } from 'vitest';
import type { Program, ProgramVersion, WorkoutTemplate } from '../../db/types';
import { diffSnapshots, planVersion, sameSnapshot, snapshotOf, summaryText, FIRST_VERSION_SUMMARY } from './versions';

const base = { createdAt: '2026-11-01', updatedAt: '2026-11-01', deletedAt: null };
const program: Program = { ...base, id: 'p', name: 'Force 4 jours', active: true, objective: 'force', durationWeeks: 8 };
const tpl = (id: string, o: Partial<WorkoutTemplate> = {}): WorkoutTemplate => ({
  ...base,
  id,
  name: id,
  weekdays: [1],
  position: 0,
  programId: 'p',
  exercises: [{ exerciseId: 'dc', sets: 3, reps: '8-10', restSec: 120, rir: 2 }],
  ...o,
});
const names: Record<string, string> = { dc: 'Développé couché', sq: 'Squat', curl: 'Curl' };
const nameOf = (id: string) => names[id] ?? id;

describe('photo d’un programme', () => {
  it('garde les séances du programme dans l’ordre, sans les supprimées ni celles des autres programmes', () => {
    const snap = snapshotOf(program, [tpl('B', { position: 1 }), tpl('A'), tpl('X', { programId: 'q' }), tpl('Z', { deletedAt: 'x' })]);
    expect(snap.sessions.map((s) => s.name)).toEqual(['A', 'B']);
    expect(snap).toMatchObject({ name: 'Force 4 jours', objective: 'force', durationWeeks: 8 });
  });

  it('même programme, même photo, quel que soit l’ordre des jours ou une position renumérotée', () => {
    const a = snapshotOf(program, [tpl('A', { weekdays: [4, 1] })]);
    const b = snapshotOf(program, [tpl('A', { weekdays: [1, 4], position: 3 })]);
    expect(sameSnapshot(a, b)).toBe(true);
    expect(sameSnapshot(a, snapshotOf(program, [tpl('A', { weekdays: [1] })]))).toBe(false);
  });
});

describe('changements entre deux versions', () => {
  it('décrit chaque changement en une phrase', () => {
    const before = snapshotOf(program, [tpl('Haut A'), tpl('Bas A', { position: 1, weekdays: [2] })]);
    const after = snapshotOf({ ...program, durationWeeks: 10 }, [
      tpl('Haut A', {
        weekdays: [1, 4],
        warmup: '5 min de rameur',
        exercises: [
          { exerciseId: 'dc', sets: 4, reps: '6-8', restSec: 150, rir: 1, startWeightKg: 60, notes: 'Pause d’une seconde en bas' },
          { exerciseId: 'curl', sets: 3, reps: '10-12' },
        ],
      }),
      tpl('Bras', { position: 2, weekdays: [6], exercises: [] }),
    ]);
    expect(diffSnapshots(before, after, nameOf)).toEqual([
      'Cycle : 10 semaines (avant : 8 semaines)',
      'Séance retirée : Bas A',
      'Haut A : lun., jeu. (avant : lun.)',
      'Haut A : échauffement modifié',
      'Haut A, Développé couché : 4 séries (avant 3), 6-8 rép. (avant 8-10), repos 2 min 30 (avant 2 min), RIR visé 1 (avant 2), charge de départ 60 kg, consigne modifiée',
      'Haut A : Curl ajouté (3 × 10-12)',
      'Séance ajoutée : Bras (sam., 0 exercice)',
    ]);
  });

  it('repère un exercice retiré, un renommage et un changement d’ordre', () => {
    const two = [
      { exerciseId: 'dc', sets: 3, reps: '8' },
      { exerciseId: 'sq', sets: 3, reps: '5' },
      { exerciseId: 'curl', sets: 2, reps: '12' },
    ];
    const before = snapshotOf(program, [tpl('A', { exercises: two })]);
    const after = snapshotOf({ ...program, name: 'Force 5 jours' }, [tpl('A', { name: 'Haut', exercises: [two[1]!, two[0]!] })]);
    expect(diffSnapshots(before, after, nameOf)).toEqual([
      'Programme renommé « Force 5 jours » (avant « Force 4 jours »)',
      'Séance « A » renommée « Haut »',
      'Haut : Curl retiré',
      'Haut : ordre des exercices modifié',
    ]);
  });

  it('le résumé reste borné', () => {
    const long = Array.from({ length: 80 }, (_, i) => `Changement numéro ${i} avec un peu de texte`);
    const text = summaryText(long);
    expect(text.length).toBeLessThanOrEqual(1000);
    expect(text.endsWith('…')).toBe(true);
    expect(summaryText([])).toBe('Aucun changement visible');
  });
});

describe('quand créer une version', () => {
  const v = (id: string, version: number, snap = snapshotOf(program, [tpl('A')])): ProgramVersion => ({ ...base, id, programId: 'p', version, snapshot: snap, changeSummary: '' });
  const changed = snapshotOf(program, [tpl('A', { weekdays: [3] })]);

  it('première fois : version de départ ; photo identique : rien', () => {
    expect(planVersion([], null, changed, () => false, nameOf)).toEqual({ kind: 'creer', version: 1, summary: FIRST_VERSION_SUMMARY });
    expect(planVersion([v('v1', 1)], 'v1', snapshotOf(program, [tpl('A')]), () => false, nameOf)).toEqual({ kind: 'rien' });
  });

  it('version courante jamais suivie : elle est mise à jour, sans nouvelle version', () => {
    expect(planVersion([v('v1', 1)], 'v1', changed, () => false, nameOf)).toEqual({ kind: 'mettre-a-jour', id: 'v1', summary: FIRST_VERSION_SUMMARY });
    const plan = planVersion([v('v1', 1), v('v2', 2, snapshotOf(program, [tpl('A', { weekdays: [2] })]))], 'v2', changed, (id) => id === 'v1', nameOf);
    expect(plan).toEqual({ kind: 'mettre-a-jour', id: 'v2', summary: 'A : mer. (avant : lun.)' });
  });

  it('version courante déjà suivie par une séance : nouvelle version avec ce qui a changé', () => {
    expect(planVersion([v('v1', 1)], 'v1', changed, () => true, nameOf)).toEqual({ kind: 'creer', version: 2, summary: 'A : mer. (avant : lun.)' });
  });
});
