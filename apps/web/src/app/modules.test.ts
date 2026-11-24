import { describe, expect, it } from 'vitest';
import { moduleOf } from './modules';

describe('espace d’un écran', () => {
  it('suit l’adresse, PULSE et les réglages restant dans l’accueil', () => {
    expect(['/', '/pulse', '/pulse/historique', '/reglages', '/coach'].map(moduleOf)).toEqual(['accueil', 'accueil', 'accueil', 'accueil', 'accueil']);
    expect(moduleOf('/training/seance/abc')).toBe('training');
    expect(moduleOf('/nutrition/recettes/x')).toBe('nutrition');
    expect(moduleOf('/mind/audio/y')).toBe('mind');
    expect(moduleOf('/progression/bilans')).toBe('progression');
  });
});
