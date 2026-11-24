/**
 * Accueil adaptatif : l'ordre des cartes suit le moment de la journée, sans rien changer aux données
 * ni au programme. PULSE reste toujours en tête, la barre d'onglets ne bouge pas, et l'accueil dit
 * pourquoi une carte passe devant.
 */
export type HomeCard = 'session' | 'nutrition' | 'physique' | 'tiles' | 'training' | 'week' | 'evening';

export interface HomeContext {
  /** Heure locale (0 à 23) et minutes depuis minuit. */
  minutes: number;
  plannedToday: boolean;
  inProgress: boolean;
  doneToday: boolean;
  /** Heure de la pesée du jour (HH:mm), s'il y en a une. */
  weighInTime: string | null;
}

export interface HomeFocus {
  order: HomeCard[];
  /** Phrase affichée sous PULSE quand l'ordre change ; null pour l'ordre habituel. */
  reason: string | null;
  /** Moment retenu (pour les tests et l'historique). */
  moment: 'seance-en-cours' | 'apres-seance' | 'soir' | 'apres-pesee' | 'avant-seance' | 'habituel';
}

export const DEFAULT_ORDER: HomeCard[] = ['session', 'nutrition', 'physique', 'tiles', 'training', 'week'];
/** À partir de cette heure, le soir met Mind et le sommeil en avant. */
export const EVENING_FROM = 19 * 60;
/** Une pesée met la Progression en avant pendant 2 heures. */
export const AFTER_WEIGH_IN_MIN = 120;

const toMinutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const front = (first: HomeCard[], rest: HomeCard[] = DEFAULT_ORDER): HomeCard[] => [...first, ...rest.filter((c) => !first.includes(c))];

export function homeFocus(ctx: HomeContext): HomeFocus {
  if (ctx.inProgress) return { order: DEFAULT_ORDER, reason: null, moment: 'seance-en-cours' };
  if (ctx.doneToday && ctx.minutes < EVENING_FROM)
    return { order: front(['tiles', 'week', 'session']), reason: 'Séance faite : récupération et bilan de la semaine d’abord.', moment: 'apres-seance' };
  if (ctx.minutes >= EVENING_FROM) return { order: front(['evening', 'tiles']), reason: 'Ce soir : Mind et sommeil d’abord.', moment: 'soir' };
  if (ctx.weighInTime !== null) {
    const since = ctx.minutes - toMinutes(ctx.weighInTime);
    if (since >= 0 && since <= AFTER_WEIGH_IN_MIN) return { order: front(['physique']), reason: 'Pesée du jour : ta tendance d’abord.', moment: 'apres-pesee' };
  }
  if (ctx.plannedToday) return { order: DEFAULT_ORDER, reason: null, moment: 'avant-seance' };
  return { order: DEFAULT_ORDER, reason: null, moment: 'habituel' };
}
