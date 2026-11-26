import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ForgeDB } from './schema';
import { createProgramRepo, createProgramVersionRepo, createTemplateRepo } from './repositories/entities';
import { saveGeneratedProgram } from './generatedProgram';
import { trainingPlan, type PlanAnswers } from '../domain/plan';

const dbs: ForgeDB[] = [];
afterEach(async () => {
  for (const db of dbs.splice(0)) {
    db.close();
    await db.delete();
  }
});
const answers = {
  goal: 'muscle',
  experience: 'intermediate',
  returning: false,
  weekdays: [1, 3, 5],
  sessionMinutes: 60,
  place: 'salle',
  equipment: [],
  zones: [],
} as unknown as PlanAnswers;

describe('programme généré', () => {
  it('naît en brouillon sans toucher au programme actif, avec ses séances et sa version de départ', async () => {
    const db = new ForgeDB(`gen-${crypto.randomUUID()}`);
    dbs.push(db);
    const programs = createProgramRepo(db);
    const current = await programs.add({ name: 'Actuel', active: true, status: 'actif' });
    const plan = trainingPlan(answers);
    const draft = await saveGeneratedProgram(db, plan, { name: 'Hypertrophie, 3 séances', objective: 'hypertrophie', note: 'n', activate: false });
    expect(draft).toMatchObject({ status: 'brouillon', active: false, source: 'genere', objective: 'hypertrophie' });
    expect(await programs.get(current.id)).toMatchObject({ status: 'actif', active: true });
    expect((await createTemplateRepo(db).listActive()).filter((t) => t.programId === draft.id)).toHaveLength(3);
    expect(await createProgramVersionRepo(db).list(draft.id)).toHaveLength(1);

    const active = await saveGeneratedProgram(db, plan, { name: 'Autre', objective: 'force', secondaryObjective: 'hypertrophie', note: 'n', activate: true });
    expect(active).toMatchObject({ status: 'actif', active: true, secondaryObjective: 'hypertrophie' });
    expect(await programs.get(current.id)).toMatchObject({ status: 'pause', active: false });
  });
});
