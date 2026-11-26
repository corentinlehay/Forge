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
const timeKey = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
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
  gainRate: z.object({ lowPctPerWeek: z.number().min(-2).max(2), highPctPerWeek: z.number().min(-2).max(2) }),
  goal: z.enum(['muscle', 'perte', 'recompo', 'force', 'forme']).optional(),
  specialization: z.enum(['POWER', 'BUILDER', 'ENGINE', 'DISCIPLINE', 'MOBILITY', 'RECOVERY']).nullable().optional(),
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
  recipeKey: z.string().max(100).nullable().optional(),
  recipeServings: z.number().min(0).max(50).nullable().optional(),
  costEur: z.number().min(0).max(1000).nullable().optional(),
});

const aisle = z.enum(['fruits-legumes', 'viandes-poissons', 'cremerie', 'feculents', 'conserves', 'epicerie', 'surgeles']);
const unitTuple = z
  .tuple([z.string().max(30), z.string().max(30), z.number().min(0.1).max(5000)])
  .nullable()
  .optional();
export const recipeIngredientSchema = z.object({
  key: z.string().min(1).max(160),
  name: z.string().min(1).max(160),
  grams: z.number().min(0.1).max(20000),
  per100: per100Schema.nullable(),
  aisle,
  unit: unitTuple,
  ml: z.boolean().optional(),
  tags: z
    .array(z.enum(['gluten', 'lait', 'oeuf', 'poisson', 'crustaces', 'arachide', 'fruits-a-coque', 'soja', 'moutarde', 'sesame', 'viande', 'porc']))
    .nullable()
    .optional(),
});
const glyph = z.enum([
  'bol',
  'pancake',
  'poele',
  'tartine',
  'boite',
  'wok',
  'cocotte',
  'assiette',
  'salade',
  'pizza',
  'burger',
  'wrap',
  'quiche',
  'pates',
  'gratin',
  'verre',
  'billes',
  'mug',
  'verrine',
  'gateau',
]);
export const recipeFields = {
  name: z.string().min(1).max(80),
  description: z.string().max(400),
  categories: z.array(z.enum(['petit-dejeuner', 'dejeuner', 'diner', 'collation', 'dessert', 'meal-prep', 'economique', 'plaisir'])).max(8),
  prepMin: z.number().int().min(0).max(1440),
  cookMin: z.number().int().min(0).max(1440),
  servings: z.number().int().min(1).max(50),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  glyph,
  ingredients: z.array(recipeIngredientSchema).min(1).max(60),
  steps: z.array(z.string().max(600)).max(30),
  storage: z.string().max(600),
};
const recipeSchema = z.object({ ...syncFields, ...recipeFields, origin: z.string().max(100).nullable().optional() });
const recipePhotoSchema = z.object({ ...syncFields, recipeKey: z.string().min(1).max(100), dataUrl: z.string().startsWith('data:image/').max(1_500_000) });
const mealPlanSchema = z.object({
  ...syncFields,
  date: dateKey,
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  recipeKey: z.string().min(1).max(100),
  servings: z.number().min(0.25).max(20),
  status: z.enum(['planned', 'eaten']),
  foodEntryId: z.string().nullable().optional(),
});
const shoppingListSchema = z.object({
  ...syncFields,
  name: z.string().min(1).max(80),
  items: z
    .array(
      z.object({
        key: z.string().max(160),
        name: z.string().max(160),
        grams: z.number().min(0).max(200000),
        ml: z.boolean(),
        aisle,
        unit: unitTuple,
        recipes: z.array(z.string().max(80)),
        checked: z.boolean(),
      }),
    )
    .max(300),
  selections: z.array(z.object({ recipeKey: z.string().max(100), servings: z.number().min(0.25).max(50) })),
});
const targetChangeSchema = z.object({
  ...syncFields,
  date: dateKey,
  before: nutritionTargetsSchema.nullable(),
  after: nutritionTargetsSchema,
  source: z.enum(['proposition', 'manuel', 'questionnaire']),
  reason: z.string().max(400).optional(),
});
const priceSchema = z.object({
  ...syncFields,
  key: z.string().min(1).max(160),
  name: z.string().min(1).max(160),
  amountEur: z.number().min(0.01).max(1000),
  quantity: z.number().min(0.1).max(100000),
  unit: z.enum(['g', 'ml', 'piece']),
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

const exerciseSchema = z.object({
  ...syncFields,
  name: z.string().min(1).max(80),
  libraryId: z.string().nullable().optional(),
  muscle: z.string().nullable().optional(),
  secondary: z.array(z.string()).optional(),
  equipment: z.string().nullable().optional(),
  kind: z.enum(['compound', 'isolation']).nullable().optional(),
  cues: z.array(z.string().max(300)).optional(),
  restSec: z.number().int().min(0).max(900).nullable().optional(),
});

const objectiveSchema = z.enum(['hypertrophie', 'force', 'endurance-musculaire', 'remise-en-forme', 'perte-de-gras', 'recomposition', 'athletique', 'maintien']);

const programSchema = z.object({
  ...syncFields,
  name: z.string().min(1).max(60),
  active: z.boolean(),
  note: z.string().max(500).optional(),
  // Base v12 : tous facultatifs, une sauvegarde plus ancienne reste importable.
  status: z.enum(['brouillon', 'actif', 'pause', 'termine', 'archive']).optional(),
  objective: objectiveSchema.nullable().optional(),
  secondaryObjective: objectiveSchema.nullable().optional(),
  source: z.enum(['manuel', 'genere']).nullable().optional(),
  durationWeeks: z.number().int().min(1).max(52).nullable().optional(),
  startDate: dateKey.nullable().optional(),
  endDate: dateKey.nullable().optional(),
  currentVersionId: z.string().nullable().optional(),
});

const templateExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1).max(20),
  reps: z.string().max(20),
  restSec: z.number().int().min(0).max(900).nullable().optional(),
  rir: z.number().int().min(0).max(10).nullable().optional(),
  notes: z.string().max(200).optional(),
  startWeightKg: z.number().min(0).max(500).nullable().optional(),
});

const templateSchema = z.object({
  ...syncFields,
  name: z.string().min(1).max(60),
  weekdays: z.array(z.number().int().min(1).max(7)),
  exercises: z.array(templateExerciseSchema),
  position: z.number(),
  programId: z.string().nullable().optional(),
  warmup: z.string().max(300).optional(),
});

const activitySchema = z.object({
  ...syncFields,
  date: dateKey,
  kind: z.enum(['cardio', 'mobilite']),
  minutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60),
  note: z.string().max(300).optional(),
});

const programVersionSchema = z.object({
  ...syncFields,
  programId: z.string().min(1),
  version: z.number().int().min(1),
  snapshot: z.object({
    name: z.string().min(1).max(60),
    objective: objectiveSchema.nullable().optional(),
    secondaryObjective: objectiveSchema.nullable().optional(),
    note: z.string().max(500).optional(),
    durationWeeks: z.number().int().min(1).max(52).nullable().optional(),
    sessions: z.array(
      z.object({
        templateId: z.string(),
        name: z.string().min(1).max(60),
        weekdays: z.array(z.number().int().min(1).max(7)),
        position: z.number(),
        warmup: z.string().max(300).optional(),
        exercises: z.array(templateExerciseSchema),
      }),
    ),
  }),
  changeSummary: z.string().max(1000),
});

const adjustmentSchema = z.object({ source: z.literal('pulse'), setsDelta: z.number().int().min(-5).max(0), rirDelta: z.number().int().min(0).max(5) });

const workoutSchema = z.object({
  ...syncFields,
  date: dateKey,
  name: z.string().min(1).max(60),
  templateId: z.string().nullable().optional(),
  exerciseIds: z.array(z.string()),
  startedAt: z.string().min(1),
  endedAt: z.string().nullable().optional(),
  note: z.string().max(2000).optional(),
  exerciseNotes: z.record(z.string(), z.string().max(1000)).optional(),
  adjustment: adjustmentSchema.nullable().optional(),
  programId: z.string().nullable().optional(),
  programVersionId: z.string().nullable().optional(),
});

const setSchema = z.object({
  ...syncFields,
  workoutId: z.string().min(1),
  exerciseId: z.string().min(1),
  position: z.number(),
  weightKg: z.number().min(0).max(500),
  reps: z.number().int().min(1).max(100),
  rir: z.number().int().min(0).max(10).nullable().optional(),
});

const scale = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const checkInSchema = z.object({
  ...syncFields,
  date: dateKey,
  sleepHours: z.number().min(0).max(16).nullable(),
  energy: scale.nullable(),
  fatigue: scale.nullable(),
  soreness: scale.nullable(),
  note: z.string().max(500).optional(),
  bedTime: timeKey.nullable().optional(),
  wakeTime: timeKey.nullable().optional(),
  awakenings: z.number().int().min(0).max(20).nullable().optional(),
  sleepQuality: scale.nullable().optional(),
  unusualPain: z.boolean().nullable().optional(),
});
const moodLogSchema = z.object({
  ...syncFields,
  date: dateKey,
  mood: scale.nullable().optional(),
  stress: scale.nullable().optional(),
  mentalEnergy: scale.nullable().optional(),
  motivation: scale.nullable().optional(),
  mentalLoad: scale.nullable().optional(),
  recovery: scale.nullable().optional(),
  emotions: z.array(z.string().max(40)).max(12).optional(),
  note: z.string().max(1000).optional(),
});
const cm = z.number().min(15).max(200);
const measurementSchema = z.object({
  ...syncFields,
  date: dateKey,
  waistCm: cm.nullable().optional(),
  chestCm: cm.nullable().optional(),
  armCm: cm.nullable().optional(),
  thighCm: cm.nullable().optional(),
  hipsCm: cm.nullable().optional(),
  note: z.string().max(300).optional(),
});
const painSchema = z.object({
  ...syncFields,
  zone: z.string().min(1).max(40),
  startedOn: dateKey,
  resolvedOn: dateKey.nullable(),
  activities: z.array(z.string().min(1).max(40)).max(10),
  note: z.string().max(1000).optional(),
  logs: z
    .array(z.object({ date: dateKey, intensity: z.number().int().min(0).max(10), flags: z.array(z.string().max(30)).max(10).optional(), note: z.string().max(500).optional() }))
    .max(400),
});
const longText = z.string().max(600).optional();
const weekNoteSchema = z.object({ ...syncFields, weekStart: dateKey, wentWell: longText, toAdjust: longText, intention: longText });
const pulseKey = z.enum(['sommeil', 'physiologie', 'ressenti', 'charge', 'mental']);
const pulseDaySchema = z.object({
  ...syncFields,
  date: dateKey,
  engineVersion: z.number().int().min(1),
  readiness: z.number().min(0).max(100).nullable(),
  confidence: z.enum(['haute', 'moyenne', 'basse']).nullable(),
  mode: z.enum(['feu-vert', 'normal', 'allege', 'recuperation']).nullable(),
  components: z.array(z.object({ key: pulseKey, score: z.number().min(0).max(100).nullable(), weight: z.number().min(0).max(100) })).max(10),
  nutritionKind: z.enum(['coherent', 'sous', 'au-dessus', 'incomplet', 'sans-objectif']),
  nutritionScore: z.number().min(0).max(100).nullable(),
  rules: z.array(z.string().max(40)).max(20),
  plannedTemplateId: z.string().nullable().optional(),
  level: z.enum(['basse', 'moderee', 'satisfaisante', 'elevee']).nullable().optional(),
  coverage: z.number().int().min(0).max(10).nullable().optional(),
  trainingKind: z.string().max(20).nullable().optional(),
  choice: z.enum(['alleger', 'remplacer', 'garder', 'deplacer']).nullable().optional(),
  choiceAt: z.string().nullable().optional(),
  plan: z
    .array(z.object({ id: z.string().max(40), module: z.string().max(20), title: z.string().max(200), to: z.string().max(120).nullable().optional() }))
    .max(40)
    .optional(),
  adjustment: adjustmentSchema.nullable().optional(),
  decisions: z
    .array(
      z.object({
        at: z.string().max(40),
        action: z.enum(['accepter', 'refuser', 'modifier', 'reporter', 'annuler']),
        choice: z.enum(['alleger', 'remplacer', 'garder', 'deplacer']).nullable(),
        adjustment: adjustmentSchema.nullable().optional(),
      }),
    )
    .max(100)
    .optional(),
  review: z
    .object({
      at: z.string().max(40),
      followed: z.enum(['oui', 'partiel', 'non']).nullable(),
      changes: z.array(z.string().max(30)).max(10),
      sessionFeel: scale.nullable(),
      dayFeel: scale.nullable(),
      useful: z.enum(['oui', 'un-peu', 'non']).nullable(),
      done: z.array(z.string().max(40)).max(40),
      note: z.string().max(500).optional(),
    })
    .nullable()
    .optional(),
});
const audioStateSchema = z.object({
  id: z.string().min(1).max(40),
  position: z
    .number()
    .min(0)
    .max(4 * 3600),
  durationSec: z
    .number()
    .min(0)
    .max(4 * 3600),
  favorite: z.boolean(),
  lastPlayedAt: z.string().nullable(),
  updatedAt: z.string(),
});
const mindSessionSchema = z.object({
  ...syncFields,
  date: dateKey,
  time: timeKey,
  kind: z.enum(['exercise', 'routine', 'audio']),
  ref: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
  durationSec: z
    .number()
    .min(0)
    .max(6 * 3600),
  completed: z.boolean(),
  tensionBefore: scale.nullable().optional(),
  tensionAfter: scale.nullable().optional(),
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
    programs: z.array(programSchema).default([]),
    recipes: z.array(recipeSchema).default([]),
    recipePhotos: z.array(recipePhotoSchema).default([]),
    mealPlans: z.array(mealPlanSchema).default([]),
    shoppingLists: z.array(shoppingListSchema).default([]),
    prices: z.array(priceSchema).default([]),
    targetChanges: z.array(targetChangeSchema).default([]),
    moodLogs: z.array(moodLogSchema).default([]),
    mindSessions: z.array(mindSessionSchema).default([]),
    audioStates: z.array(audioStateSchema).default([]),
    measurements: z.array(measurementSchema).default([]),
    pains: z.array(painSchema).default([]),
    weekNotes: z.array(weekNoteSchema).default([]),
    pulseDays: z.array(pulseDaySchema).default([]),
    programVersions: z.array(programVersionSchema).default([]),
    activities: z.array(activitySchema).default([]),
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
  ['programs', 'id'],
  ['recipes', 'id'],
  ['recipePhotos', 'id'],
  ['mealPlans', 'id'],
  ['shoppingLists', 'id'],
  ['prices', 'id'],
  ['targetChanges', 'id'],
  ['moodLogs', 'id'],
  ['mindSessions', 'id'],
  ['audioStates', 'id'],
  ['measurements', 'id'],
  ['pains', 'id'],
  ['weekNotes', 'id'],
  ['pulseDays', 'id'],
  ['programVersions', 'id'],
  ['activities', 'id'],
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
