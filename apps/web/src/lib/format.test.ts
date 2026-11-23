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

describe('dates et nombres affichés', () => {
  it('écrit les jours à la française, avec « 1er »', async () => {
    const f = await import('./format');
    expect(f.formatDayLong('2026-11-23')).toBe('Lundi 23 novembre');
    expect(f.formatDayShort('2026-11-23')).toBe('Lundi 23 nov.');
    expect(f.formatDayMonth('2026-09-01')).toBe('1er sept.');
    expect(f.formatDayMonth('2026-10-13')).toBe('13 oct.');
    expect(f.formatFullDate('2026-12-01')).toBe('1er décembre 2026');
  });

  it('dit depuis quand', async () => {
    const f = await import('./format');
    expect(f.formatDaysAgo('2026-11-23', '2026-11-23')).toBe("aujourd'hui");
    expect(f.formatDaysAgo('2026-11-22', '2026-11-23')).toBe('hier');
    expect(f.formatDaysAgo('2026-11-14', '2026-11-23')).toBe('il y a 9 jours');
  });

  it('formate pourcentages et tailles', async () => {
    const f = await import('./format');
    expect(f.formatPct(0.25)).toBe('0,25 %');
    expect(f.formatBytes(420_000)).toBe('410 Ko');
    expect(f.formatBytes(1_500_000)).toBe('1,4 Mo');
  });
});

describe('poids saisis', () => {
  it('affiche la précision de la balance sans zéro inutile', async () => {
    const f = await import('./format');
    expect(f.formatMeasured(90.2)).toBe('90,2');
    expect(f.formatMeasured(90)).toBe('90,0');
    expect(f.formatMeasuredKg(89.45)).toBe('89,45 kg');
  });
});

describe('heures', () => {
  it('écrit les heures à la française', async () => {
    const f = await import('./format');
    expect(f.formatTime('07:42')).toBe('7 h 42');
    expect(f.formatTime('00:05')).toBe('0 h 05');
  });
});

describe('litres', () => {
  it('sans zéro inutile', async () => {
    const f = await import('./format');
    expect(f.formatLitres(1000)).toBe('1 L');
    expect(f.formatLitres(1250)).toBe('1,25 L');
    expect(f.formatLitres(0)).toBe('0 L');
  });
});
