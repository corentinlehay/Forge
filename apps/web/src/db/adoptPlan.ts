import { GOAL_LABELS, type NutritionPlan, type PlanAnswers, type TrainingPlan } from '../domain/plan';
import { GOAL_TO_OBJECTIVE } from '../domain/programs/generator';
import { saveTargets } from './targets';
import { toLocalTimeKey } from '../lib/dates';
import { saveGeneratedProgram } from './generatedProgram';
import { createMetaRepo } from './repositories/meta';
import { createProfileRepo } from './repositories/profile';
import { createWeighInRepo } from './repositories/weighIns';
import type { ForgeDB } from './schema';

export const QUESTIONNAIRE_KEY = 'questionnaire';

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
    const program = await saveGeneratedProgram(
      db,
      training,
      {
        name: training.programName,
        objective: GOAL_TO_OBJECTIVE[answers.goal],
        note: `Généré par le questionnaire FORGE : ${training.sessions.length} séances par semaine, ${training.splitLabel}.`,
        activate: true,
      },
      now,
    );
    programId = program.id;
  }

  await createMetaRepo(db).set(QUESTIONNAIRE_KEY, { answers, completedAt: now.toISOString() } satisfies QuestionnaireRecord, now);
  return { programId };
}
