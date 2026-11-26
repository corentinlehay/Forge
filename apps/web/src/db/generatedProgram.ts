import { libraryExercise } from '../data/exerciseLibrary';
import type { TrainingPlan } from '../domain/plan';
import { createExerciseRepo, createProgramRepo, createProgramVersionRepo, createTemplateRepo } from './repositories/entities';
import type { ForgeDB } from './schema';
import type { Program, ProgramObjective } from './types';

export interface GeneratedProgramInfo {
  name: string;
  objective: ProgramObjective | null;
  secondaryObjective?: ProgramObjective | null;
  note: string;
  /** Vrai seulement sur un geste explicite de l'utilisateur (« Valider et activer »). */
  activate: boolean;
}

/**
 * Enregistre un programme généré : ses séances, les exercices de la bibliothèque, sa version de départ.
 * Il naît en brouillon ; il n'est activé que si l'utilisateur l'a demandé (l'ancien programme actif passe alors en pause).
 */
export async function saveGeneratedProgram(db: ForgeDB, plan: Pick<TrainingPlan, 'sessions'>, info: GeneratedProgramInfo, now: Date = new Date()): Promise<Program> {
  const programs = createProgramRepo(db);
  const templates = createTemplateRepo(db);
  const exercises = createExerciseRepo(db);
  const program = await programs.add(
    {
      name: info.name,
      active: false,
      status: 'brouillon',
      source: 'genere',
      objective: info.objective,
      ...(info.secondaryObjective ? { secondaryObjective: info.secondaryObjective } : {}),
      note: info.note.slice(0, 500),
    },
    now,
  );
  for (const [position, session] of plan.sessions.entries()) {
    const list = [];
    for (const e of session.exercises) {
      const lib = libraryExercise(e.libraryId);
      if (!lib) continue;
      const exercise = await exercises.fromLibrary(lib, now);
      list.push({ exerciseId: exercise.id, sets: e.sets, reps: e.reps, restSec: e.restSec, rir: e.rir });
    }
    await templates.add({ name: session.name, weekdays: [session.weekday], exercises: list, position, programId: program.id }, now);
  }
  await createProgramVersionRepo(db).sync(program.id, now);
  if (info.activate) await programs.activate(program.id, now);
  return (await programs.get(program.id))!;
}
