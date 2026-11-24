import type { Measurement, Pain } from '../db/types';
import { addDays, daysBetween } from '../lib/dates';

/** Progression du corps (poids moyen, mensurations, comparaisons) et suivi des douleurs, sans diagnostic. */

// Poids

/** Moyenne des pesées des 7 derniers jours (aujourd'hui compris), ou null sans pesée. */
export function weightAverage(weighIns: readonly { date: string; weightKg: number }[], endDate: string, days = 7): { kg: number; count: number } | null {
  const start = addDays(endDate, -(days - 1));
  const list = weighIns.filter((w) => w.date >= start && w.date <= endDate);
  if (!list.length) return null;
  return { kg: Math.round((list.reduce((a, w) => a + w.weightKg, 0) / list.length) * 10) / 10, count: list.length };
}

// Mensurations

export const MEASURE_KEYS = ['waistCm', 'chestCm', 'armCm', 'thighCm', 'hipsCm'] as const;
export type MeasureKey = (typeof MEASURE_KEYS)[number];

export const MEASURE_INFO: Record<MeasureKey, { label: string; short: string; how: string }> = {
  waistCm: { label: 'Tour de taille', short: 'Taille', how: 'Au niveau du nombril, ventre relâché, en fin d’expiration.' },
  chestCm: { label: 'Tour de poitrine', short: 'Poitrine', how: 'Sous les aisselles, à hauteur des mamelons, bras le long du corps.' },
  armCm: { label: 'Tour de bras', short: 'Bras', how: 'Au plus large du biceps, bras relâché le long du corps, toujours le même côté.' },
  thighCm: { label: 'Tour de cuisse', short: 'Cuisse', how: 'Au plus large de la cuisse, debout, toujours le même côté.' },
  hipsCm: { label: 'Tour de hanches', short: 'Hanches', how: 'Au plus large des fesses, pieds joints.' },
};

/** Valeurs d'une mesure dans le temps (dates sans cette mesure ignorées). */
export function measureSeries(list: readonly Measurement[], key: MeasureKey): { date: string; value: number }[] {
  return list.filter((m) => typeof m[key] === 'number').map((m) => ({ date: m.date, value: m[key] as number }));
}

export interface MeasureSummary {
  key: MeasureKey;
  latest: { date: string; value: number } | null;
  /** Écart avec la mesure précédente et avec la première. */
  sincePrevious: number | null;
  sinceFirst: number | null;
  firstDate: string | null;
}

export function measureSummaries(list: readonly Measurement[]): MeasureSummary[] {
  return MEASURE_KEYS.map((key) => {
    const s = measureSeries(list, key);
    const latest = s.at(-1) ?? null;
    const prev = s.at(-2) ?? null;
    const first = s[0] ?? null;
    const round = (v: number) => Math.round(v * 10) / 10;
    return {
      key,
      latest,
      sincePrevious: latest && prev ? round(latest.value - prev.value) : null,
      sinceFirst: latest && first && s.length > 1 ? round(latest.value - first.value) : null,
      firstDate: first && s.length > 1 ? first.date : null,
    };
  });
}

/** Mesure connue à une date : la plus récente au plus tard ce jour-là, sur 45 jours au plus. */
export function measureAt(list: readonly Measurement[], key: MeasureKey, date: string): { date: string; value: number } | null {
  const s = measureSeries(list, key).filter((p) => p.date <= date && daysBetween(p.date, date) <= 45);
  return s.at(-1) ?? null;
}

/** Comparaison de deux dates : poids moyen sur 7 jours et mensurations connues à chaque date. */
export function compareDates(
  weighIns: readonly { date: string; weightKg: number }[],
  measurements: readonly Measurement[],
  a: string,
  b: string,
): { weight: [number | null, number | null]; measures: { key: MeasureKey; a: number | null; b: number | null; delta: number | null }[] } {
  const wa = weightAverage(weighIns, a)?.kg ?? null;
  const wb = weightAverage(weighIns, b)?.kg ?? null;
  return {
    weight: [wa, wb],
    measures: MEASURE_KEYS.map((key) => {
      const va = measureAt(measurements, key, a)?.value ?? null;
      const vb = measureAt(measurements, key, b)?.value ?? null;
      return { key, a: va, b: vb, delta: va !== null && vb !== null ? Math.round((vb - va) * 10) / 10 : null };
    }),
  };
}

// Douleurs

export type PainView = 'face' | 'dos';

export interface PainZone {
  key: string;
  label: string;
  /** Position du point sur chaque vue (repère 160 × 340 de la silhouette), si la zone y est visible. */
  face?: [number, number];
  dos?: [number, number];
}

/** Zones paires : x donné pour le côté droit vu de face (à gauche de l'image) ; vu de dos, il passe à droite de l'image. */
function pair(key: string, right: string, left: string, face: [number, number] | null, dos: [number, number] | null): PainZone[] {
  const mirror = ([x, y]: [number, number]): [number, number] => [160 - x, y];
  return [
    { key: `${key}-d`, label: right, ...(face ? { face } : {}), ...(dos ? { dos: mirror(dos) } : {}) },
    { key: `${key}-g`, label: left, ...(face ? { face: mirror(face) } : {}), ...(dos ? { dos } : {}) },
  ];
}

export const PAIN_ZONES: PainZone[] = [
  { key: 'tete', label: 'Tête', face: [80, 22] },
  { key: 'cou', label: 'Cou et nuque', face: [80, 44], dos: [80, 44] },
  ...pair('epaule', 'Épaule droite', 'Épaule gauche', [50, 62], [50, 62]),
  { key: 'poitrine', label: 'Poitrine', face: [80, 74] },
  { key: 'haut-dos', label: 'Haut du dos', dos: [80, 76] },
  ...pair('coude', 'Coude droit', 'Coude gauche', [44, 114], [44, 114]),
  { key: 'ventre', label: 'Ventre', face: [80, 116] },
  { key: 'bas-dos', label: 'Bas du dos', dos: [80, 134] },
  ...pair('poignet', 'Poignet et main droits', 'Poignet et main gauches', [40, 162], [40, 162]),
  ...pair('hanche', 'Hanche droite', 'Hanche gauche', [63, 158], null),
  ...pair('fessier', 'Fessier droit', 'Fessier gauche', null, [68, 166]),
  ...pair('cuisse', 'Avant de la cuisse droite', 'Avant de la cuisse gauche', [67, 200], null),
  ...pair('ischio', 'Arrière de la cuisse droite', 'Arrière de la cuisse gauche', null, [67, 206]),
  ...pair('genou', 'Genou droit', 'Genou gauche', [68, 244], [68, 244]),
  ...pair('tibia', 'Tibia droit', 'Tibia gauche', [66, 282], null),
  ...pair('mollet', 'Mollet droit', 'Mollet gauche', null, [66, 282]),
  ...pair('cheville', 'Cheville et pied droits', 'Cheville et pied gauches', [66, 322], [66, 322]),
];
export const PAIN_ZONE_BY_KEY = new Map(PAIN_ZONES.map((z) => [z.key, z]));
export const zoneLabel = (key: string) => PAIN_ZONE_BY_KEY.get(key)?.label ?? key;

/** Signes à surveiller : ils ne disent pas ce qu'est la douleur, seulement qu'un avis médical s'impose. */
export const PAIN_FLAGS: { key: string; label: string; urgent: boolean }[] = [
  { key: 'gonflement', label: 'Gonflement, rougeur ou chaleur', urgent: true },
  { key: 'fievre', label: 'Fièvre ou frissons', urgent: true },
  { key: 'nerfs', label: 'Engourdissement, fourmillements ou perte de force', urgent: true },
  { key: 'appui', label: 'Impossible de bouger ou de prendre appui', urgent: true },
  { key: 'choc', label: 'Après une chute, un choc ou un craquement', urgent: true },
  { key: 'nuit', label: 'Douleur la nuit ou au repos', urgent: false },
];
export const PAIN_SOURCES = 'MSD Manuals (version grand public), Santé.fr, Haute Autorité de santé';

export const PAIN_ACTIVITIES = ['Musculation', 'Course', 'Vélo', 'Sport collectif', 'Travail assis', 'Port de charges', 'Sommeil', 'Écran'] as const;

export type PainAlert = 'poitrine' | 'signes' | 'intense' | 'nuit' | 'persistante';

export interface PainStatus {
  current: number | null;
  first: number | null;
  trend: 'mieux' | 'stable' | 'pire' | null;
  days: number;
  alerts: PainAlert[];
}

/** État d'une douleur : intensité actuelle, tendance (début contre dernière entrée), durée et alertes. */
export function painStatus(pain: Pain, today: string): PainStatus {
  const logs = [...pain.logs].sort((a, b) => a.date.localeCompare(b.date));
  const last = logs.at(-1) ?? null;
  const first = logs[0] ?? null;
  const end = pain.resolvedOn ?? today;
  const days = daysBetween(pain.startedOn, end) + 1;
  const trend = last && first && logs.length > 1 ? (last.intensity <= first.intensity - 2 ? 'mieux' : last.intensity >= first.intensity + 2 ? 'pire' : 'stable') : null;
  const alerts: PainAlert[] = [];
  if (!pain.resolvedOn) {
    if (pain.zone === 'poitrine') alerts.push('poitrine');
    const recentFlags = new Set(logs.filter((l) => daysBetween(l.date, today) <= 7).flatMap((l) => l.flags ?? []));
    if (PAIN_FLAGS.some((f) => f.urgent && recentFlags.has(f.key))) alerts.push('signes');
    if (last && last.intensity >= 7) alerts.push('intense');
    if (recentFlags.has('nuit')) alerts.push('nuit');
    if (days > 14 && trend !== 'mieux') alerts.push('persistante');
  }
  return { current: last?.intensity ?? null, first: first?.intensity ?? null, trend, days, alerts };
}

/** Message à afficher pour chaque alerte (repères généraux, jamais un diagnostic). */
export const ALERT_TEXT: Record<PainAlert, string> = {
  poitrine:
    'Une douleur dans la poitrine brutale, qui serre, dure ou irradie vers le bras, la mâchoire ou le dos, avec essoufflement ou sueurs : appelle le 15 (ou le 112) sans attendre.',
  signes: 'Tu as noté un signe qui demande un avis médical rapide : consulte un médecin dans la journée.',
  intense: 'Douleur forte (7 sur 10 ou plus) : fais-la évaluer par un médecin, et mets en pause les mouvements qui la réveillent.',
  nuit: 'Une douleur qui se manifeste la nuit ou au repos mérite d’être montrée à un médecin.',
  persistante: 'Plus de deux semaines sans amélioration nette : prends l’avis d’un médecin ou d’un kinésithérapeute.',
};

/** Journal trié par date. */
export function painLogsSorted(pain: Pain) {
  return [...pain.logs].sort((a, b) => a.date.localeCompare(b.date));
}

/** Ajoute ou remplace l'entrée du jour dans le journal. */
export function upsertLog(logs: Pain['logs'], entry: Pain['logs'][number]): Pain['logs'] {
  return [...logs.filter((l) => l.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date));
}
