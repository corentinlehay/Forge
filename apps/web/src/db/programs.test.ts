import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ForgeDB } from './schema';
import { createProgramRepo, createTemplateRepo } from './repositories/entities';

const dbs: ForgeDB[] = [];
afterEach(async () => {
  for (const db of dbs.splice(0)) {
    db.close();
    await db.delete();
  }
});
const open = async () => {
  const db = new ForgeDB(`programs-${crypto.randomUUID()}`);
  dbs.push(db);
  await db.open();
  return { db, programs: createProgramRepo(db), templates: createTemplateRepo(db) };
};

describe('programmes', () => {
  it('crée « Mon programme » au premier besoin et n’en garde qu’un actif', async () => {
    const { programs } = await open();
    const first = await programs.ensureActive();
    expect(first).toMatchObject({ name: 'Mon programme', active: true });
    expect((await programs.ensureActive()).id).toBe(first.id);
    const second = await programs.add({ name: 'Force', active: false });
    await programs.activate(second.id);
    const all = await programs.listActive();
    expect(all.filter((p) => p.active).map((p) => p.id)).toEqual([second.id]);
  });

  it('duplique un programme avec ses séances, sans l’activer', async () => {
    const { programs, templates } = await open();
    const prog = await programs.ensureActive();
    await templates.add({ name: 'Upper A', weekdays: [1], exercises: [{ exerciseId: 'e1', sets: 3, reps: '8-10', restSec: 120, rir: 2 }], position: 0, programId: prog.id });
    const copy = await programs.duplicate(prog.id);
    expect(copy).toMatchObject({ name: 'Mon programme (copie)', active: false });
    const copied = (await templates.listActive()).filter((t) => t.programId === copy.id);
    expect(copied).toHaveLength(1);
    expect(copied[0]!.exercises[0]).toMatchObject({ restSec: 120, rir: 2 });
  });

  it('supprime un programme et ses séances', async () => {
    const { programs, templates } = await open();
    const prog = await programs.ensureActive();
    await templates.add({ name: 'Lower A', weekdays: [2], exercises: [], position: 0, programId: prog.id });
    await programs.removeWithTemplates(prog.id);
    expect(await programs.listActive()).toHaveLength(0);
    expect(await templates.listActive()).toHaveLength(0);
  });

  it('refuse un RIR ou un repos hors limites', async () => {
    const { templates } = await open();
    await expect(templates.add({ name: 'X', weekdays: [], exercises: [{ exerciseId: 'e', sets: 3, reps: '8', rir: 12 }], position: 0 })).rejects.toThrow('RIR');
  });
});
