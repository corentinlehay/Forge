/**
 * Modèle de données commun de FORGE (version 2 : socle, poids, nutrition, entraînement, bien-être).
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
  /** Objectifs nutritionnels du jour, définis par l'utilisateur dans Nutrition. */
  nutritionTargets?: NutritionTargets;
}

export interface NutritionTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
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

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Une ligne du journal alimentaire (saisie manuelle en V1 ; Ciqual et Open Food Facts en Phase 3). */
export interface FoodEntry extends SyncFields {
  date: string;
  meal: MealSlot;
  name: string;
  /** Quantité libre, ex. « 150 g » ou « 1 bol ». */
  quantity?: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Exercise extends SyncFields {
  name: string;
}

export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  /** Fourchette de répétitions visée, texte libre : « 8-10 ». */
  reps: string;
}

/** Une séance du programme, prévue certains jours de la semaine (1 = lundi … 7 = dimanche). */
export interface WorkoutTemplate extends SyncFields {
  name: string;
  weekdays: number[];
  exercises: TemplateExercise[];
  position: number;
}

/** Une séance réalisée (ou en cours tant que endedAt est vide). */
export interface Workout extends SyncFields {
  date: string;
  name: string;
  templateId?: string | null;
  /** Ordre des exercices de la séance. */
  exerciseIds: string[];
  startedAt: string;
  endedAt?: string | null;
}

export interface WorkoutSet extends SyncFields {
  workoutId: string;
  exerciseId: string;
  position: number;
  weightKg: number;
  reps: number;
}

export type Scale5 = 1 | 2 | 3 | 4 | 5;

/** Check-in bien-être du jour : un par jour. */
export interface CheckIn extends SyncFields {
  date: string;
  sleepHours: number;
  energy: Scale5;
  fatigue: Scale5;
  soreness: Scale5;
  note?: string;
}
