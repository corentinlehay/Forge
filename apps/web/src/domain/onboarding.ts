/**
 * Première ouverture, en étapes courtes : installation, accueil, questionnaire de départ (facultatif),
 * première pesée si le questionnaire n'en a pas créé.
 */

export const ONBOARDING_KEY = 'onboarding';

export type OnboardingStep = 'install' | 'welcome' | 'plan' | 'firstWeighIn' | 'done';

export interface OnboardingState {
  /** Choix explicite de continuer dans le navigateur sans installer l'app. */
  installSkipped?: boolean;
  welcomeDone?: boolean;
  /** Questionnaire de départ terminé, ou remis à plus tard. */
  planDone?: boolean;
  planSkipped?: boolean;
  firstWeighInSkipped?: boolean;
  completedAt?: string;
}

export interface OnboardingContext {
  standalone: boolean;
  hasWeighIns: boolean;
}

export function nextOnboardingStep(state: OnboardingState | null, context: OnboardingContext): OnboardingStep {
  const s = state ?? {};
  if (s.completedAt) return 'done';
  if (!context.standalone && !s.installSkipped) return 'install';
  if (!s.welcomeDone) return 'welcome';
  if (!s.planDone && !s.planSkipped) return 'plan';
  if (!context.hasWeighIns && !s.firstWeighInSkipped) return 'firstWeighIn';
  return 'done';
}

export function isOnboardingState(value: unknown): value is OnboardingState {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
