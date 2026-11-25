import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutSet } from '../db/types';
import { workoutStats } from './training';
import { IDENTITY_LINES, heavy, pick, sameType, tonnes, volumeMoment, volumeTexts } from './volumeMoment';

const base = { createdAt: 'x', updatedAt: 'x', deletedAt: null };
const workout = (id: string, date: string, o: Partial<Workout> = {}): Workout => ({
  ...base,
  id,
  date,
  name: 'Poussée',
  templateId: 'push',
  exerciseIds: [],
  startedAt: `${date}T17:00:00.000Z`,
  endedAt: `${date}T18:00:00.000Z`,
  ...o,
});
let n = 0;
const set = (workoutId: string, exerciseId: string, weightKg: number, reps: number): WorkoutSet => ({ ...base, id: `s${++n}`, workoutId, exerciseId, position: n, weightKg, reps });
/** Une séance d'un seul exercice dont le volume vaut exactement `kg` (charge × 1 répétition). */
const sessionOf = (id: string, date: string, kg: number, o: Partial<Workout> = {}) => ({ w: workout(id, date, o), s: [set(id, 'dc', kg, 1)] });

const build = (list: { w: Workout; s: WorkoutSet[] }[], current: string) => {
  const workouts = list.map((x) => x.w);
  const sets = list.flatMap((x) => x.s);
  return volumeMoment(
    workouts.find((w) => w.id === current)!,
    workouts,
    sets,
  );
};

describe('volume d’une séance', () => {
  it('reprend exactement le volume de la séance et le construit série par série, dans l’ordre des exercices', () => {
    const w = workout('w', '2026-11-25', { exerciseIds: ['dc', 'dm'] });
    const sets = [set('w', 'dm', 20, 10), set('w', 'dc', 80, 8), set('w', 'dc', 80, 7), set('w', 'pompes', 0, 15)];
    const m = volumeMoment(w, [w], sets);
    expect(m.volumeKg).toBe(workoutStats(w, sets).volumeKg);
    expect(m.exercises.map((e) => e.exerciseId)).toEqual(['dc', 'dm']);
    expect(m.exercises[0]!.sets.map((s) => s.untilKg)).toEqual([640, 1200]);
    expect(m.exercises[1]!.sets.at(-1)!.untilKg).toBe(1400);
    expect(m.bodyweightSets).toBe(1);
  });

  it('ignore les séances et séries supprimées', () => {
    const list = [sessionOf('a', '2026-11-10', 5000), sessionOf('b', '2026-11-25', 4000)];
    list[0]!.w.deletedAt = 'x';
    const m = build(list, 'b');
    expect(m.earlierCount).toBe(0);
    expect(m.previous).toBeNull();
  });

  it('même type : même modèle du programme, sinon même nom', () => {
    expect(sameType(workout('a', 'd'), workout('b', 'd', { name: 'Autre' }))).toBe(true);
    expect(sameType(workout('a', 'd', { templateId: 'x' }), workout('b', 'd'))).toBe(false);
    expect(sameType(workout('a', 'd', { templateId: null }), workout('b', 'd', { templateId: null, name: ' poussée ' }))).toBe(true);
  });
});

describe('records, paliers et comparaisons', () => {
  const pull = (id: string, date: string, kg: number) => sessionOf(id, date, kg, { templateId: 'pull', name: 'Tirage' });

  it('record toutes séances, ancien record et palier franchi', () => {
    const m = build([sessionOf('a', '2026-11-04', 4200), pull('b', '2026-11-06', 4800), sessionOf('c', '2026-11-11', 4600), sessionOf('d', '2026-11-18', 5300)], 'd');
    expect(m.record).toBe('toutes');
    expect(m.bestBefore).toMatchObject({ id: 'b', volumeKg: 4800 });
    expect(m.previous).toMatchObject({ id: 'c', volumeKg: 4600 });
    expect(m.milestoneKg).toBe(5000);
    expect(m.latest).toBe(true);
    const t = volumeTexts(m, 'Poussée', 'd');
    expect(t.badges.map((b) => b.text)).toEqual(['Record de volume', 'Palier 5 tonnes']);
    expect(t.facts[0]).toEqual({ value: '+700 kg', label: 'par rapport à ta séance Poussée du 11 novembre (4\u202f600 kg)' });
    expect(t.facts[1]!.label).toBe('ancien record, le 6 novembre');
  });

  it('l’ancien record n’est pas répété quand c’est la séance précédente', () => {
    const m = build([sessionOf('a', '2026-11-04', 4000), sessionOf('b', '2026-11-11', 4200)], 'b');
    expect(m.record).toBe('toutes');
    expect(volumeTexts(m, 'Poussée', 'b').facts.map((f) => f.label)).toEqual([
      'par rapport à ta séance Poussée du 4 novembre (4\u202f000 kg)',
      'soulevés depuis ta première séance, en 2 séances',
    ]);
  });

  it('record du type seulement, sans palier ni record général', () => {
    const m = build([pull('a', '2026-11-04', 9000), sessionOf('b', '2026-11-11', 4600), sessionOf('c', '2026-11-18', 4700)], 'c');
    expect(m.record).toBe('type');
    expect(m.milestoneKg).toBeNull();
    expect(volumeTexts(m, 'Poussée', 'c').badges).toEqual([{ kind: 'record', text: 'Record Poussée' }]);
  });

  it('un palier déjà franchi ne compte pas deux fois', () => {
    const m = build([sessionOf('a', '2026-11-04', 5200), sessionOf('b', '2026-11-11', 5100)], 'b');
    expect(m.milestoneKg).toBeNull();
    expect(m.record).toBeNull();
  });

  it('palier du total depuis la première séance', () => {
    const m = build([sessionOf('a', '2026-11-04', 6000), sessionOf('b', '2026-11-11', 3000), sessionOf('c', '2026-11-18', 2000)], 'c');
    expect(m.lifetimeKg).toBe(11000);
    expect(m.lifetimeMilestoneKg).toBe(10000);
    expect(volumeTexts(m, 'Poussée', 'c').hook).toBe('Avec cette séance, tu passes les 10 tonnes soulevées depuis ta première séance.');
  });

  it('une ancienne séance parle au passé de son record', () => {
    const m = build([sessionOf('a', '2026-11-04', 4000), sessionOf('b', '2026-11-11', 4500), sessionOf('c', '2026-11-18', 4800)], 'b');
    expect(m.latest).toBe(false);
    expect(volumeTexts(m, 'Poussée', 'b').hook).toBe('Record de volume ce jour-là : ta plus grosse séance jusque-là.');
  });

  it('l’historique du graphique s’arrête à la séance affichée et garde le même type', () => {
    const list = [pull('p', '2026-10-01', 3000), ...Array.from({ length: 10 }, (_, i) => sessionOf(`w${i}`, `2026-10-${String(10 + i).padStart(2, '0')}`, 4000 + i))];
    const m = build(list, 'w9');
    expect(m.history).toHaveLength(8);
    expect(m.history.at(-1)).toMatchObject({ id: 'w9', volumeKg: 4009 });
    expect(m.history.some((h) => h.id === 'p')).toBe(false);
  });
});

describe('messages', () => {
  const texts = (list: { w: Workout; s: WorkoutSet[] }[], id: string) => volumeTexts(build(list, id), 'Poussée', id);

  it('première séance : aucune comparaison inventée', () => {
    const t = texts([sessionOf('a', '2026-11-25', 6361)], 'a');
    expect(['Première séance dans FORGE. Le premier chiffre d’une longue série.', 'Ta première séance est enregistrée. C’est ton point de départ.']).toContain(t.hook);
    expect(t.badges).toEqual([]);
    expect(t.facts).toEqual([]);
  });

  it('première séance de ce type : la référence est posée', () => {
    const t = texts([sessionOf('a', '2026-11-04', 7000, { templateId: 'pull', name: 'Tirage' }), sessionOf('b', '2026-11-25', 2000)], 'b');
    expect(t.hook).toMatch(/référence/);
    expect(t.facts.map((f) => f.value)).toEqual(['9\u202f000 kg']);
  });

  it('progression, même niveau, baisse, séance allégée', () => {
    // Ni record, ni palier, ni palier du total : seule la comparaison avec la dernière séance Poussée parle.
    const big = (kg: number, o: Partial<Workout> = {}) => [
      sessionOf('r', '2026-10-28', 4000, { templateId: 'z', name: 'Z' }),
      sessionOf('x', '2026-11-01', 3200),
      sessionOf('a', '2026-11-04', 3000),
      sessionOf('b', '2026-11-11', kg, o),
    ];
    expect([
      'Le travail est fait. La progression aussi.',
      'Plus que ta dernière séance Poussée. C’est exactement ce qu’on cherche.',
      '+100 kg sur ta dernière séance Poussée. Ça avance.',
    ]).toContain(texts(big(3100), 'b').hook);
    expect(texts(big(3030), 'b').hook).toMatch(/même niveau|Aussi solide/);
    expect(texts(big(2500), 'b').hook).toMatch(/Moins de volume|Pas ton plus gros total/);
    expect(texts(big(2500, { adjustment: { kind: 'allege' } as unknown as Workout['adjustment'] }), 'b').hook).toBe(
      'Version allégée, comme prévu. Récupérer fait aussi partie du travail.',
    );
  });

  it('en cours de séance : ce qu’il reste pour égaler la dernière fois, sans badge', () => {
    const list = [sessionOf('a', '2026-11-04', 5000), sessionOf('b', '2026-11-25', 3800, { endedAt: null })];
    const t = texts(list, 'b');
    expect(t.lead).toBe('Tu as déjà déplacé');
    expect(t.hook).toBe('Encore 1\u202f200 kg pour égaler ta dernière séance Poussée.');
    expect(t.badges).toEqual([]);
    expect(t.facts.map((f) => f.label)).toEqual(['soulevés depuis ta première séance, en 2 séances']);
  });

  it('même séance, même texte ; séances différentes, formulations variées', () => {
    const list = [sessionOf('a', '2026-11-25', 6361)];
    expect(texts(list, 'a')).toEqual(texts(list, 'a'));
    const seen = new Set(Array.from({ length: 40 }, (_, i) => pick(IDENTITY_LINES, `w${i}`)));
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it('formats : tonnes et grands totaux', () => {
    expect(tonnes(1000)).toBe('1 tonne');
    expect(tonnes(2500)).toBe('2,5 tonnes');
    expect(tonnes(12_500)).toBe('12,5 tonnes');
    expect(heavy(6361)).toBe('6 361 kg');
    expect(heavy(15_420)).toBe('15,4 t');
    expect(heavy(148_230)).toBe('148 t');
  });

  it('note sur les séries au poids du corps', () => {
    const w = workout('w', '2026-11-25');
    const m = volumeMoment(w, [w], [set('w', 'dc', 60, 10), set('w', 'pompes', 0, 20), set('w', 'pompes', 0, 18)]);
    expect(volumeTexts(m, 'Poussée', 'w').footnote).toBe('Volume : charge × répétitions de chaque série. Les 2 séries au poids du corps n’y entrent pas.');
  });
});
