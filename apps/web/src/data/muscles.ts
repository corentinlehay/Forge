/** Les 15 groupes musculaires suivis par FORGE. */
export const MUSCLE_GROUPS = [
  'pectoraux',
  'dos',
  'trapezes',
  'lombaires',
  'epaules',
  'biceps',
  'triceps',
  'avant-bras',
  'abdominaux',
  'obliques',
  'fessiers',
  'quadriceps',
  'ischios',
  'adducteurs',
  'mollets',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  pectoraux: 'Pectoraux',
  dos: 'Dos',
  trapezes: 'Trapèzes',
  lombaires: 'Lombaires',
  epaules: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  'avant-bras': 'Avant-bras',
  abdominaux: 'Abdominaux',
  obliques: 'Obliques',
  fessiers: 'Fessiers',
  quadriceps: 'Quadriceps',
  ischios: 'Ischio-jambiers',
  adducteurs: 'Adducteurs',
  mollets: 'Mollets',
};

export const EQUIPMENT_LABELS = {
  barre: 'Barre',
  halteres: 'Haltères',
  poulie: 'Poulie',
  machine: 'Machine',
  'poids-du-corps': 'Poids du corps',
  'barre-ez': 'Barre EZ',
  kettlebell: 'Kettlebell',
  autre: 'Autre',
} as const;

export type Equipment = keyof typeof EQUIPMENT_LABELS;
