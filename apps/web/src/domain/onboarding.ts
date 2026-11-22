/**
 * Première ouverture, en étapes courtes. Seul le strict nécessaire est demandé maintenant :
 * le reste (taille, âge, niveau, séances) l'est quand une fonction en a besoin.
 */

export const ONBOARDING_KEY = 'onboarding';

export type OnboardingStep = 'install' | 'welcome' | 'firstWeighIn' | 'done';

export interface OnboardingState {
  /** Choix explicite de continuer dans le navigateur sans installer l'app. */
  installSkipped?: boolean;
  welcomeDone?: boolean;
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
  if (!context.hasWeighIns && !s.firstWeighInSkipped) return 'firstWeighIn';
  return 'done';
}

export function isOnboardingState(value: unknown): value is OnboardingState {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
