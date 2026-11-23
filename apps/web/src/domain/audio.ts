import { z } from 'zod';
import type { MindCategory } from '../data/mindExercises';

/** Séances audio du créateur de FORGE : même forme que le catalogue du serveur (apps/worker/src/audio.ts). */
export const AUDIO_FORMATS = ['hypnose', 'relaxation', 'meditation', 'visualisation', 'sommeil', 'respiration', 'preparation'] as const;
export const HYPNOSIS_THEMES = ['stress', 'ruminations', 'confiance', 'sommeil', 'lacher-prise', 'motivation', 'preparation', 'emotions', 'recuperation'] as const;
export const AUDIO_LEVELS = ['tous', 'debutant', 'habitue'] as const;
export type AudioFormat = (typeof AUDIO_FORMATS)[number];
export type HypnosisTheme = (typeof HYPNOSIS_THEMES)[number];
export type AudioLevel = (typeof AUDIO_LEVELS)[number];

export const FORMAT_LABELS: Record<AudioFormat, string> = {
  hypnose: 'Hypnose',
  relaxation: 'Relaxation',
  meditation: 'Méditation',
  visualisation: 'Visualisation',
  sommeil: 'Sommeil',
  respiration: 'Respiration',
  preparation: 'Préparation mentale',
};

export const THEME_LABELS: Record<HypnosisTheme, string> = {
  stress: 'Gestion du stress',
  ruminations: 'Apaiser les ruminations',
  confiance: 'Confiance en soi',
  sommeil: 'Sommeil',
  'lacher-prise': 'Lâcher-prise',
  motivation: 'Motivation',
  preparation: 'Préparation mentale',
  emotions: 'Gestion des émotions',
  recuperation: 'Récupération mentale',
};

export const LEVEL_LABELS: Record<AudioLevel, string> = {
  tous: 'Tous publics',
  debutant: 'Pour débuter',
  habitue: 'Pour une pratique régulière',
};

const fileSchema = z.object({ size: z.number(), mime: z.string(), version: z.string(), chunks: z.number() });
export const audioItemSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{16}$/),
  title: z.string(),
  description: z.string(),
  format: z.enum(AUDIO_FORMATS),
  themes: z.array(z.string()),
  categories: z.array(z.string()),
  goal: z.string(),
  level: z.enum(AUDIO_LEVELS),
  audience: z.string(),
  tags: z.array(z.string()),
  author: z.string(),
  durationSec: z.number(),
  published: z.boolean(),
  order: z.number(),
  file: fileSchema.nullable(),
  cover: z.object({ mime: z.string(), version: z.string() }).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AudioItem = z.infer<typeof audioItemSchema>;

/** Garde les séances lisibles du catalogue reçu ; ignore une entrée mal formée au lieu de tout rejeter. */
export function parseCatalog(raw: unknown): AudioItem[] {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((it) => {
    const r = audioItemSchema.safeParse(it);
    return r.success ? [r.data] : [];
  });
}

export const fileUrl = (item: AudioItem) => (item.file ? `/api/audio/${item.id}/file?v=${item.file.version}` : null);
export const coverUrl = (item: AudioItem) => (item.cover ? `/api/audio/${item.id}/cover?v=${item.cover.version}` : null);

/** Thèmes d'une séance, dans l'ordre de la liste et sans valeur inconnue. */
export const themesOf = (item: AudioItem): HypnosisTheme[] => HYPNOSIS_THEMES.filter((t) => item.themes.includes(t));

export function audioInCategory(items: readonly AudioItem[], category: MindCategory): AudioItem[] {
  return items.filter((i) => i.categories.includes(category));
}

export function audioWithTheme(items: readonly AudioItem[], theme: HypnosisTheme): AudioItem[] {
  return items.filter((i) => i.format === 'hypnose' && i.themes.includes(theme));
}

/** Position de reprise : depuis le début si l'écoute venait de commencer ou était presque finie. */
export function resumePosition(saved: number, duration: number): number {
  if (!Number.isFinite(saved) || saved < 15) return 0;
  if (duration > 0 && saved > duration - 20) return 0;
  return saved;
}

/** Une écoute compte comme terminée au-delà de 95 % de la séance. */
export const isFinished = (position: number, duration: number) => duration > 0 && position >= duration * 0.95;

/** Écoute gardée dans l'historique à partir d'une minute. */
export const MIN_LISTEN_SEC = 60;

export const SLEEP_TIMER_MINUTES = [5, 10, 15, 20, 30, 45, 60] as const;

/** Durée d'horloge : « 4:05 », « 1:02:03 ». */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Durée lisible : « 18 min », « 1 h 05 ». */
export function durationText(seconds: number): string {
  const min = Math.round(seconds / 60);
  if (min < 60) return `${Math.max(1, min)} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

export const sizeText = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`);

/** Précautions affichées avant une séance d'hypnose ; repères généraux, pas un avis médical. */
export const HYPNOSIS_PRECAUTIONS: string[] = [
  'Écoute assis ou allongé, dans un endroit calme. Jamais en conduisant ni en utilisant une machine.',
  'Ces séances accompagnent ton bien-être : elles ne remplacent pas un suivi médical ou psychologique et ne garantissent pas de résultat.',
  'Si tu vis un trouble psychotique ou délirant, ou si tu as un doute sur ta santé mentale, demande d’abord l’avis de ton médecin.',
  'Tu restes libre à tout moment : il suffit d’ouvrir les yeux pour arrêter.',
];
export const HYPNOSIS_SOURCES = 'Inserm, Évaluation de l’efficacité de la pratique de l’hypnose (2015) ; La Revue du Praticien, Hypnose médicale : quel intérêt ?';
