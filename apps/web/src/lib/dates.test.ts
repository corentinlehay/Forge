import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isDateKey, isTimeKey, toLocalDateKey } from './dates';

describe('dates locales', () => {
  it('valide les clés de jour', () => {
    expect(isDateKey('2026-11-23')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('23/11/2026')).toBe(false);
  });

  it('valide les heures', () => {
    expect(isTimeKey('07:05')).toBe(true);
    expect(isTimeKey('24:00')).toBe(false);
  });

  it('traverse le changement d’heure sans décalage', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('compte les jours entre deux dates', () => {
    expect(daysBetween('2026-09-01', '2026-11-23')).toBe(83);
    expect(daysBetween('2026-11-23', '2026-11-20')).toBe(-3);
  });

  it('donne le jour local de l’appareil', () => {
    expect(toLocalDateKey(new Date(2026, 10, 23, 23, 59))).toBe('2026-11-23');
  });
});
