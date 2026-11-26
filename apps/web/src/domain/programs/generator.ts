import { EXERCISE_LIBRARY } from '../../data/exerciseLibrary';
import type { Need } from '../../data/exerciseTraits';
import { MUSCLE_LABELS, type MuscleGroup } from '../../data/muscles';
import type { Experience, ProgramObjective, Workout } from '../../db/types';
import { addDays } from '../../lib/dates';
import { PRIORITY_MUSCLES, type Goal, type PlanAnswers, type ThreeDaySplit, type TrainingAnswers, type TrainingPlan, type Zone } from '../plan';
import { OBJECTIVE_LABELS, OBJECTIVES } from './status';

/**
 * Assistant de programme (FORGE PROGRAMS) : les réponses, leur pré-remplissage, et ce qu'on en tire.
 * Le moteur reste `trainingPlan` ; ici, rien que de la mise en forme et des contrôles.
 */

/** Dernières réponses de l'assistant, gardées dans la table meta pour pré-remplir la fois suivante. */
export const GENERATOR_KEY = 'programGenerator';

export type SessionMinutes = PlanAnswers['sessionMinutes'];
export const SESSION_MINUTES: readonly SessionMinutes[] = [30, 45, 60, 75, 90];
export const MAX_PRIORITIES = 3;
/** Une liste de favoris ou d'exercices à éviter reste courte : au-delà, le programme ne ressemble plus à rien. */
export const MAX_PICKS = 12;

export interface GeneratorAnswers {
  objective: ProgramObjective | null;
  secondaryObjective: ProgramObjective | null;
  experience: Experience | null;
  returning: boolean;
  weekdays: number[];
  sessionMinutes: SessionMinutes | null;
  split: ThreeDaySplit | null;
  place: 'salle' | 'maison' | null;
  equipment: Need[];
  equipmentStyle: 'machines' | 'libres' | null;
  priorities: MuscleGroup[];
  repStyle: 'lourd' | 'leger' | null;
  favorites: string[];
  avoid: string[];
  zones: Zone[];
}

export interface GeneratorRecord {
  answers: GeneratorAnswers;
  savedAt: string;
}

/** L'objectif du questionnaire, traduit en objectif de programme. */
export const GOAL_TO_OBJECTIVE: Record<Goal, ProgramObjective> = {
  muscle: 'hypertrophie',
  force: 'force',
  perte: 'perte-de-gras',
  recompo: 'recomposition',
  forme: 'remise-en-forme',
};

export const OBJECTIVE_TEXTS: Record<ProgramObjective, string> = {
  hypertrophie: 'Prendre du muscle : volume suffisant, séries de 6 à 15 répétitions.',
  force: 'Soulever plus lourd sur les grands mouvements, séries courtes.',
  'endurance-musculaire': 'Tenir plus longtemps : séries longues, repos courts.',
  'remise-en-forme': 'Reprendre une routine, apprendre les mouvements, charges modérées.',
  'perte-de-gras': 'Garder ton muscle pendant que tu perds du gras : l’entraînement reste lourd.',
  recomposition: 'Plus de muscle et moins de gras à poids stable.',
  athletique: 'Une base de force pour le sport. Pas encore d’exercices de sauts ni de puissance.',
  maintien: 'Garder ton niveau et continuer de progresser, sans viser un cycle précis.',
};

const NEEDS: readonly Need[] = ['halteres', 'banc', 'barre', 'traction', 'kettlebell'];
const ZONES: readonly Zone[] = ['epaules', 'genoux', 'dos'];
const LIBRARY_IDS = new Set(EXERCISE_LIBRARY.map((e) => e.id));

export const emptyAnswers = (): GeneratorAnswers => ({
  objective: null,
  secondaryObjective: null,
  experience: null,
  returning: false,
  weekdays: [],
  sessionMinutes: null,
  split: null,
  place: null,
  equipment: [],
  equipmentStyle: null,
  priorities: [],
  repStyle: null,
  favorites: [],
  avoid: [],
  zones: [],
});

const oneOf = <T>(v: unknown, values: readonly T[]): T | null => (values.includes(v as T) ? (v as T) : null);
const listOf = <T>(v: unknown, values: readonly T[] | ((x: unknown) => boolean), max: number): T[] => {
  if (!Array.isArray(v)) return [];
  const ok = typeof values === 'function' ? values : (x: unknown) => values.includes(x as T);
  return [...new Set(v.filter(ok) as T[])].slice(0, max);
};

/** Relit un enregistrement de la table meta (qui peut venir d'une sauvegarde importée) : tout ce qui est douteux est ignoré. */
export function readGeneratorRecord(v: unknown): GeneratorAnswers | null {
  if (!v || typeof v !== 'object' || !('answers' in v)) return null;
  const a = (v as { answers: unknown }).answers;
  if (!a || typeof a !== 'object') return null;
  const r = a as Record<string, unknown>;
  const objective = oneOf(r.objective, OBJECTIVES);
  const secondary = oneOf(r.secondaryObjective, OBJECTIVES);
  return {
    objective,
    secondaryObjective: secondary && secondary !== objective ? secondary : null,
    experience: oneOf(r.experience, ['beginner', 'intermediate', 'advanced'] as const),
    returning: r.returning === true,
    weekdays: listOf<number>(r.weekdays, [1, 2, 3, 4, 5, 6, 7], 6).sort((x, y) => x - y),
    sessionMinutes: oneOf(r.sessionMinutes, SESSION_MINUTES),
    split: oneOf(r.split, ['corps-entier', 'haut-bas', 'ppl'] as const),
    place: oneOf(r.place, ['salle', 'maison'] as const),
    equipment: listOf(r.equipment, NEEDS, NEEDS.length),
    equipmentStyle: oneOf(r.equipmentStyle, ['machines', 'libres'] as const),
    priorities: listOf(r.priorities, PRIORITY_MUSCLES, MAX_PRIORITIES),
    repStyle: oneOf(r.repStyle, ['lourd', 'leger'] as const),
    favorites: listOf<string>(r.favorites, (x) => typeof x === 'string' && LIBRARY_IDS.has(x), MAX_PICKS),
    avoid: listOf<string>(r.avoid, (x) => typeof x === 'string' && LIBRARY_IDS.has(x), MAX_PICKS),
    zones: listOf(r.zones, ZONES, ZONES.length),
  };
}

/**
 * Point de départ de l'assistant : ses dernières réponses, sinon le questionnaire de départ, sinon le profil.
 * Rien n'est deviné : ce qui n'est connu nulle part reste vide et sera demandé.
 */
export function prefillAnswers(
  previous: GeneratorAnswers | null,
  questionnaire: Partial<PlanAnswers> | null | undefined,
  profile: { experience?: Experience; returningAfterBreak?: boolean; goal?: Goal } | null | undefined,
): GeneratorAnswers {
  if (previous) return previous;
  const q = questionnaire ?? {};
  const goal = q.goal ?? profile?.goal;
  const weekdays = (q.weekdays ?? []).filter((d) => d >= 1 && d <= 7).slice(0, 6);
  return {
    ...emptyAnswers(),
    objective: goal ? GOAL_TO_OBJECTIVE[goal] : null,
    experience: q.experience ?? profile?.experience ?? null,
    returning: q.returning ?? profile?.returningAfterBreak ?? false,
    weekdays,
    sessionMinutes: q.sessionMinutes && SESSION_MINUTES.includes(q.sessionMinutes) ? q.sessionMinutes : null,
    split: weekdays.length === 3 ? (q.split ?? null) : null,
    place: q.place ?? null,
    equipment: q.equipment ?? [],
    zones: q.zones ?? [],
  };
}

export type GeneratorStep = 'objectif' | 'niveau' | 'semaine' | 'lieu' | 'priorites' | 'exercices';
export const GENERATOR_STEPS: readonly GeneratorStep[] = ['objectif', 'niveau', 'semaine', 'lieu', 'priorites', 'exercices'];

/** Ce qui manque pour passer l'étape, en une phrase ; null si tout va bien. */
export function stepProblem(step: GeneratorStep, a: GeneratorAnswers): string | null {
  switch (step) {
    case 'objectif':
      return a.objective ? null : 'Choisis l’objectif du programme.';
    case 'niveau':
      return a.experience ? null : 'Choisis ton niveau.';
    case 'semaine':
      if (!a.weekdays.length) return 'Choisis au moins un jour.';
      if (a.weekdays.length > 6) return 'Garde au moins un jour de repos par semaine.';
      if (!a.sessionMinutes) return 'Choisis la durée d’une séance.';
      return a.weekdays.length === 3 && !a.split ? 'Choisis comment répartir tes 3 séances.' : null;
    case 'lieu':
      return a.place ? null : 'Choisis où tu t’entraînes.';
    case 'priorites':
      return a.priorities.length > MAX_PRIORITIES ? `Garde ${MAX_PRIORITIES} priorités au plus.` : null;
    case 'exercices':
      return a.favorites.some((id) => a.avoid.includes(id)) ? 'Un exercice ne peut pas être à la fois favori et à éviter.' : null;
  }
}

/** Réponses complètes (chaque étape validée) vers l'entrée du moteur. */
export function toTrainingAnswers(a: GeneratorAnswers): TrainingAnswers {
  if (!a.objective || !a.experience || !a.sessionMinutes || !a.place || !a.weekdays.length) throw new Error('Réponses incomplètes.');
  return {
    programGoal: a.objective,
    experience: a.experience,
    returning: a.returning,
    weekdays: a.weekdays,
    sessionMinutes: a.sessionMinutes,
    ...(a.weekdays.length === 3 && a.split ? { split: a.split } : {}),
    place: a.place,
    equipment: a.place === 'maison' ? a.equipment : [],
    zones: a.zones,
    priorities: a.priorities,
    avoid: a.avoid,
    favorites: a.favorites.filter((id) => !a.avoid.includes(id)),
    // Les machines n'existent qu'en salle.
    equipmentStyle: a.place === 'salle' ? a.equipmentStyle : null,
    repStyle: a.repStyle,
  };
}

/** « Hypertrophie, 4 séances » : le nom proposé, que l'utilisateur peut changer. */
export function defaultProgramName(objective: ProgramObjective, sessions: number): string {
  return `${OBJECTIVE_LABELS[objective]}, ${sessions} séance${sessions > 1 ? 's' : ''}`;
}

/** Note du programme : d'où il vient, les choix qui le distinguent, et s'il a été ajusté à la main avant validation. */
export function generatedNote(plan: Pick<TrainingPlan, 'sessions' | 'splitLabel'>, a: GeneratorAnswers, adjusted = false): string {
  const n = plan.sessions.length;
  const parts = [`Généré par l’assistant FORGE : ${n} séance${n > 1 ? 's' : ''} par semaine, ${plan.splitLabel}.`];
  if (a.priorities.length) parts.push(`Priorités : ${a.priorities.map((m) => MUSCLE_LABELS[m].toLocaleLowerCase('fr-FR')).join(', ')}.`);
  if (adjusted) parts.push('Ajusté par toi avant validation.');
  return parts.join(' ').slice(0, 500);
}

/** Nombre de semaines (lundi à dimanche) où au moins une séance a été terminée. */
export function trainedWeeks(workouts: readonly Pick<Workout, 'date' | 'endedAt' | 'deletedAt'>[]): number {
  const weeks = new Set<string>();
  for (const w of workouts) {
    if (w.deletedAt || !w.endedAt) continue;
    const day = new Date(`${w.date}T12:00:00`).getDay() || 7;
    weeks.add(addDays(w.date, 1 - day));
  }
  return weeks.size;
}

/** Un repère factuel pour choisir son niveau, tiré de l'historique ; null sans séance terminée. */
export function historyHint(weeks: number): string | null {
  if (!weeks) return null;
  return `Dans FORGE, tu as terminé des séances sur ${weeks} semaine${weeks > 1 ? 's' : ''}. Ton niveau tient aussi compte de ce que tu as fait avant.`;
}

/**
 * Contexte pour proposer des remplaçants hors de l'assistant (éditeur de séance) : matériel, zones, exercices à éviter
 * et préférences connues, tirés des dernières réponses de l'assistant, sinon du questionnaire. Inconnu : aucun filtre.
 */
export function swapContext(
  generator: GeneratorAnswers | null,
  questionnaire: Partial<PlanAnswers> | null | undefined,
): Pick<TrainingAnswers, 'place' | 'equipment' | 'zones' | 'avoid' | 'favorites' | 'equipmentStyle'> {
  if (generator?.place)
    return {
      place: generator.place,
      equipment: generator.place === 'maison' ? generator.equipment : [],
      zones: generator.zones,
      avoid: generator.avoid,
      favorites: generator.favorites,
      equipmentStyle: generator.place === 'salle' ? generator.equipmentStyle : null,
    };
  if (questionnaire?.place)
    return { place: questionnaire.place, equipment: questionnaire.place === 'maison' ? (questionnaire.equipment ?? []) : [], zones: questionnaire.zones ?? [] };
  return { place: 'salle', equipment: [], zones: [] };
}
