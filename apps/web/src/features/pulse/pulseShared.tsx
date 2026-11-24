import type { PulseConfidence, PulseMode } from '../../db/types';
import type { NutritionKind } from '../../db/types';
import type { IconName } from '../../ui/Icon';

export const MODE_LABELS: Record<PulseMode, string> = {
  'feu-vert': 'Feu vert',
  normal: 'Normal',
  allege: 'Allégé',
  recuperation: 'Récupération',
};

export const MODE_LINES: Record<PulseMode, string> = {
  'feu-vert': 'Tout est prêt : tu peux suivre ton plan et viser la progression.',
  normal: 'Journée normale : suis ton plan, sans chercher de record.',
  allege: 'Journée à alléger : moins de volume, plus de marge.',
  recuperation: 'Journée de récupération : bouge doucement, recharge les batteries.',
};

export const CONFIDENCE_LABELS: Record<PulseConfidence, string> = { haute: 'Confiance haute', moyenne: 'Confiance moyenne', basse: 'Confiance basse' };

/** Le statut porte toujours une icône et un mot : jamais la couleur seule. */
export function modeChip(mode: PulseMode): { icon: IconName; tone: 'good' | 'neutral' | 'alert' } {
  return mode === 'feu-vert' ? { icon: 'check', tone: 'good' } : mode === 'normal' ? { icon: 'check', tone: 'neutral' } : { icon: 'info', tone: 'neutral' };
}

export function nutritionChip(kind: NutritionKind): { icon: IconName; tone: 'good' | 'neutral' | 'alert' } {
  return kind === 'coherent' ? { icon: 'check', tone: 'good' } : kind === 'sous' || kind === 'au-dessus' ? { icon: 'info', tone: 'neutral' } : { icon: 'info', tone: 'neutral' };
}

/** Libellés courts pour la carte de l'accueil. */
export const NUTRITION_SHORT: Record<NutritionKind, string> = {
  coherent: 'Nutrition cohérente',
  sous: 'Nutrition sous l’objectif',
  'au-dessus': 'Nutrition au-dessus',
  incomplet: 'Repas à noter',
  'sans-objectif': 'Pas d’objectif nutrition',
};

export const PULSE_DISCLAIMER =
  'PULSE donne des repères à partir de tes données. Les notes et les seuils sont des choix de conception, réglables, pas des seuils validés médicalement. Ce n’est jamais un avis médical.';
