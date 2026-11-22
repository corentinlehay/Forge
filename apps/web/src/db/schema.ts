import Dexie, { type EntityTable } from 'dexie';
import type { MetaEntry, Profile, WeighIn } from './types';

/**
 * Base locale unique de FORGE (IndexedDB via Dexie).
 * Règle : une montée de version ajoute ou transforme, elle ne détruit jamais de données.
 * Chaque nouvelle version est accompagnée d'un test de migration.
 */
export const SCHEMA_VERSION = 1;

export class ForgeDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  weighIns!: EntityTable<WeighIn, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;

  constructor(name = 'forge') {
    super(name);
    this.version(1).stores({
      profile: 'id, updatedAt',
      weighIns: 'id, date, [date+time], updatedAt',
      meta: 'key',
    });
  }
}

let shared: ForgeDB | null = null;

/** Instance partagée par toute l'app (les tests créent leurs propres bases). */
export function getDb(): ForgeDB {
  shared ??= new ForgeDB();
  return shared;
}
