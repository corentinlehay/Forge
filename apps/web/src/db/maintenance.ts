import type { ForgeDB } from './schema';

/**
 * Efface toutes les données de l'appareil, en une seule transaction.
 * Réservé au bouton « Tout effacer » des réglages, après confirmation explicite.
 */
export async function clearAllData(db: ForgeDB): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}

/** Nombre d'enregistrements actifs par table, pour les écrans de sauvegarde et d'import. */
export async function countRecords(db: ForgeDB): Promise<{ weighIns: number; hasProfile: boolean }> {
  const [weighIns, profile] = await Promise.all([db.weighIns.filter((w) => !w.deletedAt).count(), db.profile.get('me')]);
  return { weighIns, hasProfile: Boolean(profile) };
}
