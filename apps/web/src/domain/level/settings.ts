/**
 * Réglages de FORGE LEVEL, regroupés ici comme ceux de PULSE : ce sont des conventions FORGE, à ajuster,
 * pas des mesures scientifiques. Les repères de santé sont sourcés.
 *
 * Sources des repères :
 * - OMS 2020 (Bull et al., Br J Sports Med 2020;54:1451-62) : 150 à 300 min d'activité d'endurance modérée par semaine.
 * - ACSM (Garber et al., Med Sci Sports Exerc 2011;43:1334-59) : souplesse 2 à 3 fois par semaine au moins.
 * - AASM et Sleep Research Society (Watson et al., Sleep 2015;38:843-4) : 7 h de sommeil ou plus par nuit chez l'adulte.
 * - Schoenfeld et al. 2017 (J Sports Sci 35:1073-82) : 10 séries ou plus par muscle et par semaine pour l'hypertrophie.
 */
export const LEVEL_SETTINGS = {
  xp: {
    /** Séance terminée avec au moins `minSets` séries : une par jour, aucune au-delà de `maxPerWeek` dans la semaine. */
    workout: { xp: 100, minSets: 3, maxPerWeek: 6 },
    /** Semaine du programme où toutes les séances dues sont faites. */
    programWeek: { xp: 150 },
    /** Record personnel (1RM estimé battu), au plus `maxPerWorkout` par séance. */
    record: { xp: 40, maxPerWorkout: 3 },
    /** Objectif de charge proposé par la double progression atteint, au plus `maxPerWorkout` par séance. */
    loadTarget: { xp: 20, maxPerWorkout: 3 },
    /** Pratique Mind terminée, une par jour. */
    mind: { xp: 30 },
    /** Cardio ou mobilité notés dans le journal d'activité, un par jour. */
    activity: { xp: 30 },
    /** Protéines du jour à `ratio` de l'objectif ou plus, au plus `maxPerWeek` jours par semaine. */
    protein: { xp: 20, ratio: 0.95, maxPerWeek: 5 },
    /** Bilan de la semaine rempli. */
    weekNote: { xp: 30 },
    badge: { commun: 50, rare: 200 },
    /** Cycle terminé avec au moins `minRate` des séances dues faites. */
    cycle: { xp: 500, minRate: 0.8 },
  },
  /** XP cumulée pour atteindre le niveau N : 134 × (N − 1)^1,85, arrondie à la dizaine. */
  levels: { coefficient: 134, exponent: 1.85, max: 50 },
  characteristics: {
    windowWeeks: 12,
    /** Variation expliquée par rapport à la note d'il y a 4 semaines. */
    compareDays: 28,
    confidence: { high: 9, medium: 6 },
    force: { minExercises: 3, minSessions: 4, gainForMax: 0.5, floor: 30, recordWeeks: 8, recordsForMax: 8 },
    hypertrophy: { minWeeks: 4, low: 10, high: 20 },
    endurance: { minWeeks: 4, weeklyMinutes: 150 },
    regularity: { minWeeks: 3, streakForMax: 12 },
    mobility: { minWeeks: 4, weeklySessions: 2 },
    recovery: { minCheckIns: 14, checkInDays: 28, sleepHours: 7, mindDaysPerWeek: 3 },
  },
  badges: {
    loadSteps: [60, 100, 140],
    e1rmGain: 0.1,
    activeWeeks: [4, 12],
    sessions: 100,
    routines: 7,
    mindStreak: { daysPerWeek: 5, weeks: 2 },
    programWeeks: 4,
    sessionTonnes: 10_000,
    totalTonnes: 100_000,
  },
} as const;
