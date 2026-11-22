/**
 * Modèle de données commun de FORGE (version 1 : socle et poids).
 * Chaque enregistrement porte les champs nécessaires à une synchronisation future.
 */

export interface SyncFields {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Suppression logique : la ligne reste, marquée supprimée. */
  deletedAt?: string | null;
}

export type Sex = 'male' | 'female';
export type Experience = 'beginner' | 'intermediate' | 'advanced';

/** Fourchette de prise de poids visée, en % du poids par semaine. */
export interface GainRate {
  lowPctPerWeek: number;
  highPctPerWeek: number;
}

/** Profil unique de l'utilisateur. Les champs absents sont demandés au moment où une fonction en a besoin. */
export interface Profile extends SyncFields {
  id: 'me';
  firstName?: string;
  birthDate?: string;
  sex?: Sex;
  heightCm?: number;
  experience?: Experience;
  /** Reprise après une pause : le coach raisonne en « détraîné », pas en débutant. */
  returningAfterBreak?: boolean;
  gainRate: GainRate;
}

export type WeighInContext = 'morning_fasted' | 'other';

export interface WeighIn extends SyncFields {
  /** Jour local, AAAA-MM-JJ */
  date: string;
  /** Heure locale, HH:mm */
  time: string;
  weightKg: number;
  context?: WeighInContext;
  note?: string;
}

/** Réglages et état système (version du schéma, dernière sauvegarde, onboarding). */
export interface MetaEntry {
  key: string;
  value: unknown;
  updatedAt: string;
}
