/**
 * Effort d'une série : FORGE enregistre toujours le RIR (répétitions en réserve) ; l'affichage suit le réglage
 * de l'utilisateur, en RIR ou en RPE (RPE = 10 − RIR).
 */
export type EffortScale = 'rir' | 'rpe';

export const EFFORT_SCALE_KEY = 'effortScale';

/** RIR 5 veut dire « 5 ou plus » : en RPE, « 5 ou moins ». */
export function effortText(rir: number, scale: EffortScale): string {
  if (scale === 'rpe') return rir >= 5 ? 'RPE 5 ou moins' : `RPE ${10 - rir}`;
  return rir >= 5 ? 'RIR 5+' : `RIR ${rir}`;
}

/** Valeur courte, sans le sigle : « 8 », « 5+ ». */
export function effortValue(rir: number, scale: EffortScale): string {
  if (scale === 'rpe') return rir >= 5 ? '≤ 5' : String(10 - rir);
  return rir >= 5 ? '5+' : String(rir);
}

export const EFFORT_LABELS: Record<EffortScale, { short: string; long: string }> = {
  rir: { short: 'RIR', long: 'Répétitions en réserve (RIR)' },
  rpe: { short: 'RPE', long: 'Effort ressenti (RPE)' },
};

export const isEffortScale = (v: unknown): v is EffortScale => v === 'rir' || v === 'rpe';
