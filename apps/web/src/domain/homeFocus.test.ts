import { describe, expect, it } from 'vitest';
import { DEFAULT_ORDER, homeFocus } from './homeFocus';

const at = (h: number, m = 0) => h * 60 + m;
const base = { plannedToday: false, inProgress: false, doneToday: false, weighInTime: null };

describe('accueil adaptatif', () => {
  it('garde l’ordre habituel, séance en tête, avant l’entraînement et pendant', () => {
    expect(homeFocus({ ...base, minutes: at(9), plannedToday: true })).toMatchObject({ order: DEFAULT_ORDER, reason: null, moment: 'avant-seance' });
    expect(homeFocus({ ...base, minutes: at(20), plannedToday: true, inProgress: true }).moment).toBe('seance-en-cours');
  });

  it('après la séance, récupération et bilan passent devant', () => {
    const f = homeFocus({ ...base, minutes: at(13), plannedToday: true, doneToday: true });
    expect(f.order.slice(0, 3)).toEqual(['tiles', 'week', 'session']);
    expect(f.order).toHaveLength(DEFAULT_ORDER.length);
  });

  it('le soir, Mind et sommeil d’abord, y compris après une séance', () => {
    for (const ctx of [
      { ...base, minutes: at(19) },
      { ...base, minutes: at(21), doneToday: true },
    ]) {
      const f = homeFocus(ctx);
      expect(f.moment).toBe('soir');
      expect(f.order[0]).toBe('evening');
    }
  });

  it('après une pesée, la Progression passe devant pendant 2 heures seulement', () => {
    expect(homeFocus({ ...base, minutes: at(8, 30), weighInTime: '07:10' }).order[0]).toBe('physique');
    expect(homeFocus({ ...base, minutes: at(10), weighInTime: '07:10' }).moment).toBe('habituel');
    expect(homeFocus({ ...base, minutes: at(6), weighInTime: '07:10' }).moment).toBe('habituel');
  });

  it('ne perd ni n’invente aucune carte', () => {
    for (const minutes of [at(8), at(13), at(20)])
      for (const doneToday of [false, true]) {
        const order = homeFocus({ ...base, minutes, doneToday, weighInTime: '07:30' }).order;
        expect(new Set(order).size).toBe(order.length);
        expect(order.filter((c) => c !== 'evening').sort()).toEqual([...DEFAULT_ORDER].sort());
      }
  });
});
