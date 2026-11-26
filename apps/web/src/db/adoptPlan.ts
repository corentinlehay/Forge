import { GOAL_LABELS, type NutritionPlan, type PlanAnswers, type TrainingPlan } from '../domain/plan';
import type { ProgramObjective } from './types';
import { saveTargets } from './targets';
import { libraryExercise } from '../data/exerciseLibrary';
import { toLocalTimeKey } from '../lib/dates';
import { createExerciseRepo, createProgramRepo, createTemplateRepo } from './repositories/entities';
import { createMetaRepo } from './repositories/meta';
import { createProfileRepo } from './repositories/profile';
import { createWeighInRepo } from './repositories/weighIns';
import type { ForgeDB } from './schema';

export const QUESTIONNAIRE_KEY = 'questionnaire';

/** L'objectif du questionnaire, traduit en objectif de programme. */
const GOAL_TO_OBJECTIVE: Record<PlanAnswers['goal'], ProgramObjective> = {
  muscle: 'hypertrophie',
  force: 'force',
  perte: 'perte-de-gras',
  recompo: 'recomposition',
  forme: 'remise-en-forme',
};

export interface QuestionnaireRecord {
  answers: PlanAnswers;
  completedAt: string;
}

/**
 * Applique le plan du questionnaire. Rien n'est supprimé :
 * le programme est ajouté et activé (les anciens restent dans « Programmes »), les objectifs nutritionnels remplacés.
 */
export async function adoptPlan(
  db: ForgeDB,
  input: { answers: PlanAnswers; nutrition: NutritionPlan | null; training: TrainingPlan | null; today: string },
  now: Date = new Date(),
): Promise<{ programId: string | null }> {
  const { answers, nutrition, training, today } = input;
  const profile = createProfileRepo(db);
  await profile.update(
    {
      ...(answers.firstName ? { firstName: answers.firstName } : {}),
      birthDate: answers.birthDate,
      sex: answers.sex,
      heightCm: answers.heightCm,
      experience: answers.experience,
      returningAfterBreak: answers.returning,
      goal: nutrition?.goal ?? answers.goal,
      ...(nutrition ? { gainRate: nutrition.gainRate } : {}),
    },
    now,
  );
  if (nutrition) await saveTargets(db, nutrition.targets, 'questionnaire', `Plan de départ : ${GOAL_LABELS[nutrition.goal].toLocaleLowerCase('fr-FR')}`, now);

  const weighIns = createWeighInRepo(db);
  const todays = (await db.weighIns.where('date').equals(today).toArray()).filter((w) => !w.deletedAt);
  if (!todays.length) await weighIns.add({ date: today, time: toLocalTimeKey(now), weightKg: Math.round(answers.weightKg * 10) / 10 }, now);

  let programId: string | null = null;
  if (training && training.sessions.length) {
    const programs = createProgramRepo(db);
    const templates = createTemplateRepo(db);
    const exercises = createExerciseRepo(db);
    const program = await programs.add(
      {
        name: training.programName,
        active: false,
        status: 'brouillon',
        source: 'genere',
        objective: GOAL_TO_OBJECTIVE[answers.goal],
        note: `Généré par le questionnaire FORGE : ${training.sessions.length} séances par semaine, ${training.splitLabel}.`,
      },
      now,
    );
    for (const [position, session] of training.sessions.entries()) {
      const list = [];
      for (const e of session.exercises) {
        const lib = libraryExercise(e.libraryId);
        if (!lib) continue;
        const exercise = await exercises.fromLibrary(lib, now);
        list.push({ exerciseId: exercise.id, sets: e.sets, reps: e.reps, restSec: e.restSec, rir: e.rir });
      }
      await templates.add({ name: session.name, weekdays: [session.weekday], exercises: list, position, programId: program.id }, now);
    }
    await programs.activate(program.id, now);
    programId = program.id;
  }

  await createMetaRepo(db).set(QUESTIONNAIRE_KEY, { answers, completedAt: now.toISOString() } satisfies QuestionnaireRecord, now);
  return { programId };
}
