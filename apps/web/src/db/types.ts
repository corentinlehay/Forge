import type { Aisle, FoodTag, Glyph, RecipeCategory } from '../data/recipes';
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

/** Fourchette de variation de poids visée, en % du poids par semaine (négatif : perte). */
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
  /** Objectif principal choisi au questionnaire de départ. */
  goal?: 'muscle' | 'perte' | 'recompo' | 'force' | 'forme';
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
  /** Recette mangée (Kitchen) et nombre de portions. */
  recipeKey?: string | null;
  recipeServings?: number | null;
  /** Coût estimé des portions mangées, si tous les prix des ingrédients sont connus. */
  costEur?: number | null;
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

/** Version allégée d'une séance, proposée par PULSE et acceptée : séries en moins, répétitions en réserve en plus. */
export interface WorkoutAdjustment {
  source: 'pulse';
  setsDelta: number;
  rirDelta: number;
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
  /** Séance allégée sur proposition de PULSE (absente : séance du programme telle quelle). */
  adjustment?: WorkoutAdjustment | null;
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
/**
 * Check-in du matin. Chaque réponse peut être passée (null) : au moins une est enregistrée,
 * et le check-in peut être complété plus tard dans la journée.
 */
export interface CheckIn extends SyncFields {
  date: string;
  sleepHours: number | null;
  energy: Scale5 | null;
  fatigue: Scale5 | null;
  soreness: Scale5 | null;
  note?: string;
  /** Détails de la nuit, tous facultatifs : heures locales HH:mm, réveils nocturnes, qualité ressentie. */
  bedTime?: string | null;
  wakeTime?: string | null;
  awakenings?: number | null;
  sleepQuality?: Scale5 | null;
  /** « As-tu des douleurs inhabituelles ? » : oui, non, ou question passée (null ou absent). */
  unusualPain?: boolean | null;
}

/** Journal émotionnel : une entrée par jour, chaque mesure facultative (échelles de 1 à 5). */
export interface MoodLog extends SyncFields {
  date: string;
  mood?: Scale5 | null;
  stress?: Scale5 | null;
  mentalEnergy?: Scale5 | null;
  motivation?: Scale5 | null;
  mentalLoad?: Scale5 | null;
  recovery?: Scale5 | null;
  /** Clés de MIND_EMOTIONS. */
  emotions?: string[];
  note?: string;
}

/** Pratique FORGE MIND réalisée : exercice guidé, routine ou (plus tard) séance audio. */
export interface MindSession extends SyncFields {
  date: string;
  /** Heure locale de début, HH:mm. */
  time: string;
  kind: 'exercise' | 'routine' | 'audio';
  /** Identifiant de l'exercice, de la routine ou de l'audio. */
  ref: string;
  title: string;
  durationSec: number;
  /** false : arrêté avant la fin (compté seulement après une minute). */
  completed: boolean;
  /** Tension ressentie avant et après, de 1 (détendu) à 5 (très tendu), facultative. */
  tensionBefore?: Scale5 | null;
  tensionAfter?: Scale5 | null;
}

/** Ingrédient d'une recette, avec une copie de ses valeurs pour 100 g. */
export interface RecipeIngredient {
  /** « ciqual:9119 », « off:<code-barres> », « perso:<id> » ou « libre:<nom> ». */
  key: string;
  name: string;
  /** Quantité pour le nombre de portions de base. */
  grams: number;
  /** Valeurs pour 100 g (null : inconnues). */
  per100: Per100 | null;
  aisle: Aisle;
  unit?: [string, string, number] | null;
  ml?: boolean;
  /** Allergènes et régimes connus (null : inconnus). */
  tags?: FoodTag[] | null;
}

/** Recette perso (ou copie d'une recette FORGE). */
export interface RecipeRecord extends SyncFields {
  name: string;
  description: string;
  categories: RecipeCategory[];
  prepMin: number;
  cookMin: number;
  servings: number;
  difficulty: 1 | 2 | 3;
  glyph: Glyph;
  ingredients: RecipeIngredient[];
  steps: string[];
  storage: string;
  /** Recette d'origine en cas de copie. */
  origin?: string | null;
}

/** Photo personnelle d'une recette (FORGE ou perso), en JPEG réduit. */
export interface RecipePhoto extends SyncFields {
  recipeKey: string;
  dataUrl: string;
}

/** Recette planifiée : reste distincte du journal tant qu'elle n'est pas marquée « mangée ». */
export interface MealPlan extends SyncFields {
  date: string;
  meal: MealSlot;
  recipeKey: string;
  servings: number;
  status: 'planned' | 'eaten';
  foodEntryId?: string | null;
}

export interface ShoppingListItem {
  key: string;
  name: string;
  grams: number;
  ml: boolean;
  aisle: Aisle;
  unit?: [string, string, number] | null;
  recipes: string[];
  checked: boolean;
}

export interface ShoppingList extends SyncFields {
  name: string;
  items: ShoppingListItem[];
  selections: { recipeKey: string; servings: number }[];
}

/** Prix saisi pour un ingrédient : montant payé pour une quantité. */
export interface PriceRecord extends SyncFields {
  key: string;
  name: string;
  amountEur: number;
  quantity: number;
  unit: 'g' | 'ml' | 'piece';
}

/** Historique des objectifs nutritionnels : chaque changement, sa source et sa raison. */
export interface TargetChange extends SyncFields {
  date: string;
  before: NutritionTargets | null;
  after: NutritionTargets;
  source: 'proposition' | 'manuel' | 'questionnaire';
  reason?: string;
}

/**
 * État d'une séance audio sur cet appareil : position de reprise, favori, dernière écoute.
 * La clé est l'identifiant de la séance (catalogue du serveur).
 */
export interface AudioState {
  id: string;
  position: number;
  durationSec: number;
  favorite: boolean;
  lastPlayedAt: string | null;
  updatedAt: string;
}

/** Séance audio téléchargée pour l'écoute hors connexion (non incluse dans les sauvegardes). */
export interface AudioDownload {
  id: string;
  version: string;
  mime: string;
  size: number;
  blob: Blob;
  savedAt: string;
}

/** Mensurations en centimètres : chaque mesure est facultative. */
export interface Measurement extends SyncFields {
  date: string;
  waistCm?: number | null;
  chestCm?: number | null;
  armCm?: number | null;
  thighCm?: number | null;
  hipsCm?: number | null;
  note?: string;
}

export type PhotoPose = 'face' | 'profil' | 'dos';

/** Photo du corps, gardée sur l'appareil seulement (ni envoyée, ni dans la sauvegarde). */
export interface BodyPhoto extends SyncFields {
  date: string;
  pose: PhotoPose;
  /** Image JPEG réduite à 1 080 px, en data URL. */
  dataUrl: string;
  width: number;
  height: number;
}

/** Entrée du journal d'une douleur : intensité de 0 à 10 et signes remarqués ce jour-là. */
/** Regard personnel sur une semaine (lundi) : ce qui a marché, ce qui est à ajuster, l'intention pour la suivante. */
export interface WeekNote extends SyncFields {
  weekStart: string;
  wentWell?: string;
  toAdjust?: string;
  intention?: string;
}

export type PulseComponentKey = 'sommeil' | 'physiologie' | 'ressenti' | 'charge' | 'mental';
export type PulseMode = 'feu-vert' | 'normal' | 'allege' | 'recuperation';
export type PulseConfidence = 'haute' | 'moyenne' | 'basse';
export type NutritionKind = 'coherent' | 'sous' | 'au-dessus' | 'incomplet' | 'sans-objectif';
/** Choix sur la séance proposée : version allégée, récupération active à la place, séance prévue gardée, ou déplacée à demain. */
export type PulseChoice = 'alleger' | 'remplacer' | 'garder' | 'deplacer';
/** Niveau de lecture du score (conventions d'interface réglables, pas des seuils médicaux). */
export type PulseLevel = 'basse' | 'moderee' | 'satisfaisante' | 'elevee';

/**
 * Journal PULSE : le résultat du jour tel qu'il a été montré, et ton choix sur la séance.
 * Une ligne par jour ; les règles changent de version sans réécrire le passé.
 */
export interface PulseDay extends SyncFields {
  date: string;
  engineVersion: number;
  readiness: number | null;
  confidence: PulseConfidence | null;
  mode: PulseMode | null;
  components: { key: PulseComponentKey; score: number | null; weight: number }[];
  nutritionKind: NutritionKind;
  nutritionScore: number | null;
  rules: string[];
  plannedTemplateId?: string | null;
  /** À partir des règles v2 : niveau de lecture, dimensions renseignées, proposition faite pour la séance. */
  level?: PulseLevel | null;
  coverage?: number | null;
  trainingKind?: string | null;
  choice?: PulseChoice | null;
  choiceAt?: string | null;
}

export interface PainLog {
  date: string;
  intensity: number;
  /** Clés de PAIN_FLAGS. */
  flags?: string[];
  note?: string;
}

/** Douleur suivie : zone sur la silhouette, début, fin éventuelle, activités associées, journal d'intensité. */
export interface Pain extends SyncFields {
  zone: string;
  startedOn: string;
  resolvedOn: string | null;
  activities: string[];
  note?: string;
  logs: PainLog[];
}
