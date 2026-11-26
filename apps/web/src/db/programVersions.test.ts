import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ForgeDB } from './schema';
import { createExerciseRepo, createProgramRepo, createProgramVersionRepo, createTemplateRepo, createWorkoutRepo } from './repositories/entities';

const dbs: ForgeDB[] = [];
afterEach(async () => {
  for (const db of dbs.splice(0)) {
    db.close();
    await db.delete();
  }
});
const open = async () => {
  const db = new ForgeDB(`versions-${crypto.randomUUID()}`);
  dbs.push(db);
  await db.open();
  return {
    db,
    programs: createProgramRepo(db),
    templates: createTemplateRepo(db),
    versions: createProgramVersionRepo(db),
    workouts: createWorkoutRepo(db),
    exercises: createExerciseRepo(db),
  };
};

describe('versions des programmes', () => {
  it('version de départ, mise à jour tant que personne ne l’a suivie, puis nouvelle version après une séance', async () => {
    const { programs, templates, versions, workouts, exercises } = await open();
    const bench = await exercises.add({ name: 'Développé couché' });
    const p = await programs.add({ name: 'Force', active: true, status: 'actif' });
    const t = await templates.add({ name: 'Haut A', weekdays: [1], exercises: [{ exerciseId: bench.id, sets: 3, reps: '8-10' }], position: 0, programId: p.id });

    const v1 = await versions.sync(p.id);
    expect(v1).toMatchObject({ version: 1, changeSummary: 'Version de départ' });
    expect((await programs.get(p.id))?.currentVersionId).toBe(v1!.id);

    // Pas encore suivie : la modification met à jour la version 1.
    await templates.update(t.id, { weekdays: [1, 4] });
    const again = await versions.sync(p.id);
    expect(again?.id).toBe(v1!.id);
    expect(again?.snapshot.sessions[0]?.weekdays).toEqual([1, 4]);
    expect(await versions.list(p.id)).toHaveLength(1);

    // Une séance suit la version 1 : la modification suivante crée la version 2.
    await workouts.add({
      date: '2026-11-26',
      name: 'Haut A',
      templateId: t.id,
      exerciseIds: [bench.id],
      startedAt: '2026-11-26T17:00:00.000Z',
      programId: p.id,
      programVersionId: v1!.id,
    });
    await templates.update(t.id, { exercises: [{ exerciseId: bench.id, sets: 4, reps: '6-8' }] });
    const v2 = await versions.sync(p.id);
    expect(v2).toMatchObject({ version: 2, changeSummary: 'Haut A, Développé couché : 4 séries (avant 3), 6-8 rép. (avant 8-10)' });
    expect((await programs.get(p.id))?.currentVersionId).toBe(v2!.id);
    // L'ancienne version reste telle quelle.
    expect((await versions.get(v1!.id))?.snapshot.sessions[0]?.exercises[0]?.sets).toBe(3);

    // Rien de changé : rien de créé.
    expect((await versions.sync(p.id))?.id).toBe(v2!.id);
    expect(await versions.list(p.id)).toHaveLength(2);
  });

  it('programme introuvable : rien', async () => {
    const { versions } = await open();
    expect(await versions.sync('absent')).toBeNull();
  });
});
