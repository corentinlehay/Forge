import { describe, expect, it } from 'vitest';
import { trainingPlan } from '../plan';
import {
  defaultProgramName,
  emptyAnswers,
  generatedNote,
  historyHint,
  prefillAnswers,
  readGeneratorRecord,
  stepProblem,
  toTrainingAnswers,
  trainedWeeks,
  type GeneratorAnswers,
} from './generator';

const full: GeneratorAnswers = {
  ...emptyAnswers(),
  objective: 'hypertrophie',
  experience: 'intermediate',
  weekdays: [1, 3, 5],
  sessionMinutes: 60,
  split: 'ppl',
  place: 'salle',
  equipmentStyle: 'machines',
  priorities: ['pectoraux'],
};

describe('assistant de programme', () => {
  it('pré-remplit avec les dernières réponses, sinon le questionnaire, sinon le profil, sans rien deviner', () => {
    expect(prefillAnswers(full, { goal: 'force' }, null)).toBe(full);
    const q = prefillAnswers(
      null,
      { goal: 'perte', experience: 'beginner', weekdays: [2, 4], sessionMinutes: 45, place: 'maison', equipment: ['halteres'], zones: ['genoux'] },
      { experience: 'advanced' },
    );
    expect(q).toMatchObject({
      objective: 'perte-de-gras',
      experience: 'beginner',
      weekdays: [2, 4],
      sessionMinutes: 45,
      place: 'maison',
      equipment: ['halteres'],
      zones: ['genoux'],
      split: null,
    });
    expect(prefillAnswers(null, null, { experience: 'advanced', goal: 'muscle' })).toMatchObject({
      objective: 'hypertrophie',
      experience: 'advanced',
      weekdays: [],
      sessionMinutes: null,
      place: null,
    });
    expect(prefillAnswers(null, null, null)).toEqual(emptyAnswers());
  });

  it('relit un enregistrement abîmé sans planter et en écartant le douteux', () => {
    expect(readGeneratorRecord(null)).toBeNull();
    expect(readGeneratorRecord({ answers: 'x' })).toBeNull();
    const r = readGeneratorRecord({
      answers: {
        objective: 'force',
        secondaryObjective: 'force',
        weekdays: [5, 1, 9, 1],
        sessionMinutes: 50,
        priorities: ['dos', 'jambes', 'biceps', 'triceps', 'mollets'],
        favorites: ['barbell_squat', 'inconnu'],
        place: 'parc',
      },
    })!;
    expect(r).toMatchObject({
      objective: 'force',
      secondaryObjective: null,
      weekdays: [1, 5],
      sessionMinutes: null,
      priorities: ['dos', 'biceps', 'triceps'],
      favorites: ['barbell_squat'],
      place: null,
    });
  });

  it('chaque étape dit ce qui manque', () => {
    const a = emptyAnswers();
    expect(stepProblem('objectif', a)).toBe('Choisis l’objectif du programme.');
    expect(stepProblem('niveau', a)).toBe('Choisis ton niveau.');
    expect(stepProblem('semaine', a)).toBe('Choisis au moins un jour.');
    expect(stepProblem('semaine', { ...a, weekdays: [1, 3, 5], sessionMinutes: 60 })).toBe('Choisis comment répartir tes 3 séances.');
    expect(stepProblem('semaine', { ...a, weekdays: [1, 2, 3, 4, 5, 6, 7], sessionMinutes: 60 })).toBe('Garde au moins un jour de repos par semaine.');
    expect(stepProblem('lieu', a)).toBe('Choisis où tu t’entraînes.');
    expect(stepProblem('exercices', { ...a, favorites: ['barbell_squat'], avoid: ['barbell_squat'] })).toMatch(/favori et à éviter/);
    for (const s of ['objectif', 'niveau', 'semaine', 'lieu', 'priorites', 'exercices'] as const) expect(stepProblem(s, full)).toBeNull();
  });

  it('vers le moteur : machines seulement en salle, matériel seulement à la maison', () => {
    expect(() => toTrainingAnswers(emptyAnswers())).toThrow();
    const gym = toTrainingAnswers({ ...full, equipment: ['halteres'] });
    expect(gym).toMatchObject({ programGoal: 'hypertrophie', split: 'ppl', equipment: [], equipmentStyle: 'machines' });
    const home = toTrainingAnswers({ ...full, place: 'maison', equipment: ['halteres'], weekdays: [1, 4] });
    expect(home).toMatchObject({ equipment: ['halteres'], equipmentStyle: null });
    expect(home).not.toHaveProperty('split');
  });

  it('nom proposé et note du programme', () => {
    expect(defaultProgramName('hypertrophie', 4)).toBe('Hypertrophie, 4 séances');
    expect(defaultProgramName('force', 1)).toBe('Force, 1 séance');
    const plan = trainingPlan(toTrainingAnswers(full));
    expect(generatedNote(plan, full)).toBe('Généré par l’assistant FORGE : 3 séances par semaine, poussée, tirage, jambes. Priorités : pectoraux.');
  });

  it('historique : semaines entraînées, du lundi au dimanche, séances terminées seulement', () => {
    const w = (date: string, ended = true, deleted = false) => ({ date, endedAt: ended ? `${date}T19:00:00.000Z` : null, deletedAt: deleted ? 'x' : null });
    // 2026-11-23 est un lundi, 2026-11-29 un dimanche.
    expect(trainedWeeks([w('2026-11-23'), w('2026-11-29'), w('2026-11-30'), w('2026-12-02', false), w('2026-12-09', true, true)])).toBe(2);
    expect(historyHint(0)).toBeNull();
    expect(historyHint(1)).toMatch(/^Dans FORGE, tu as terminé des séances sur 1 semaine\./);
  });
});
