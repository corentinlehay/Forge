import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ForgeDB, SCHEMA_VERSION } from '../db/schema';
import { createProfileRepo } from '../db/repositories/profile';
import { createWeighInRepo } from '../db/repositories/weighIns';
import { createCheckInRepo, createPulseDayRepo } from '../db/repositories/entities';
import { backupFileName, exportBackup, importBackup, isBackupDue, markBackupDone, parseBackup, serializeBackup } from './backup';

const dbs: ForgeDB[] = [];

async function freshDb(): Promise<ForgeDB> {
  const db = new ForgeDB(`test-${crypto.randomUUID()}`);
  await db.open();
  dbs.push(db);
  return db;
}

let source: ForgeDB;

beforeEach(async () => {
  source = await freshDb();
  await createProfileRepo(source).update({ heightCm: 200, firstName: 'Coz' });
  const weighIns = createWeighInRepo(source);
  await weighIns.add({ date: '2026-11-22', time: '07:00', weightKg: 90.1 });
  await weighIns.add({ date: '2026-11-23', time: '07:05', weightKg: 90.2, context: 'morning_fasted' });
});

afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.delete()));
});

describe('sauvegarde et restauration', () => {
  it('restaure à l’identique après export, effacement et import', async () => {
    const text = serializeBackup(await exportBackup(source));
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const target = await freshDb();
    const report = await importBackup(target, parsed.backup, 'replace');
    expect(report.added).toBe(3);
    expect(await target.weighIns.toArray()).toEqual(await source.weighIns.toArray());
    expect(await target.profile.toArray()).toEqual(await source.profile.toArray());
  });

  it('garde un check-in aux réponses passées et le journal PULSE v2', async () => {
    await createCheckInRepo(source).add({ date: '2026-11-24', sleepHours: null, energy: 4, fatigue: null, soreness: null, unusualPain: true });
    const pulse = createPulseDayRepo(source);
    await pulse.saveSnapshot({
      date: '2026-11-24',
      engineVersion: 2,
      readiness: 66,
      confidence: 'basse',
      mode: 'allege',
      components: [],
      nutritionKind: 'sans-objectif',
      nutritionScore: null,
      rules: ['douleur-signalee'],
      plannedTemplateId: 't1',
      level: 'satisfaisante',
      coverage: 2,
      trainingKind: 'lighten',
    });
    await pulse.choose('2026-11-24', 'remplacer');
    const parsed = parseBackup(serializeBackup(await exportBackup(source)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const target = await freshDb();
    await importBackup(target, parsed.backup, 'replace');
    expect(await target.checkIns.toArray()).toEqual(await source.checkIns.toArray());
    expect((await target.pulseDays.toArray())[0]).toMatchObject({ level: 'satisfaisante', trainingKind: 'lighten', choice: 'remplacer' });
  });

  it('refuse un fichier illisible ou étranger sans rien écrire', () => {
    expect(parseBackup('pas du json').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: 'autre' })).ok).toBe(false);
  });

  it('refuse une sauvegarde venant d’une version plus récente', async () => {
    const backup = await exportBackup(source);
    const future = { ...backup, schemaVersion: SCHEMA_VERSION + 1 };
    const parsed = parseBackup(JSON.stringify(future));
    expect(parsed.ok).toBe(false);
  });

  it('fusionne en gardant la version la plus récente de chaque enregistrement', async () => {
    const backup = await exportBackup(source);
    const target = await freshDb();
    await importBackup(target, backup, 'replace');

    const [first] = await createWeighInRepo(target).listActive();
    await createWeighInRepo(target).update(first!.id, { weightKg: 89.9 }, new Date('2030-01-01T00:00:00Z'));
    await createWeighInRepo(source).add({ date: '2026-11-24', time: '07:00', weightKg: 90.4 });

    const report = await importBackup(target, await exportBackup(source), 'merge');
    expect(report.added).toBe(1);
    const merged = await createWeighInRepo(target).listActive();
    expect(merged).toHaveLength(3);
    expect(merged.find((w) => w.id === first!.id)?.weightKg).toBe(89.9);
  });

  it('nomme le fichier avec la date du jour', () => {
    expect(backupFileName(new Date(2026, 10, 23))).toBe('forge-sauvegarde-2026-11-23.json');
  });

  it('rappelle une sauvegarde au-delà de 7 jours', async () => {
    expect(await isBackupDue(source)).toBe(true);
    await markBackupDone(source, new Date('2026-11-23T08:00:00Z'));
    expect(await isBackupDue(source, 7, new Date('2026-11-25T08:00:00Z'))).toBe(false);
    expect(await isBackupDue(source, 7, new Date('2026-12-01T09:00:00Z'))).toBe(true);
  });
});

describe('compatibilité des sauvegardes', () => {
  it('importe une sauvegarde v1 (sans nutrition ni entraînement)', async () => {
    const { parseBackup } = await import('./backup');
    const v1 = {
      format: 'forge-backup',
      version: 1,
      exportedAt: '2026-11-23T07:00:00.000Z',
      schemaVersion: 1,
      tables: { profile: [], weighIns: [{ id: 'w', createdAt: 'a', updatedAt: 'a', deletedAt: null, date: '2026-11-23', time: '07:00', weightKg: 90.2 }], meta: [] },
    };
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.tables.workouts).toEqual([]);
  });
});
