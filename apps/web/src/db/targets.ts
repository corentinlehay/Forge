import type { NutritionTargets, TargetChange } from './types';
import { createTargetChangeRepo } from './repositories/entities';
import { createProfileRepo } from './repositories/profile';
import type { ForgeDB } from './schema';
import { toLocalDateKey } from '../lib/dates';

/** Enregistre de nouveaux objectifs nutritionnels et garde la trace du changement. */
export async function saveTargets(db: ForgeDB, after: NutritionTargets, source: TargetChange['source'], reason?: string, now: Date = new Date()): Promise<void> {
  const profile = createProfileRepo(db);
  const before = (await profile.get()).nutritionTargets ?? null;
  await profile.update({ nutritionTargets: after }, now);
  await createTargetChangeRepo(db).add({ date: toLocalDateKey(now), before, after, source, ...(reason ? { reason } : {}) }, now);
}
