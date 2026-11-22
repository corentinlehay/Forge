import type { ForgeDB } from '../schema';
import type { WeighIn, WeighInContext } from '../types';
import { isDateKey, isTimeKey } from '../../lib/dates';
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../lib/format';
import { newId, nowIso } from '../../lib/ids';

export interface WeighInInput {
  date: string;
  time: string;
  weightKg: number;
  context?: WeighInContext;
  note?: string;
}

export class WeighInError extends Error {}

function validate(input: Partial<WeighInInput>): void {
  if (input.date !== undefined && !isDateKey(input.date)) throw new WeighInError('Date invalide.');
  if (input.time !== undefined && !isTimeKey(input.time)) throw new WeighInError('Heure invalide.');
  if (input.weightKg !== undefined) {
    const w = input.weightKg;
    if (!Number.isFinite(w) || w < WEIGHT_MIN_KG || w > WEIGHT_MAX_KG) {
      throw new WeighInError(`Le poids doit être compris entre ${WEIGHT_MIN_KG} et ${WEIGHT_MAX_KG} kg.`);
    }
  }
  if (input.note !== undefined && input.note.length > 500) throw new WeighInError('Note trop longue (500 caractères maximum).');
}

export function createWeighInRepo(db: ForgeDB) {
  return {
    async add(input: WeighInInput, now: Date = new Date()): Promise<WeighIn> {
      validate(input);
      const stamp = nowIso(now);
      const record: WeighIn = {
        id: newId(),
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
        date: input.date,
        time: input.time,
        weightKg: Math.round(input.weightKg * 100) / 100,
        ...(input.context ? { context: input.context } : {}),
        ...(input.note ? { note: input.note } : {}),
      };
      await db.weighIns.add(record);
      return record;
    },

    async update(id: string, patch: Partial<WeighInInput>, now: Date = new Date()): Promise<WeighIn> {
      validate(patch);
      const existing = await db.weighIns.get(id);
      if (!existing || existing.deletedAt) throw new WeighInError('Pesée introuvable.');
      const next: WeighIn = {
        ...existing,
        ...patch,
        ...(patch.weightKg !== undefined ? { weightKg: Math.round(patch.weightKg * 100) / 100 } : {}),
        updatedAt: nowIso(now),
      };
      await db.weighIns.put(next);
      return next;
    },

    /** Suppression logique : la pesée disparaît des écrans mais reste traçable pour la synchronisation. */
    async remove(id: string, now: Date = new Date()): Promise<void> {
      const stamp = nowIso(now);
      const changed = await db.weighIns.update(id, { deletedAt: stamp, updatedAt: stamp });
      if (changed === 0) throw new WeighInError('Pesée introuvable.');
    },

    /** Pesées actives, de la plus ancienne à la plus récente. */
    async listActive(): Promise<WeighIn[]> {
      const all = await db.weighIns.orderBy('[date+time]').toArray();
      return all.filter((w) => !w.deletedAt);
    },
  };
}

export type WeighInRepo = ReturnType<typeof createWeighInRepo>;
