/**
 * Saisie au pavé numérique (pesée, puis charges en Phase 2).
 * La valeur reste une chaîne à la française pendant la frappe : « 90,2 ».
 */

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'back';

export interface KeypadLimits {
  maxIntDigits: number;
  maxDecimals: number;
}

export const WEIGHT_KEYPAD: KeypadLimits = { maxIntDigits: 3, maxDecimals: 2 };

export function applyKey(value: string, key: KeypadKey, limits: KeypadLimits = WEIGHT_KEYPAD): string {
  if (key === 'back') return value.slice(0, -1);
  const commaAt = value.indexOf(',');
  if (key === ',') {
    if (commaAt !== -1 || limits.maxDecimals === 0) return value;
    return value === '' ? '0,' : `${value},`;
  }
  if (commaAt !== -1) {
    return value.length - commaAt - 1 >= limits.maxDecimals ? value : value + key;
  }
  if (value === '0') return key;
  return value.length >= limits.maxIntDigits ? value : value + key;
}

/** Valeur initiale du pavé pour corriger une pesée existante : 90.2 → « 90,2 ». */
export function toKeypadValue(value: number, limits: KeypadLimits = WEIGHT_KEYPAD): string {
  const fixed = value.toFixed(limits.maxDecimals).replace(/\.?0+$/, '');
  return fixed.replace('.', ',');
}
