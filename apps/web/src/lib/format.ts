/** Saisie et affichage des nombres à la française (virgule décimale). */

export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 300;

const oneDecimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDecimals = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Lit « 89,6 », « 89.6 » ou « 89 » ; renvoie null si la saisie n'est pas un nombre. */
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Poids saisi, arrondi au centième ; null s'il est illisible ou hors de [30 ; 300] kg. */
export function parseWeightKg(input: string): number | null {
  const value = parseDecimal(input);
  if (value === null || value < WEIGHT_MIN_KG || value > WEIGHT_MAX_KG) return null;
  return Math.round(value * 100) / 100;
}

/** 89.56 → « 89,6 kg » */
export function formatKg(value: number): string {
  return `${oneDecimal.format(value)} kg`;
}

/** 0.274 → « +0,27 kg » ; -0.1 → « −0,10 kg » */
export function formatSignedKg(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${twoDecimals.format(Math.abs(value))} kg`;
}
