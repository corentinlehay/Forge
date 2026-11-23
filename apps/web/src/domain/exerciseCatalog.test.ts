import { describe, expect, it } from 'vitest';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { MUSCLE_GROUPS } from '../data/muscles';
import { buildCatalog, catalogItem, searchCatalog } from './exerciseCatalog';
import { niceScale } from './chartScale';
import { formatClock, formatRest, moveItem, nextSet, remainingSec, restFor } from './workoutFlow';

const sync = { createdAt: 'x', updatedAt: 'x', deletedAt: null };

describe('bibliothèque', () => {
  it('couvre les 15 groupes musculaires avec des fiches complètes et uniques', () => {
    expect(new Set(EXERCISE_LIBRARY.map((e) => e.id)).size).toBe(EXERCISE_LIBRARY.length);
    expect(new Set(EXERCISE_LIBRARY.map((e) => e.name)).size).toBe(EXERCISE_LIBRARY.length);
    for (const m of MUSCLE_GROUPS)
      expect(
        EXERCISE_LIBRARY.some((e) => e.muscle === m),
        m,
      ).toBe(true);
    for (const e of EXERCISE_LIBRARY) {
      expect(e.cues.length, e.name).toBeGreaterThanOrEqual(2);
      expect(e.secondary).not.toContain(e.muscle);
    }
  });
});

describe('catalogue', () => {
  it('fusionne un ancien exercice du même nom et garde les exercices perso', () => {
    const items = buildCatalog([
      { ...sync, id: 'old', name: 'développé couché' },
      { ...sync, id: 'perso', name: 'Tirage Pendlay maison', muscle: 'dos' },
    ]);
    const bench = catalogItem(items, 'barbell_bench_press_-_medium_grip')!;
    expect(bench.exercise?.id).toBe('old');
    expect(catalogItem(items, 'old')?.key).toBe('barbell_bench_press_-_medium_grip');
    const perso = catalogItem(items, 'perso')!;
    expect(perso).toMatchObject({ library: null, muscle: 'dos', images: null });
    expect(items).toHaveLength(EXERCISE_LIBRARY.length + 1);
  });
  it('cherche sans accents et filtre par muscle', () => {
    const items = buildCatalog([]);
    expect(searchCatalog(items, 'developpe incl', null).map((i) => i.name)).toEqual(['Développé incliné à la barre', 'Développé incliné aux haltères']);
    expect(searchCatalog(items, '', 'mollets').map((i) => i.name)).toEqual(['Mollets assis', 'Mollets debout', 'Mollets debout aux haltères']);
  });
});

describe('séance en direct', () => {
  const set = (exerciseId: string, position: number) => ({
    ...sync,
    id: `${exerciseId}${position}`,
    workoutId: 'w',
    exerciseId,
    position,
    weightKg: 50,
    reps: 8,
  });
  const targets = [
    { exerciseId: 'a', sets: 2, reps: '8', restSec: 150 },
    { exerciseId: 'b', sets: 1, reps: '10' },
  ];
  it('enchaîne les séries prévues dans l’ordre', () => {
    expect(nextSet(['a', 'b'], [], targets)).toEqual({
      exerciseId: 'a',
      setNumber: 1,
      plannedSets: 2,
    });
    expect(nextSet(['a', 'b'], [set('a', 0), set('a', 1)], targets)).toEqual({
      exerciseId: 'b',
      setNumber: 1,
      plannedSets: 1,
    });
    expect(nextSet(['a', 'b'], [set('a', 0), set('a', 1), set('b', 2)], targets)).toBeNull();
  });
  it('en séance libre, continue l’exercice en cours', () => {
    expect(nextSet(['x'], [], [])).toEqual({
      exerciseId: 'x',
      setNumber: 1,
      plannedSets: null,
    });
    expect(nextSet(['x', 'y'], [set('x', 0)], [])).toEqual({
      exerciseId: 'x',
      setNumber: 2,
      plannedSets: null,
    });
  });
  it('repos : objectif de la séance, puis celui de l’exercice, puis 90 s', () => {
    expect(restFor('a', targets, 60)).toBe(150);
    expect(restFor('b', targets, 75)).toBe(75);
    expect(restFor('c', targets, null)).toBe(90);
  });
  it('minuteur et formats', () => {
    expect(remainingSec(10_500, 10_000)).toBe(1);
    expect(remainingSec(9_000, 10_000)).toBe(0);
    expect(formatClock(95)).toBe('1:35');
    expect(formatRest(90)).toBe('1 min 30');
    expect(formatRest(120)).toBe('2 min');
    expect(formatRest(45)).toBe('45 s');
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('échelle', () => {
  it('produit des graduations rondes', () => {
    expect(niceScale(81, 112).ticks).toEqual([80, 90, 100, 110, 120]);
    expect(niceScale(1200, 3900).ticks).toEqual([1000, 2000, 3000, 4000]);
    expect(niceScale(100, 100, 4, 4).ticks.length).toBeGreaterThan(1);
  });
});

describe('caractéristiques des exercices', () => {
  it('chaque exercice de la bibliothèque a un schéma de mouvement et son matériel', async () => {
    const { TRAITS } = await import('../data/exerciseTraits');
    expect(EXERCISE_LIBRARY.filter((e) => !TRAITS[e.id]).map((e) => e.id)).toEqual([]);
    expect(Object.keys(TRAITS).filter((id) => !EXERCISE_LIBRARY.some((e) => e.id === id))).toEqual([]);
  });
});
