import type { PulseComponentKey } from '../../db/types';

/**
 * Réglages du moteur PULSE. Les valeurs de départ sont des exemples de conception,
 * pas des seuils validés médicalement : chacun peut les ajuster dans Réglages PULSE.
 */
export interface PulseSettings {
  /** Poids de chaque composante du Readiness Score (0 = composante ignorée). */
  weights: Record<PulseComponentKey, number>;
  /** Seuils des modes du jour : Feu vert, Normal, Allégé ; en dessous, Récupération. */
  modes: { feuVert: number; normal: number; allege: number };
  /** Sommeil visé, en heures. */
  sleepTargetHours: number;
  /** En dessous de cette durée de sommeil, le mode du jour ne dépasse pas Allégé. */
  shortNightHours: number;
  /** Charge des 7 derniers jours rapportée à la moyenne des 4 dernières semaines. */
  loadLow: number;
  loadHigh: number;
  loadVeryHigh: number;
  /** Nutrition Status : écart toléré aux calories visées, en %. */
  kcalTolerancePct: number;
  /** En dessous de ce pourcentage de l'objectif calorique, un jour compte comme apport bas. */
  lowIntakePct: number;
  /** Protéines : en dessous de ce pourcentage de l'objectif, une piste est proposée. */
  proteinMinPct: number;
}

export const PULSE_SETTINGS_KEY = 'pulseSettings';
export const PULSE_ENGINE_VERSION = 1;

export const COMPONENT_ORDER: PulseComponentKey[] = ['sommeil', 'physiologie', 'ressenti', 'charge', 'mental'];
export const COMPONENT_LABELS: Record<PulseComponentKey, string> = {
  sommeil: 'Sommeil',
  physiologie: 'Physiologie',
  ressenti: 'Ressenti',
  charge: 'Charge',
  mental: 'Mental',
};

export const DEFAULT_PULSE_SETTINGS: PulseSettings = {
  weights: { sommeil: 30, physiologie: 25, ressenti: 25, charge: 10, mental: 10 },
  modes: { feuVert: 75, normal: 55, allege: 40 },
  sleepTargetHours: 7,
  shortNightHours: 5,
  loadLow: 0.8,
  loadHigh: 1.3,
  loadVeryHigh: 1.5,
  kcalTolerancePct: 10,
  lowIntakePct: 75,
  proteinMinPct: 90,
};

type Scalar = Exclude<keyof PulseSettings, 'weights' | 'modes'>;

/** Bornes et pas de chaque réglage (aussi utilisés par l'écran de réglages). */
export const SETTING_BOUNDS: Record<Scalar, { min: number; max: number; step: number }> = {
  sleepTargetHours: { min: 6, max: 9, step: 0.5 },
  shortNightHours: { min: 4, max: 6, step: 0.5 },
  loadLow: { min: 0.5, max: 1, step: 0.05 },
  loadHigh: { min: 1.1, max: 1.6, step: 0.05 },
  loadVeryHigh: { min: 1.3, max: 2, step: 0.05 },
  kcalTolerancePct: { min: 5, max: 20, step: 1 },
  lowIntakePct: { min: 60, max: 90, step: 5 },
  proteinMinPct: { min: 70, max: 100, step: 5 },
};
export const WEIGHT_BOUNDS = { min: 0, max: 50, step: 5 };
export const MODE_BOUNDS = { min: 20, max: 95, step: 5 };

const clamp = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);

/** Réglages enregistrés, complétés et ramenés dans leurs bornes ; les seuils restent dans l'ordre. */
export function resolveSettings(stored: unknown): PulseSettings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<PulseSettings>;
  const d = DEFAULT_PULSE_SETTINGS;
  const weights = Object.fromEntries(COMPONENT_ORDER.map((k) => [k, clamp(s.weights?.[k], WEIGHT_BOUNDS.min, WEIGHT_BOUNDS.max, d.weights[k])])) as PulseSettings['weights'];
  if (COMPONENT_ORDER.every((k) => weights[k] === 0)) Object.assign(weights, d.weights);
  const allege = clamp(s.modes?.allege, MODE_BOUNDS.min, MODE_BOUNDS.max - 10, d.modes.allege);
  const normal = Math.max(allege + 5, clamp(s.modes?.normal, MODE_BOUNDS.min, MODE_BOUNDS.max - 5, d.modes.normal));
  const feuVert = Math.max(normal + 5, clamp(s.modes?.feuVert, MODE_BOUNDS.min, MODE_BOUNDS.max, d.modes.feuVert));
  const scalar = (k: Scalar) => clamp(s[k], SETTING_BOUNDS[k].min, SETTING_BOUNDS[k].max, d[k]);
  const loadLow = scalar('loadLow');
  const loadHigh = Math.max(loadLow + 0.1, scalar('loadHigh'));
  return {
    weights,
    modes: { feuVert, normal, allege },
    sleepTargetHours: scalar('sleepTargetHours'),
    shortNightHours: Math.min(scalar('shortNightHours'), scalar('sleepTargetHours') - 1),
    loadLow,
    loadHigh,
    loadVeryHigh: Math.max(loadHigh + 0.1, scalar('loadVeryHigh')),
    kcalTolerancePct: scalar('kcalTolerancePct'),
    lowIntakePct: scalar('lowIntakePct'),
    proteinMinPct: scalar('proteinMinPct'),
  };
}
