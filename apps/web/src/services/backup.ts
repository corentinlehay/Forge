import { z } from 'zod';
import { SCHEMA_VERSION, type ForgeDB } from '../db/schema';
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

const nutritionTargetsSchema = z.object({
  kcal: z.number().min(0).max(10000),
  proteinG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(1500),
  fatG: z.number().min(0).max(1000),
  fiberG: z.number().min(0).max(300).optional(),
  waterMl: z.number().min(0).max(10000).optional(),
});

const per100Schema = z.object({
  kcal: z.number().min(0).max(900),
  proteinG: z.number().min(0).max(100),
  carbsG: z.number().min(0).max(100),
  fatG: z.number().min(0).max(100),
  fiberG: z.number().min(0).max(100).nullable(),
});

const foodEntrySchema = z.object({
  ...syncFields,
  date: dateKey,
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  name: z.string().min(1).max(120),
  quantity: z.string().max(40).optional(),
  kcal: z.number().min(0).max(5000),
  proteinG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(1000),
  fiberG: z.number().min(0).max(300).nullable().optional(),
  foodId: z.string().nullable().optional(),
  grams: z.number().min(0).max(5000).nullable().optional(),
  unit: z.enum(['g', 'ml']).optional(),
  per100: per100Schema.nullable().optional(),
});

const foodSchema = z.object({
  ...syncFields,
  source: z.enum(['ciqual', 'off', 'custom']),
  sourceId: z.string().nullable().optional(),
  name: z.string().min(1).max(160),
  brand: z.string().max(80).optional(),
  state: z.enum(['raw', 'cooked']).nullable().optional(),
  unit: z.enum(['g', 'ml']),
  per100: per100Schema,
  servingG: z.number().min(0).max(2000).nullable().optional(),
  servingLabel: z.string().max(80).optional(),
  favorite: z.boolean(),
  lastUsedAt: z.string().nullable().optional(),
  useCount: z.number().int().min(0),
});

const mealTemplateSchema = z.object({
  ...syncFields,
  name: z.string().min(1).max(60),
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).nullable().optional(),
  items: z.array(
    z.object({
      foodId: z.string().nullable().optional(),
      name: z.string().min(1).max(160),
      quantity: z.string().max(40).optional(),
      grams: z.number().min(0).max(5000).nullable().optional(),
      unit: z.enum(['g', 'ml']).optional(),
      per100: per100Schema.nullable().optional(),
      kcal: z.number().min(0).max(5000),
      proteinG: z.number().min(0).max(1000),
      carbsG: z.number().min(0).max(1000),
      fatG: z.number().min(0).max(1000),
      fiberG: z.number().min(0).max(300).nullable().optional(),
    }),
  ),
});

const waterSchema = z.object({ ...syncFields, date: dateKey, ml: z.number().int().min(1).max(3000) });

const exerciseSchema = z.object({ ...syncFields, name: z.string().min(1).max(80) });

const templateSchema = z.object({
  ...syncFields,
  name: z.string().min(1).max(60),
  weekdays: z.array(z.number().int().min(1).max(7)),
  exercises: z.array(z.object({ exerciseId: z.string().min(1), sets: z.number().int().min(1).max(20), reps: z.string().max(20) })),
  position: z.number(),
});

const workoutSchema = z.object({
  ...syncFields,
  date: dateKey,
  name: z.string().min(1).max(60),
  templateId: z.string().nullable().optional(),
  exerciseIds: z.array(z.string()),
  startedAt: z.string().min(1),
  endedAt: z.string().nullable().optional(),
});

const setSchema = z.object({
  ...syncFields,
  workoutId: z.string().min(1),
  exerciseId: z.string().min(1),
  position: z.number(),
  weightKg: z.number().min(0).max(500),
  reps: z.number().int().min(1).max(100),
});

const scale = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const checkInSchema = z.object({
  ...syncFields,
  date: dateKey,
  sleepHours: z.number().min(0).max(16),
  energy: scale,
  fatigue: scale,
  soreness: scale,
  note: z.string().max(500).optional(),
});

/** Les sauvegardes plus anciennes restent importables : les tables absentes valent []. */
export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  schemaVersion: z.number().int().min(1),
  tables: z.object({
    profile: z.array(profileSchema.extend({ nutritionTargets: nutritionTargetsSchema.optional() })),
    weighIns: z.array(weighInSchema),
    meta: z.array(metaSchema),
    foodEntries: z.array(foodEntrySchema).default([]),
    exercises: z.array(exerciseSchema).default([]),
    workoutTemplates: z.array(templateSchema).default([]),
    workouts: z.array(workoutSchema).default([]),
    workoutSets: z.array(setSchema).default([]),
    checkIns: z.array(checkInSchema).default([]),
    foods: z.array(foodSchema).default([]),
    mealTemplates: z.array(mealTemplateSchema).default([]),
    waterLogs: z.array(waterSchema).default([]),
  }),
});

export type Backup = z.infer<typeof backupSchema>;
export type ImportMode = 'replace' | 'merge';

export interface ImportReport {
  added: number;
  updated: number;
  unchanged: number;
}

/** Tables sauvegardées, avec leur clé. */
const TABLES = [
  ['profile', 'id'],
  ['weighIns', 'id'],
  ['meta', 'key'],
  ['foodEntries', 'id'],
  ['exercises', 'id'],
  ['workoutTemplates', 'id'],
  ['workouts', 'id'],
  ['workoutSets', 'id'],
  ['checkIns', 'id'],
  ['foods', 'id'],
  ['mealTemplates', 'id'],
  ['waterLogs', 'id'],
] as const;

type TableName = (typeof TABLES)[number][0];

export async function exportBackup(db: ForgeDB, now: Date = new Date()): Promise<Backup> {
  const rows = await Promise.all(TABLES.map(([name]) => db.table(name).toArray()));
  const tables = Object.fromEntries(TABLES.map(([name], i) => [name, rows[i]])) as Backup['tables'];
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowIso(now),
    schemaVersion: SCHEMA_VERSION,
    tables,
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
  const tables = TABLES.map(([name]) => db.table(name));

  await db.transaction('rw', tables, async () => {
    for (const [name, key] of TABLES) {
      const table = db.table(name);
      const records = backup.tables[name as TableName] as { updatedAt: string; [k: string]: unknown }[];
      if (mode === 'replace') {
        await table.clear();
        await table.bulkPut(records);
        report.added += records.length;
        continue;
      }
      for (const record of records) {
        const existing = (await table.get(record[key] as string)) as { updatedAt: string } | undefined;
        if (isNewer(record, existing)) {
          await table.put(record);
          if (existing) report.updated++;
          else report.added++;
        } else report.unchanged++;
      }
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
