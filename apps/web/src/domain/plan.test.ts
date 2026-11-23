import { describe, expect, it } from 'vitest';
import { libraryExercise } from '../data/exerciseLibrary';
import { TRAITS } from '../data/exerciseTraits';
import { activityFactor, ageOn, bmrMifflin, nutritionPlan, trainingPlan, ZONE_EXCLUSIONS, type PlanAnswers } from './plan';

const base: PlanAnswers = {
  goal: 'muscle',
  sex: 'male',
  birthDate: '1991-05-10',
  heightCm: 180,
  weightKg: 80,
  activity: 'assis',
  experience: 'intermediate',
  returning: false,
  weekdays: [1, 2, 4, 5],
  sessionMinutes: 60,
  place: 'salle',
  equipment: [],
  zones: [],
};
const today = '2026-11-23';

describe('besoins nutritionnels', () => {
  it('calcule le métabolisme de base (Mifflin-St Jeor) et l’âge', () => {
    expect(ageOn('1991-05-10', today)).toBe(35);
    expect(ageOn('1991-12-10', today)).toBe(34);
    expect(bmrMifflin('male', 80, 180, 35)).toBe(1755);
    expect(bmrMifflin('female', 60, 165, 30)).toBe(1320.25);
    expect(activityFactor('assis', 4, 60)).toBe(1.45);
  });

  it('prise de muscle : +10 % et 0,25 à 0,5 % par semaine', () => {
    const r = nutritionPlan(base, today);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.maintenanceKcal).toBe(2540);
    expect(r.plan.targets.kcal).toBe(2790);
    expect(r.plan.gainRate).toEqual({ lowPctPerWeek: 0.25, highPctPerWeek: 0.5 });
    expect(r.plan.targets.proteinG).toBe(145);
    const { kcal, proteinG, carbsG, fatG } = r.plan.targets;
    expect(Math.abs(proteinG * 4 + carbsG * 4 + fatG * 9 - kcal)).toBeLessThan(40);
  });

  it('perte de gras : −20 %, 0,5 à 1 % par semaine, jamais sous le métabolisme de base', () => {
    const r = nutritionPlan({ ...base, goal: 'perte', weightKg: 95 }, today);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.gainRate).toEqual({ lowPctPerWeek: -1, highPctPerWeek: -0.5 });
    expect(r.plan.targets.kcal).toBeLessThan(r.plan.maintenanceKcal);
    expect(r.plan.targets.kcal).toBeGreaterThanOrEqual(r.plan.bmrKcal - 10);
  });

  it('pas de déficit avec un poids déjà bas, et protéines plafonnées en cas de surpoids', () => {
    const low = nutritionPlan({ ...base, goal: 'perte', weightKg: 62 }, today);
    if (!low.ok) throw new Error(low.reason);
    expect(low.plan.goal).toBe('recompo');
    expect(low.plan.targets.kcal).toBe(low.plan.maintenanceKcal);
    const heavy = nutritionPlan({ ...base, weightKg: 130 }, today);
    if (!heavy.ok) throw new Error(heavy.reason);
    expect(heavy.plan.targets.proteinG).toBeLessThan(130 * 1.8);
  });

  it('refuse un plan pour un mineur', () => {
    const r = nutritionPlan({ ...base, birthDate: '2010-01-01' }, today);
    expect(r.ok).toBe(false);
  });
});

describe('programme d’entraînement', () => {
  const ids = (p: ReturnType<typeof trainingPlan>) => p.sessions.flatMap((s) => s.exercises.map((e) => e.libraryId));

  it('choisit la répartition selon le nombre de jours et place les séances sur les jours choisis', () => {
    expect(trainingPlan({ ...base, weekdays: [1, 3, 5] }).sessions.map((s) => [s.name, s.weekday])).toEqual([
      ['Corps entier A', 1],
      ['Corps entier B', 3],
      ['Corps entier C', 5],
    ]);
    expect(trainingPlan(base).sessions.map((s) => s.name)).toEqual(['Haut du corps A', 'Bas du corps A', 'Haut du corps B', 'Bas du corps B']);
    expect(trainingPlan({ ...base, weekdays: [1, 2, 3, 5, 6] }).sessions).toHaveLength(5);
    expect(trainingPlan({ ...base, weekdays: [1, 2, 3, 4, 5, 6] }).sessions[3]!.name).toBe('Poussée B');
  });

  it('adapte le nombre d’exercices à la durée, sans doublon dans une séance', () => {
    for (const minutes of [45, 60, 75, 90] as const) {
      const p = trainingPlan({ ...base, sessionMinutes: minutes });
      for (const s of p.sessions) {
        expect(s.exercises.length).toBe({ 45: 4, 60: 5, 75: 6, 90: 7 }[minutes]);
        expect(new Set(s.exercises.map((e) => e.libraryId)).size).toBe(s.exercises.length);
      }
    }
  });

  it('varie les exercices entre les séances A et B', () => {
    const [upperA, , upperB] = trainingPlan(base).sessions;
    expect(upperA!.exercises[0]!.libraryId).not.toBe(upperB!.exercises[0]!.libraryId);
  });

  it('à la maison, n’utilise que le matériel disponible', () => {
    const home = trainingPlan({ ...base, place: 'maison', equipment: ['halteres', 'banc'] });
    for (const id of ids(home)) {
      expect(
        TRAITS[id]!.needs.every((n) => ['halteres', 'banc', 'charge'].includes(n)),
        id,
      ).toBe(true);
    }
    const bare = trainingPlan({ ...base, place: 'maison', equipment: [] });
    for (const id of ids(bare)) expect(TRAITS[id]!.needs, id).toEqual([]);
    expect(bare.warnings.join(' ')).toContain('tirage');
  });

  it('écarte les mouvements exigeants pour une zone à ménager', () => {
    const p = trainingPlan({ ...base, zones: ['dos', 'genoux'] });
    const used = ids(p);
    for (const id of [...ZONE_EXCLUSIONS.dos, ...ZONE_EXCLUSIONS.genoux]) expect(used).not.toContain(id);
    expect(p.excluded).toContain(libraryExercise('barbell_deadlift')!.name);
    expect(p.warnings.join(' ')).toContain('professionnel de santé');
  });

  it('prescrit séries, répétitions, repos et RIR selon l’objectif et le niveau', () => {
    const force = trainingPlan({ ...base, goal: 'force', experience: 'advanced' }).sessions[0]!.exercises;
    expect(force[0]).toMatchObject({ reps: '3-6', sets: 4, rir: 1 });
    expect(force[0]!.restSec).toBeGreaterThanOrEqual(180);
    const beginner = trainingPlan({ ...base, experience: 'beginner', returning: true }).sessions[0]!.exercises;
    expect(beginner[0]).toMatchObject({ sets: 3, rir: 3 });
  });
});
