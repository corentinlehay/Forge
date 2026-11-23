import Dexie from 'dexie';
import { DEMO_DB_NAME, setDemoMode } from '../db/dataMode';
import { closeDb, ForgeDB, SCHEMA_VERSION } from '../db/schema';
import { generateDemoData } from '../domain/demo';
import { toLocalDateKey } from '../lib/dates';
import { BACKUP_FORMAT, BACKUP_VERSION, importBackup, type Backup } from './backup';

/**
 * Démo : une base à part (« forge-demo »), remplie de données fictives.
 * Entrer ou sortir recharge l'app sur la bonne base ; tes données réelles ne sont jamais touchées.
 */
export async function loadDemoData(now: Date = new Date(), name = DEMO_DB_NAME): Promise<void> {
  await Dexie.delete(name);
  const db = new ForgeDB(name);
  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    schemaVersion: SCHEMA_VERSION,
    tables: generateDemoData(toLocalDateKey(now), now),
  };
  await importBackup(db, backup, 'replace');
  db.close();
}

export async function enterDemo(): Promise<void> {
  closeDb();
  await loadDemoData();
  setDemoMode(true);
  window.location.assign('/');
}

/** Quitte la démo et supprime toutes les données fictives. */
export async function exitDemo(): Promise<void> {
  closeDb();
  setDemoMode(false);
  await Dexie.delete(DEMO_DB_NAME);
  window.location.assign('/');
}

/** Régénère la démo autour d'aujourd'hui (les dates fictives suivent le calendrier). */
export async function reloadDemo(): Promise<void> {
  closeDb();
  await loadDemoData();
  window.location.assign('/');
}
