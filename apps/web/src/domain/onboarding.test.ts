import { describe, expect, it } from 'vitest';
import { nextOnboardingStep } from './onboarding';

const browser = { standalone: false, hasWeighIns: false };
const installed = { standalone: true, hasWeighIns: false };

describe('onboarding progressif', () => {
  it("guide l'installation avant tout dans le navigateur", () => {
    expect(nextOnboardingStep(null, browser)).toBe('install');
  });

  it("passe l'installation dans l'app installée", () => {
    expect(nextOnboardingStep(null, installed)).toBe('welcome');
  });

  it("continue dans le navigateur quand on l'a choisi", () => {
    expect(nextOnboardingStep({ installSkipped: true }, browser)).toBe('welcome');
  });

  it('propose la première pesée, sauf si des pesées existent déjà ou si elle est reportée', () => {
    expect(nextOnboardingStep({ welcomeDone: true }, installed)).toBe('plan');
    expect(nextOnboardingStep({ welcomeDone: true, planSkipped: true }, installed)).toBe('firstWeighIn');
    expect(nextOnboardingStep({ welcomeDone: true, planDone: true }, { ...installed, hasWeighIns: true })).toBe('done');
    expect(nextOnboardingStep({ welcomeDone: true, planSkipped: true }, { ...installed, hasWeighIns: true })).toBe('done');
    expect(nextOnboardingStep({ welcomeDone: true, planSkipped: true, firstWeighInSkipped: true }, installed)).toBe('done');
  });

  it('ne revient jamais une fois terminé', () => {
    expect(nextOnboardingStep({ completedAt: '2026-11-23T07:00:00.000Z' }, browser)).toBe('done');
  });
});
