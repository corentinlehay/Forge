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

  it('statuts : activer met l’ancien programme en pause, jamais supprimé ; un seul actif', async () => {
    const { programs } = await open();
    const now = new Date('2026-11-26T09:00:00');
    const a = await programs.add({ name: 'A', active: false, status: 'brouillon' }, now);
    const b = await programs.add({ name: 'B', active: false, status: 'brouillon' }, now);
    await programs.setStatus(a.id, 'actif', now);
    await programs.setStatus(b.id, 'actif', new Date('2026-12-03T09:00:00'));
    const [pa, pb] = await Promise.all([programs.get(a.id), programs.get(b.id)]);
    expect(pa).toMatchObject({ status: 'pause', active: false, startDate: '2026-11-26' });
    expect(pb).toMatchObject({ status: 'actif', active: true, startDate: '2026-12-03' });
    // Reprendre garde la date de début du cycle.
    await programs.setStatus(a.id, 'actif', new Date('2026-12-10T09:00:00'));
    expect(await programs.get(a.id)).toMatchObject({ status: 'actif', startDate: '2026-11-26' });
    expect((await programs.listActive()).filter((p) => p.active)).toHaveLength(1);
  });

  it('terminer pose la fin du cycle ; recommencer repart d’aujourd’hui', async () => {
    const { programs } = await open();
    const p = await programs.add({ name: 'Cycle', active: false, status: 'brouillon', durationWeeks: 8 });
    await programs.setStatus(p.id, 'actif', new Date('2026-10-01T09:00:00'));
    await programs.setStatus(p.id, 'termine', new Date('2026-11-26T09:00:00'));
    expect(await programs.get(p.id)).toMatchObject({ status: 'termine', active: false, endDate: '2026-11-26' });
    await programs.setStatus(p.id, 'actif', new Date('2026-12-01T09:00:00'));
    expect(await programs.get(p.id)).toMatchObject({ status: 'actif', startDate: '2026-12-01', endDate: null });
  });

  it('la copie est un brouillon qui garde objectif, durée et description', async () => {
    const { programs } = await open();
    const p = await programs.add({ name: 'Force 4 j', active: true, status: 'actif', objective: 'force', durationWeeks: 10, note: 'Bloc de force', startDate: '2026-11-01' });
    const copy = await programs.duplicate(p.id);
    expect(copy).toMatchObject({ status: 'brouillon', active: false, objective: 'force', durationWeeks: 10, note: 'Bloc de force' });
    expect(copy.startDate).toBeUndefined();
  });

  it('refuse une durée de cycle, un objectif ou une description hors limites', async () => {
    const { programs } = await open();
    await expect(programs.add({ name: 'X', active: false, durationWeeks: 0 })).rejects.toThrow('Durée du cycle');
    await expect(programs.add({ name: 'X', active: false, objective: 'yoga' as never })).rejects.toThrow('Objectif');
    await expect(programs.add({ name: 'X', active: false, note: 'a'.repeat(501) })).rejects.toThrow('Description');
  });

  it('refuse un RIR ou un repos hors limites', async () => {
    const { templates } = await open();
    await expect(templates.add({ name: 'X', weekdays: [], exercises: [{ exerciseId: 'e', sets: 3, reps: '8', rir: 12 }], position: 0 })).rejects.toThrow('RIR');
  });
});
