import { afterEach, describe, expect, it } from 'vitest';
import { ForgeDB } from './schema';
import { clearAllData, countRecords } from './maintenance';
import { createMetaRepo } from './repositories/meta';
import { createProfileRepo } from './repositories/profile';
import { createWeighInRepo } from './repositories/weighIns';

let db: ForgeDB;
afterEach(async () => {
  await db.delete();
});

describe('maintenance de la base', () => {
  it('efface tout, profil, pesées et réglages', async () => {
    db = new ForgeDB(`test-${crypto.randomUUID()}`);
    await createProfileRepo(db).update({ firstName: 'Coz' });
    const weighIns = createWeighInRepo(db);
    await weighIns.add({ date: '2026-11-23', time: '07:00', weightKg: 90.2 });
    await createMetaRepo(db).set('onboarding', { completedAt: '2026-11-23T07:00:00.000Z' });

    expect(await countRecords(db)).toEqual({ weighIns: 1, hasProfile: true });
    await clearAllData(db);
    expect(await countRecords(db)).toEqual({ weighIns: 0, hasProfile: false });
    expect(await db.meta.count()).toBe(0);
  });

  it("fusionne l'état de l'onboarding sans perdre les étapes déjà faites", async () => {
    db = new ForgeDB(`test-${crypto.randomUUID()}`);
    const meta = createMetaRepo(db);
    await meta.merge('onboarding', { installSkipped: true });
    await meta.merge('onboarding', { welcomeDone: true });
    expect(await meta.get('onboarding')).toEqual({ installSkipped: true, welcomeDone: true });
  });
});
