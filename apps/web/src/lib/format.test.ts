import { describe, expect, it } from 'vitest';
import { formatKg, formatSignedKg, parseDecimal, parseWeightKg } from './format';

describe('saisie des nombres', () => {
  it('accepte la virgule comme le point', () => {
    expect(parseDecimal('89,6')).toBe(89.6);
    expect(parseDecimal(' 89.6 ')).toBe(89.6);
    expect(parseDecimal('90')).toBe(90);
  });

  it('refuse une saisie illisible', () => {
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('89,')).toBeNull();
    expect(parseDecimal('')).toBeNull();
  });

  it('borne le poids entre 30 et 300 kg et arrondit au centième', () => {
    expect(parseWeightKg('25')).toBeNull();
    expect(parseWeightKg('301')).toBeNull();
    expect(parseWeightKg('89,644')).toBe(89.64);
  });
});

describe('affichage', () => {
  it('formate le poids à la française', () => {
    expect(formatKg(89.56)).toBe('89,6 kg');
  });

  it('signe le rythme de prise', () => {
    expect(formatSignedKg(0.274)).toBe('+0,27 kg');
    expect(formatSignedKg(-0.1)).toBe('−0,10 kg');
    expect(formatSignedKg(0)).toBe('0,00 kg');
  });
});
