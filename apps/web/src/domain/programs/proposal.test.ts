import { describe, expect, it } from 'vitest';
import { exerciseAccess, reviewSessions, swapOptions, trainingPlan, type TrainingAnswers } from '../plan';
import { libraryExercise } from '../../data/exerciseLibrary';
import { lowerFirst } from '../../lib/format';
import { TRAITS } from '../../data/exerciseTraits';
import { addExercise, changedIds, compareSessions, moveExercise, removeExercise, replaceExercise, sameSessions, setSets } from './proposal';

const a: TrainingAnswers = {
  programGoal: 'hypertrophie',
  experience: 'intermediate',
  returning: false,
  weekdays: [1, 3, 5],
  sessionMinutes: 60,
  place: 'salle',
  equipment: [],
  zones: [],
  split: 'ppl',
};
const plan = trainingPlan(a);
const push = plan.sessions[0]!;
const ids = (s = push) => s.exercises.map((e) => e.libraryId);

describe('modifier une proposition', () => {
  it('remplacer garde les séries et reprend la prescription du nouvel exercice', () => {
    const first = push.exercises[0]!;
    const { movement } = swapOptions(first.libraryId, a, ids());
    const next = replaceExercise(plan.sessions, 0, 0, movement[0]!, a);
    expect(next[0]!.exercises[0]).toMatchObject({ libraryId: movement[0], sets: first.sets });
    expect(plan.sessions[0]!.exercises[0]!.libraryId).toBe(first.libraryId);
    // Une isolation à la place : les répétitions de l'isolation.
    const iso = replaceExercise(plan.sessions, 0, 0, 'cable_crossover', a);
    expect(iso[0]!.exercises[0]!.reps).toBe('10-15');
    // Pas de doublon dans une séance.
    expect(replaceExercise(plan.sessions, 0, 0, ids()[1]!, a)).toEqual(plan.sessions);
  });

  it('ajouter, retirer, déplacer, changer les séries', () => {
    const added = addExercise(plan.sessions, 0, 'cable_crossover', a);
    expect(ids(added[0]).at(-1)).toBe('cable_crossover');
    expect(addExercise(added, 0, 'cable_crossover', a)).toEqual(added);
    const removed = removeExercise(plan.sessions, 0, 1);
    expect(removed[0]!.exercises).toHaveLength(push.exercises.length - 1);
    let one = plan.sessions;
    while (one[0]!.exercises.length > 1) one = removeExercise(one, 0, 0);
    expect(removeExercise(one, 0, 0)[0]!.exercises).toHaveLength(1);
    const moved = moveExercise(plan.sessions, 0, 0, 1);
    expect(ids(moved[0]).slice(0, 2)).toEqual([ids()[1], ids()[0]]);
    expect(moveExercise(plan.sessions, 0, 0, -1)).toEqual(plan.sessions);
    expect(setSets(plan.sessions, 0, 0, 12)[0]!.exercises[0]!.sets).toBe(8);
    expect(setSets(plan.sessions, 0, 0, 0)[0]!.exercises[0]!.sets).toBe(1);
  });

  it('dit ce qui a changé, séance par séance', () => {
    expect(compareSessions(plan.sessions, plan.sessions)).toEqual([]);
    expect(sameSessions(plan.sessions, plan.sessions)).toBe(true);
    let edited = replaceExercise(plan.sessions, 0, 0, 'machine_bench_press', a);
    edited = setSets(edited, 0, 1, 5);
    edited = removeExercise(edited, 2, 4);
    const [first, second] = compareSessions(plan.sessions, edited);
    const lower = (id: string) => lowerFirst(libraryExercise(id)!.name);
    expect(first).toBe(`Poussée : ${lower(ids()[0]!)} remplacé par ${lower('machine_bench_press')} ; ${lower(ids()[1]!)}, 5 séries (avant ${push.exercises[1]!.sets})`);
    expect(second).toMatch(/^Jambes : .+ retiré$/);
    expect(compareSessions(plan.sessions, moveExercise(plan.sessions, 1, 0, 1))).toEqual(['Tirage : ordre modifié']);
    expect([...changedIds(push, edited[0]!)]).toEqual(['machine_bench_press', ids()[1]]);
    // Remplacé puis déplacé : toujours un remplacement, reconnu au même mouvement.
    const pull = plan.sessions[1]!;
    const row = pull.exercises.findIndex((e) => TRAITS[e.libraryId]!.pattern === 'tirage-h');
    const other = swapOptions(pull.exercises[row]!.libraryId, a, ids(pull)).movement[0]!;
    const swappedMoved = moveExercise(replaceExercise(plan.sessions, 1, row, other, a), 1, row, row ? -1 : 1);
    expect(compareSessions(plan.sessions, swappedMoved)).toEqual([`Tirage : ${lower(pull.exercises[row]!.libraryId)} remplacé par ${lower(other)} ; ordre modifié`]);
  });

  it('les durées, le volume et leurs avertissements suivent les changements', () => {
    const more = addExercise(addExercise(plan.sessions, 2, 'leg_press', a), 2, 'seated_leg_curl', a);
    const review = reviewSessions(more, a);
    expect(review.sessions[2]!.estimatedMinutes).toBeGreaterThan(plan.sessions[2]!.estimatedMinutes);
    const quads = (r: { volume: { muscle: string; direct: number }[] }) => r.volume.find((v) => v.muscle === 'quadriceps')!.direct;
    expect(quads(review)).toBeGreaterThan(quads(plan));
    expect(plan.warnings).toEqual([...plan.fixedWarnings, ...reviewSessions(plan.sessions, a).warnings]);
  });
});

describe('remplacer un exercice', () => {
  it('le même mouvement d’abord, faisable avec le matériel et les zones', () => {
    const { movement, muscle } = swapOptions('barbell_bench_press_-_medium_grip', a);
    expect(movement.every((id) => TRAITS[id]!.pattern === 'pousse-h')).toBe(true);
    expect(movement).not.toContain('barbell_bench_press_-_medium_grip');
    expect(muscle.every((id) => libraryExercise(id)!.muscle === 'pectoraux' && TRAITS[id]!.pattern !== 'pousse-h')).toBe(true);
    const shoulders = swapOptions('barbell_bench_press_-_medium_grip', { ...a, zones: ['epaules'] });
    expect(shoulders.movement.slice(0, 3)).toEqual(['dumbbell_floor_press', 'machine_bench_press', 'dumbbell_bench_press']);
    expect(shoulders.movement).not.toContain('incline_dumbbell_press');
    const home = swapOptions('barbell_squat', { ...a, place: 'maison', equipment: ['halteres'] });
    expect(home.movement.every((id) => exerciseAccess({ ...a, place: 'maison', equipment: ['halteres'] }).usable(id))).toBe(true);
    expect(home.movement).not.toContain('leg_press');
  });

  it('les favoris passent en tête, les machines d’abord si tu le préfères', () => {
    expect(swapOptions('barbell_bench_press_-_medium_grip', { ...a, favorites: ['dumbbell_floor_press'] }).movement[0]).toBe('dumbbell_floor_press');
    expect(libraryExercise(swapOptions('barbell_bench_press_-_medium_grip', { ...a, equipmentStyle: 'machines' }).movement[0]!)!.equipment).toBe('machine');
    // En salle, le poids du corps passe après les exercices chargés, sauf favori.
    const gym = swapOptions('machine_bench_press', { ...a, equipmentStyle: 'machines' }).movement;
    expect(gym.slice(0, 3).every((id) => TRAITS[id]!.needs.length > 0)).toBe(true);
    expect(gym.indexOf('pushups')).toBeGreaterThan(gym.indexOf('dumbbell_bench_press'));
    expect(swapOptions('machine_bench_press', { ...a, favorites: ['pushups'] }).movement[0]).toBe('pushups');
  });

  it('dit pourquoi un exercice est écarté', () => {
    const access = exerciseAccess({ place: 'maison', equipment: ['halteres'], zones: ['epaules'], avoid: ['pushups'] });
    expect(access.blocked('pushups')).toBe('Dans tes exercices à éviter.');
    expect(access.blocked('standing_military_press')).toBe('Écarté pour ménager tes épaules.');
    expect(access.blocked('leg_press')).toBe('Se fait en salle.');
    expect(access.blocked('pullups')).toBe('Écarté pour ménager tes épaules.');
    expect(access.blocked('chin-up')).toBe('Écarté pour ménager tes épaules.');
    expect(exerciseAccess({ place: 'maison', equipment: [], zones: [] }).blocked('pullups')).toBe('Demande une barre de traction.');
    expect(access.blocked('goblet_squat')).toBeNull();
  });

  it('autre proposition : d’autres exercices du même mouvement, favoris gardés', () => {
    const other = trainingPlan({ ...a, variation: 1 });
    expect(compareSessions(plan.sessions, other.sessions).length).toBeGreaterThan(0);
    expect(trainingPlan({ ...a, variation: 1, favorites: ['barbell_squat'] }).sessions[2]!.exercises[0]!.libraryId).toBe('barbell_squat');
    expect(trainingPlan({ ...a, variation: 0 })).toEqual(plan);
  });
});
