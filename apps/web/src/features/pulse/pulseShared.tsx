import type { NutritionKind, PulseConfidence, PulseLevel, PulseMode } from '../../db/types';
import type { AnalysisKind } from '../../domain/pulse/analysis';
import type { IconName } from '../../ui/Icon';

/** Proposition de séance, séparée du niveau de lecture du score. */
export const MODE_LABELS: Record<PulseMode, string> = {
  'feu-vert': 'Progression possible',
  normal: 'Séance prévue',
  allege: 'Version allégée proposée',
  recuperation: 'Récupération active proposée',
};

export const LEVEL_LINES: Record<PulseLevel, string> = {
  elevee: 'Tes signaux du jour sont bons.',
  satisfaisante: 'Tes signaux du jour sont corrects.',
  moderee: 'Quelques signaux invitent à la prudence.',
  basse: 'Plusieurs signaux invitent à récupérer.',
};

export const CONFIDENCE_LABELS: Record<PulseConfidence, string> = { haute: 'Confiance haute', moyenne: 'Confiance moyenne', basse: 'Confiance basse' };

/** Le statut porte toujours une icône et un mot : jamais la couleur seule. */
export function levelChip(level: PulseLevel): { icon: IconName; tone: 'good' | 'neutral' | 'alert' } {
  return level === 'elevee' || level === 'satisfaisante' ? { icon: 'check', tone: level === 'elevee' ? 'good' : 'neutral' } : { icon: 'info', tone: 'neutral' };
}

export function modeChip(mode: PulseMode): { icon: IconName; tone: 'good' | 'neutral' | 'alert' } {
  return mode === 'feu-vert' ? { icon: 'check', tone: 'good' } : mode === 'normal' ? { icon: 'check', tone: 'neutral' } : { icon: 'info', tone: 'neutral' };
}

export function nutritionChip(kind: NutritionKind): { icon: IconName; tone: 'good' | 'neutral' | 'alert' } {
  return kind === 'coherent' ? { icon: 'check', tone: 'good' } : { icon: 'info', tone: 'neutral' };
}

/** Libellés courts pour la carte de l'accueil. */
export const NUTRITION_SHORT: Record<NutritionKind, string> = {
  coherent: 'Nutrition cohérente',
  sous: 'Nutrition sous l’objectif',
  'au-dessus': 'Nutrition au-dessus',
  incomplet: 'Repas à noter',
  'sans-objectif': 'Pas d’objectif nutrition',
};

export const ANALYSIS_ORDER: AnalysisKind[] = ['observe', 'declare', 'estime', 'hypothese', 'manquant'];

/** « +6 », « −4 », « = » : écart en points. */
export const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '=');

export const PULSE_DISCLAIMER =
  'PULSE donne des repères à partir de tes données. Les notes, les niveaux et les seuils sont des choix de conception, réglables, pas des seuils validés médicalement. Ce n’est jamais un avis médical.';

/** Libellés des règles, pour relire le journal. */
export const RULE_LABELS: Record<string, string> = {
  mineur: 'Moins de 18 ans',
  poitrine: 'Douleur dans la poitrine',
  'douleur-alerte': 'Douleur avec signe d’alerte',
  'douleur-suivi': 'Douleur suivie',
  'douleur-signalee': 'Douleur inhabituelle signalée',
  'nuit-courte': 'Nuit courte',
  'fatigue-installee': 'Fatigue qui s’installe',
  detresse: 'Moral au plus bas',
  'apport-bas': 'Apport très bas',
  'poids-bas': 'Poids déjà bas',
};

export const CHOICE_SHORT: Record<string, string> = {
  alleger: 'version allégée choisie',
  remplacer: 'récupération active choisie',
  garder: 'séance prévue gardée',
  deplacer: 'séance déplacée au lendemain',
};
