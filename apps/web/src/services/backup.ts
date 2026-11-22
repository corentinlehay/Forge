import { z } from 'zod';
import { SCHEMA_VERSION, type ForgeDB } from '../db/schema';
import type { MetaEntry, Profile, WeighIn } from '../db/types';
import { toLocalDateKey } from '../lib/dates';
import { nowIso } from '../lib/ids';

/**
 * Sauvegarde complète de FORGE : un fichier JSON versionné, lisible, que l'iPhone
 * enregistre dans Fichiers ou iCloud Drive. L'import valide tout avant d'écrire quoi que ce soit.
 */

export const BACKUP_FORMAT = 'forge-backup';
export const BACKUP_VERSION = 1;
export const LAST_BACKUP_KEY = 'lastBackupAt';

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const syncFields = {
  id: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  deletedAt: z.string().nullable().optional(),
};

const profileSchema = z.object({
  ...syncFields,
  id: z.literal('me'),
  firstName: z.string().max(80).optional(),
  birthDate: dateKey.optional(),
  sex: z.enum(['male', 'female']).optional(),
  heightCm: z.number().min(100).max(250).optional(),
  experience: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  returningAfterBreak: z.boolean().optional(),
  gainRate: z.object({ lowPctPerWeek: z.number().min(0).max(2), highPctPerWeek: z.number().min(0).max(2) }),
});

const weighInSchema = z.object({
  ...syncFields,
  date: dateKey,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  weightKg: z.number().min(30).max(300),
  context: z.enum(['morning_fasted', 'other']).optional(),
  note: z.string().max(500).optional(),
});

const metaSchema = z.object({ key: z.string().min(1), value: z.unknown(), updatedAt: z.string().min(1) });

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  schemaVersion: z.number().int().min(1),
  tables: z.object({
    profile: z.array(profileSchema),
    weighIns: z.array(weighInSchema),
    meta: z.array(metaSchema),
  }),
});

export type Backup = z.infer<typeof backupSchema>;
export type ImportMode = 'replace' | 'merge';

export interface ImportReport {
  added: number;
  updated: number;
  unchanged: number;
}

export async function exportBackup(db: ForgeDB, now: Date = new Date()): Promise<Backup> {
  const [profile, weighIns, meta] = await Promise.all([db.profile.toArray(), db.weighIns.toArray(), db.meta.toArray()]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowIso(now),
    schemaVersion: SCHEMA_VERSION,
    tables: { profile, weighIns, meta },
  };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFileName(now: Date = new Date()): string {
  return `forge-sauvegarde-${toLocalDateKey(now)}.json`;
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

/** Lit et valide un fichier de sauvegarde, sans rien écrire. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Ce fichier n'est pas une sauvegarde FORGE lisible." };
  }
  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.length ? ` (${first.path.join('.')})` : '';
    return { ok: false, error: `Sauvegarde invalide${where} : ${first?.message ?? 'format inattendu'}.` };
  }
  if (result.data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: 'Cette sauvegarde vient d’une version plus récente de FORGE. Mets l’app à jour avant de l’importer.' };
  }
  return { ok: true, backup: result.data };
}

function isNewer(incoming: { updatedAt: string }, existing: { updatedAt: string } | undefined): boolean {
  return !existing || incoming.updatedAt > existing.updatedAt;
}

/**
 * Importe une sauvegarde validée, en une seule transaction (tout ou rien).
 * - replace : la base est vidée puis remplie avec la sauvegarde.
 * - merge : chaque enregistrement est ajouté, ou remplacé seulement s'il est plus récent.
 */
export async function importBackup(db: ForgeDB, backup: Backup, mode: ImportMode): Promise<ImportReport> {
  const report: ImportReport = { added: 0, updated: 0, unchanged: 0 };
  const { profile, weighIns, meta } = backup.tables;

  await db.transaction('rw', [db.profile, db.weighIns, db.meta], async () => {
    if (mode === 'replace') {
      await Promise.all([db.profile.clear(), db.weighIns.clear(), db.meta.clear()]);
      await db.profile.bulkPut(profile as Profile[]);
      await db.weighIns.bulkPut(weighIns as WeighIn[]);
      await db.meta.bulkPut(meta as MetaEntry[]);
      report.added = profile.length + weighIns.length + meta.length;
      return;
    }

    for (const record of profile as Profile[]) {
      const existing = await db.profile.get(record.id);
      if (isNewer(record, existing)) {
        await db.profile.put(record);
        existing ? report.updated++ : report.added++;
      } else report.unchanged++;
    }
    for (const record of weighIns as WeighIn[]) {
      const existing = await db.weighIns.get(record.id);
      if (isNewer(record, existing)) {
        await db.weighIns.put(record);
        existing ? report.updated++ : report.added++;
      } else report.unchanged++;
    }
    for (const record of meta as MetaEntry[]) {
      const existing = await db.meta.get(record.key);
      if (isNewer(record, existing)) {
        await db.meta.put(record);
        existing ? report.updated++ : report.added++;
      } else report.unchanged++;
    }
  });

  return report;
}

/** Note la date de la dernière sauvegarde (pour le rappel hebdomadaire). */
export async function markBackupDone(db: ForgeDB, now: Date = new Date()): Promise<void> {
  const stamp = nowIso(now);
  await db.meta.put({ key: LAST_BACKUP_KEY, value: stamp, updatedAt: stamp });
}

/** Vrai si la dernière sauvegarde date de plus de `days` jours (ou n'existe pas). */
export function isBackupOverdue(lastBackupAt: unknown, now: Date = new Date(), days = 7): boolean {
  if (typeof lastBackupAt !== 'string') return true;
  const at = new Date(lastBackupAt).getTime();
  return Number.isNaN(at) || now.getTime() - at > days * 86_400_000;
}

export async function isBackupDue(db: ForgeDB, days = 7, now: Date = new Date()): Promise<boolean> {
  const entry = await db.meta.get(LAST_BACKUP_KEY);
  return isBackupOverdue(entry?.value, now, days);
}
