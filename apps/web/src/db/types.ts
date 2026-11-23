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
  /** Facultatif : fibres visées par jour. */
  fiberG?: number;
  /** Facultatif : boissons visées par jour, en millilitres. */
  waterMl?: number;
}

/** Valeurs nutritionnelles pour 100 g (ou 100 ml). Fibres nulles = inconnues. */
export interface Per100 {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
}

export type FoodSource = 'ciqual' | 'off' | 'custom';
export type FoodState = 'raw' | 'cooked';

/** Un aliment connu de l'app : créé par toi, ou repris de Ciqual ou d'Open Food Facts à la première utilisation. */
export interface Food extends SyncFields {
  source: FoodSource;
  /** Code Ciqual ou code-barres. */
  sourceId?: string | null;
  name: string;
  brand?: string;
  state?: FoodState | null;
  unit: 'g' | 'ml';
  per100: Per100;
  /** Portion type, ex. 30 g pour « 1 portion ». */
  servingG?: number | null;
  servingLabel?: string;
  favorite: boolean;
  lastUsedAt?: string | null;
  useCount: number;
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
  /** Fibres en g ; absent ou null = inconnu. */
  fiberG?: number | null;
  /** Aliment d'origine et quantité pesée : permettent de modifier la quantité. */
  foodId?: string | null;
  grams?: number | null;
  unit?: 'g' | 'ml';
  /** Copie des valeurs pour 100 g au moment de l'ajout (le journal ne change pas si l'aliment est modifié). */
  per100?: Per100 | null;
}

/** Une ligne d'un repas habituel. */
export interface MealTemplateItem {
  foodId?: string | null;
  name: string;
  quantity?: string;
  grams?: number | null;
  unit?: 'g' | 'ml';
  per100?: Per100 | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number | null;
}

/** Repas habituel : un ensemble d'aliments à ajouter d'un geste. */
export interface MealTemplate extends SyncFields {
  name: string;
  meal?: MealSlot | null;
  items: MealTemplateItem[];
}

/** Une boisson enregistrée (eau, etc.), en millilitres. */
export interface WaterLog extends SyncFields {
  date: string;
  ml: number;
}

export interface Exercise extends SyncFields {
  name: string;
  /** Exercice de la bibliothèque FORGE (null : exercice perso). */
  libraryId?: string | null;
  /** Groupe musculaire principal et secondaires (identifiants de src/data/muscles.ts). */
  muscle?: string | null;
  secondary?: string[];
  equipment?: string | null;
  kind?: 'compound' | 'isolation' | null;
  cues?: string[];
  /** Repos par défaut entre les séries, en secondes. */
  restSec?: number | null;
}

export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  /** Fourchette de répétitions visée, texte libre : « 8-10 ». */
  reps: string;
  /** Repos visé entre les séries, en secondes. */
  restSec?: number | null;
  /** Répétitions en réserve visées (RIR). */
  rir?: number | null;
}

/** Un programme : un ensemble de séances. Un seul est actif à la fois. */
export interface Program extends SyncFields {
  name: string;
  active: boolean;
  note?: string;
}

/** Une séance du programme, prévue certains jours de la semaine (1 = lundi … 7 = dimanche). */
export interface WorkoutTemplate extends SyncFields {
  name: string;
  weekdays: number[];
  exercises: TemplateExercise[];
  position: number;
  programId?: string | null;
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
  note?: string;
  /** Notes par exercice pendant la séance. */
  exerciseNotes?: Record<string, string>;
}

export interface WorkoutSet extends SyncFields {
  workoutId: string;
  exerciseId: string;
  position: number;
  weightKg: number;
  reps: number;
  /** Répétitions en réserve ressenties (RIR). RPE = 10 − RIR. */
  rir?: number | null;
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
