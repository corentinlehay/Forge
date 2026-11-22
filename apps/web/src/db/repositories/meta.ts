import type { ForgeDB } from '../schema';
import { nowIso } from '../../lib/ids';

/** Réglages et état système : une valeur JSON par clé. */
export function createMetaRepo(db: ForgeDB) {
  return {
    async get<T>(key: string): Promise<T | null> {
      const entry = await db.meta.get(key);
      return entry ? (entry.value as T) : null;
    },

    async set(key: string, value: unknown, now: Date = new Date()): Promise<void> {
      await db.meta.put({ key, value, updatedAt: nowIso(now) });
    },

    /** Fusionne un objet avec la valeur existante (utile pour l'état de l'onboarding). */
    async merge<T extends object>(key: string, patch: Partial<T>, now: Date = new Date()): Promise<T> {
      const current = await db.meta.get(key);
      const base = current && typeof current.value === 'object' && current.value !== null ? (current.value as T) : ({} as T);
      const next = { ...base, ...patch } as T;
      await db.meta.put({ key, value: next, updatedAt: nowIso(now) });
      return next;
    },
  };
}
