import { EXERCISE_LIBRARY, libraryExercise } from '../data/exerciseLibrary';
import { canDo, TRAITS, type Need, type Pattern } from '../data/exerciseTraits';
import type { Experience, GainRate, NutritionTargets, Sex } from '../db/types';

/**
 * Plan de départ calculé à partir du questionnaire, sans IA, avec des règles explicites.
 * Tout reste modifiable ensuite. Ce sont des repères généraux, pas un avis médical.
 */

export type Goal = 'muscle' | 'perte' | 'recompo' | 'force' | 'forme';
export type DailyActivity = 'assis' | 'debout' | 'physique';
export type Zone = 'epaules' | 'genoux' | 'dos';

export interface PlanAnswers {
  firstName?: string;
  goal: Goal;
  sex: Sex;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  activity: DailyActivity;
  experience: Experience;
  returning: boolean;
  /** Jours d'entraînement (1 = lundi … 7 = dimanche). */
  weekdays: number[];
  sessionMinutes: 45 | 60 | 75 | 90;
  place: 'salle' | 'maison';
  /** Matériel à la maison. */
  equipment: Need[];
  zones: Zone[];
}

export const GOAL_LABELS: Record<Goal, string> = {
  muscle: 'Prendre du muscle',
  perte: 'Perdre du gras',
  recompo: 'Me recomposer',
  force: 'Gagner en force',
  forme: 'Être en forme',
};

export const MIN_AGE = 18;

export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export const bmi = (weightKg: number, heightCm: number) => weightKg / (heightCm / 100) ** 2;

/** Métabolisme de base, équation de Mifflin-St Jeor (1990). */
export function bmrMifflin(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

const ACTIVITY_BASE: Record<DailyActivity, number> = { assis: 1.35, debout: 1.5, physique: 1.65 };

/** Niveau d'activité : vie quotidienne, plus environ 0,025 par heure de musculation hebdomadaire. */
export function activityFactor(activity: DailyActivity, sessions: number, minutes: number): number {
  return Math.round((ACTIVITY_BASE[activity] + 0.025 * sessions * (minutes / 60)) * 100) / 100;
}

const round5 = (v: number) => Math.round(v / 5) * 5;
const round10 = (v: number) => Math.round(v / 10) * 10;

export interface NutritionPlan {
  goal: Goal;
  age: number;
  bmrKcal: number;
  factor: number;
  maintenanceKcal: number;
  targets: NutritionTargets;
  gainRate: GainRate;
  /** Explications et précautions, affichées telles quelles. */
  notes: string[];
}

export type PlanResult<T> = { ok: true; plan: T } | { ok: false; reason: string };

export function nutritionPlan(a: PlanAnswers, today: string): PlanResult<NutritionPlan> {
  const age = ageOn(a.birthDate, today);
  if (age < MIN_AGE)
    return { ok: false, reason: 'FORGE est conçu pour les adultes : les besoins des moins de 18 ans sont différents. Parles-en à un médecin ou à un coach diplômé.' };
  const notes: string[] = [];
  const b = bmi(a.weightKg, a.heightCm);
  let goal = a.goal;
  if (goal === 'perte' && b < 20) {
    goal = 'recompo';
    notes.push(
      'Ton poids est déjà dans le bas de la norme : FORGE ne propose pas de déficit et vise la stabilité. Si tu veux perdre du poids, parles-en à un professionnel de santé.',
    );
  } else if (b < 18.5) {
    notes.push('Ton IMC est sous 18,5 : avant un changement d’alimentation, demande l’avis d’un professionnel de santé.');
  }

  const bmrKcal = Math.round(bmrMifflin(a.sex, a.weightKg, a.heightCm, age));
  const factor = activityFactor(a.activity, a.weekdays.length, a.sessionMinutes);
  const maintenanceKcal = round10(bmrKcal * factor);

  const advanced = a.experience === 'advanced';
  const settings: Record<Goal, { adjust: number; rate: GainRate }> = {
    muscle: advanced ? { adjust: 0.05, rate: { lowPctPerWeek: 0.1, highPctPerWeek: 0.25 } } : { adjust: 0.1, rate: { lowPctPerWeek: 0.25, highPctPerWeek: 0.5 } },
    force: { adjust: 0.05, rate: { lowPctPerWeek: 0, highPctPerWeek: 0.25 } },
    recompo: { adjust: 0, rate: { lowPctPerWeek: -0.1, highPctPerWeek: 0.1 } },
    forme: { adjust: 0, rate: { lowPctPerWeek: -0.1, highPctPerWeek: 0.1 } },
    perte: { adjust: -0.2, rate: { lowPctPerWeek: -1, highPctPerWeek: -0.5 } },
  };
  const { adjust, rate } = settings[goal];
  const kcal = Math.max(round10(maintenanceKcal * (1 + adjust)), round10(bmrKcal));

  // Protéines calculées sur un poids de référence plafonné (IMC 27) pour ne pas les gonfler en cas de surpoids.
  const refKg = Math.min(a.weightKg, 27 * (a.heightCm / 100) ** 2);
  const perKg = goal === 'perte' ? 2 : goal === 'forme' ? 1.6 : 1.8;
  const proteinG = round5(refKg * perKg);
  let fatG = round5((kcal * 0.25) / 9);
  let carbsG = round5((kcal - proteinG * 4 - fatG * 9) / 4);
  if (carbsG < 0) {
    fatG = round5((kcal * 0.2) / 9);
    carbsG = Math.max(0, round5((kcal - proteinG * 4 - fatG * 9) / 4));
  }

  notes.push(
    `Dépense estimée : ${maintenanceKcal} kcal par jour (métabolisme de base ${bmrKcal} kcal × ${String(factor).replace('.', ',')}). C’est une estimation : ta courbe de poids des 2 à 3 premières semaines dira s’il faut l’ajuster.`,
  );
  return {
    ok: true,
    plan: {
      goal,
      age,
      bmrKcal,
      factor,
      maintenanceKcal,
      targets: { kcal, proteinG, carbsG, fatG, fiberG: 30, waterMl: a.sex === 'male' ? 2000 : 1600 },
      gainRate: rate,
      notes,
    },
  };
}

/* ───────────── Entraînement ───────────── */

type Slot = Pattern[];
const S = {
  squat: ['squat', 'fente', 'iso-quadriceps'],
  charniere: ['charniere', 'iso-fessiers', 'iso-ischios'],
  fente: ['fente', 'squat'],
  pousseH: ['pousse-h'],
  pousseV: ['pousse-v', 'iso-epaules'],
  tirageV: ['tirage-v', 'tirage-h', 'iso-dos'],
  tirageH: ['tirage-h', 'tirage-v', 'iso-dos'],
  ischios: ['iso-ischios', 'charniere'],
  fessiers: ['iso-fessiers'],
  quadri: ['iso-quadriceps'],
  pecs: ['iso-pectoraux', 'pousse-h'],
  epaules: ['iso-epaules'],
  arriere: ['iso-arriere-epaules'],
  biceps: ['iso-biceps'],
  triceps: ['iso-triceps'],
  mollets: ['iso-mollets'],
  trapezes: ['iso-trapezes'],
  abdos: ['abdos'],
} satisfies Record<string, Slot>;

interface SessionModel {
  name: string;
  /** Emplacements, dans l'ordre ; [emplacement, variante] : la variante 1 choisit un autre exercice du même type. */
  slots: [Slot, number][];
}

const FULL_A: SessionModel = {
  name: 'Corps entier A',
  slots: [
    [S.squat, 0],
    [S.pousseH, 0],
    [S.tirageV, 0],
    [S.ischios, 0],
    [S.epaules, 0],
    [S.triceps, 0],
    [S.abdos, 0],
  ],
};
const FULL_B: SessionModel = {
  name: 'Corps entier B',
  slots: [
    [S.charniere, 0],
    [S.pousseV, 0],
    [S.tirageH, 0],
    [S.fente, 0],
    [S.biceps, 0],
    [S.mollets, 0],
    [S.abdos, 1],
  ],
};
const FULL_C: SessionModel = {
  name: 'Corps entier C',
  slots: [
    [S.squat, 1],
    [S.tirageV, 1],
    [S.pousseH, 1],
    [S.fessiers, 0],
    [S.arriere, 0],
    [S.triceps, 1],
    [S.abdos, 2],
  ],
};
const UPPER = (v: number, name: string): SessionModel => ({
  name,
  slots: v
    ? [
        [S.pousseH, 1],
        [S.tirageV, 1],
        [S.pousseV, 1],
        [S.tirageH, 1],
        [S.arriere, 0],
        [S.triceps, 1],
        [S.biceps, 1],
      ]
    : [
        [S.pousseH, 0],
        [S.tirageH, 0],
        [S.pousseV, 0],
        [S.tirageV, 0],
        [S.epaules, 0],
        [S.biceps, 0],
        [S.triceps, 0],
      ],
});
const LOWER = (v: number, name: string): SessionModel => ({
  name,
  slots: v
    ? [
        [S.charniere, 1],
        [S.squat, 1],
        [S.fessiers, 0],
        [S.quadri, 0],
        [S.ischios, 1],
        [S.mollets, 0],
        [S.abdos, 1],
      ]
    : [
        [S.squat, 0],
        [S.charniere, 0],
        [S.fente, 0],
        [S.ischios, 0],
        [S.mollets, 0],
        [S.abdos, 0],
        [S.quadri, 0],
      ],
});
const PUSH = (v: number, name: string): SessionModel => ({
  name,
  slots: [
    [S.pousseH, v],
    [S.pousseV, v],
    [S.pousseH, v + 1],
    [S.epaules, v],
    [S.triceps, v],
    [S.pecs, v],
    [S.triceps, v + 1],
  ],
});
const PULL = (v: number, name: string): SessionModel => ({
  name,
  slots: [
    [S.tirageV, v],
    [S.tirageH, v],
    [S.tirageH, v + 1],
    [S.arriere, v],
    [S.biceps, v],
    [S.biceps, v + 1],
    [S.trapezes, v],
  ],
});
const LEGS = (v: number, name: string): SessionModel => ({
  name,
  slots: [
    [S.squat, v],
    [S.charniere, v],
    [S.fente, v],
    [S.quadri, v],
    [S.ischios, v],
    [S.mollets, v],
    [S.abdos, v],
  ],
});

export function splitFor(days: number): { label: string; sessions: SessionModel[] } {
  switch (Math.max(1, Math.min(6, days))) {
    case 1:
      return { label: 'corps entier', sessions: [FULL_A] };
    case 2:
      return { label: 'corps entier', sessions: [FULL_A, FULL_B] };
    case 3:
      return { label: 'corps entier', sessions: [FULL_A, FULL_B, FULL_C] };
    case 4:
      return { label: 'haut et bas du corps', sessions: [UPPER(0, 'Haut du corps A'), LOWER(0, 'Bas du corps A'), UPPER(1, 'Haut du corps B'), LOWER(1, 'Bas du corps B')] };
    case 5:
      return {
        label: 'hybride haut, bas, poussée, tirage, jambes',
        sessions: [UPPER(0, 'Haut du corps'), LOWER(0, 'Bas du corps'), PUSH(1, 'Poussée'), PULL(1, 'Tirage'), LEGS(1, 'Jambes')],
      };
    default:
      return {
        label: 'poussée, tirage, jambes',
        sessions: [PUSH(0, 'Poussée A'), PULL(0, 'Tirage A'), LEGS(0, 'Jambes A'), PUSH(1, 'Poussée B'), PULL(1, 'Tirage B'), LEGS(1, 'Jambes B')],
      };
  }
}

/** Ordre de préférence des exercices de chaque type (les premiers sont choisis en priorité). */
// prettier-ignore
const PREFERENCES: Partial<Record<Pattern, string[]>> = {
  'pousse-h': ['barbell_bench_press_-_medium_grip', 'incline_dumbbell_press', 'dumbbell_bench_press', 'barbell_incline_bench_press_-_medium_grip', 'machine_bench_press', 'dumbbell_floor_press', 'pushups', 'decline_push-up', 'dips_-_chest_version'],
  'pousse-v': ['standing_military_press', 'seated_dumbbell_press', 'machine_shoulder_military_press', 'standing_dumbbell_press', 'arnold_dumbbell_press'],
  'tirage-v': ['pullups', 'wide-grip_lat_pulldown', 'chin-up'],
  'tirage-h': ['bent_over_barbell_row', 'seated_cable_rows', 'one-arm_dumbbell_row', 'bent_over_two-dumbbell_row', 't-bar_row_with_handle', 'inverted_row'],
  squat: ['barbell_squat', 'leg_press', 'hack_squat', 'goblet_squat', 'front_barbell_squat', 'bodyweight_squat'],
  charniere: ['romanian_deadlift', 'barbell_deadlift', 'stiff-legged_dumbbell_deadlift', 'one-arm_kettlebell_swings', 'stiff-legged_barbell_deadlift', 'sumo_deadlift', 'good_morning'],
  fente: ['split_squat_with_dumbbells', 'dumbbell_lunges', 'barbell_lunge', 'dumbbell_step_ups', 'bodyweight_walking_lunge'],
  'iso-pectoraux': ['cable_crossover', 'butterfly', 'dumbbell_flyes'],
  'iso-dos': ['straight-arm_pulldown'],
  'iso-epaules': ['side_lateral_raise', 'cable_seated_lateral_raise', 'front_dumbbell_raise'],
  'iso-arriere-epaules': ['face_pull', 'reverse_flyes'],
  'iso-biceps': ['ez-bar_curl', 'hammer_curls', 'dumbbell_bicep_curl', 'barbell_curl', 'preacher_curl', 'concentration_curls'],
  'iso-triceps': ['triceps_pushdown', 'cable_rope_overhead_triceps_extension', 'standing_dumbbell_triceps_extension', 'lying_triceps_press', 'close-grip_barbell_bench_press', 'bench_dips', 'push-ups_-_close_triceps_position', 'dips_-_triceps_version'],
  'iso-quadriceps': ['leg_extensions'],
  'iso-ischios': ['lying_leg_curls', 'seated_leg_curl'],
  'iso-fessiers': ['barbell_hip_thrust', 'butt_lift_bridge', 'single_leg_glute_bridge', 'glute_kickback'],
  'iso-mollets': ['standing_calf_raises', 'seated_calf_raise', 'standing_dumbbell_calf_raise'],
  'iso-trapezes': ['dumbbell_shrug', 'barbell_shrug'],
  abdos: ['hanging_leg_raise', 'cable_crunch', 'plank', 'dead_bug', 'crunches', 'side_bridge', 'russian_twist', 'ab_roller', 'oblique_crunches_-_on_the_floor'],
};

/** Mouvements écartés quand une zone est à ménager (les plus exigeants pour elle). */
// prettier-ignore
export const ZONE_EXCLUSIONS: Record<Zone, string[]> = {
  epaules: ['dips_-_chest_version', 'dips_-_triceps_version', 'bench_dips', 'arnold_dumbbell_press', 'standing_military_press'],
  genoux: ['barbell_squat', 'front_barbell_squat', 'hack_squat', 'barbell_lunge', 'dumbbell_lunges', 'bodyweight_walking_lunge', 'split_squat_with_dumbbells', 'leg_extensions'],
  dos: ['barbell_deadlift', 'good_morning', 'romanian_deadlift', 'stiff-legged_barbell_deadlift', 'stiff-legged_dumbbell_deadlift', 'sumo_deadlift', 'one-arm_kettlebell_swings', 'bent_over_barbell_row', 'bent_over_two-dumbbell_row', 't-bar_row_with_handle', 'barbell_squat', 'front_barbell_squat', 'standing_military_press', 'hyperextensions_back_extensions'],
};

export const ZONE_LABELS: Record<Zone, string> = { epaules: 'Épaules', genoux: 'Genoux', dos: 'Bas du dos' };

export interface PlannedExercise {
  libraryId: string;
  sets: number;
  reps: string;
  restSec: number;
  rir: number;
}

export interface PlannedSession {
  name: string;
  weekday: number;
  exercises: PlannedExercise[];
}

export interface TrainingPlan {
  programName: string;
  splitLabel: string;
  sessions: PlannedSession[];
  /** Noms des exercices écartés pour les zones à ménager. */
  excluded: string[];
  warnings: string[];
}

const EXERCISES_PER_MINUTES: Record<PlanAnswers['sessionMinutes'], number> = { 45: 4, 60: 5, 75: 6, 90: 7 };
const TIMED = new Set(['plank', 'side_bridge']);

function prescription(id: string, index: number, a: Pick<PlanAnswers, 'goal' | 'experience' | 'returning'>): PlannedExercise {
  const lib = libraryExercise(id)!;
  const compound = lib.kind === 'compound';
  const bodyweight = lib.equipment === 'poids-du-corps';
  const first = index === 0;
  let reps: string;
  if (TIMED.has(id)) reps = '30-45';
  else if (TRAITS[id]?.needs.includes('traction') && compound) reps = '5-10';
  else if (bodyweight && compound) reps = '8-15';
  else if (a.goal === 'force') reps = compound ? (first ? '3-6' : '6-8') : '8-12';
  else if (a.goal === 'forme') reps = compound ? '8-12' : '12-15';
  else reps = compound ? (first ? '6-10' : '8-12') : '10-15';

  let sets = compound ? 3 : 2;
  if (a.experience === 'intermediate') sets = first && compound ? 4 : 3;
  if (a.experience === 'advanced') sets = index < 2 && compound ? 4 : 3;
  if (a.returning) sets = Math.min(sets, 3);

  const rir = a.returning ? 3 : a.experience === 'advanced' ? 1 : 2;
  const restSec = a.goal === 'force' && compound && first ? Math.max(lib.rest, 180) : lib.rest;
  return { libraryId: id, sets, reps, restSec, rir };
}

export function trainingPlan(a: PlanAnswers): TrainingPlan {
  const days = [...new Set(a.weekdays)].filter((d) => d >= 1 && d <= 7).sort();
  const split = splitFor(days.length);
  const gym = a.place === 'salle';
  const available = new Set<Need>(a.equipment);
  const excludedIds = new Set(a.zones.flatMap((z) => ZONE_EXCLUSIONS[z]));
  const usable = (id: string) => {
    const traits = TRAITS[id];
    return Boolean(traits && libraryExercise(id) && !excludedIds.has(id) && canDo(traits.needs, available, gym));
  };
  const candidates = (pattern: Pattern) => (PREFERENCES[pattern] ?? EXERCISE_LIBRARY.filter((e) => TRAITS[e.id]?.pattern === pattern).map((e) => e.id)).filter(usable);
  const perSession = Math.max(3, EXERCISES_PER_MINUTES[a.sessionMinutes] - (a.goal === 'force' ? 1 : 0));
  const missing = new Set<string>();

  const sessions: PlannedSession[] = split.sessions.map((model, i) => {
    const chosen: string[] = [];
    for (const [slot, variant] of model.slots) {
      if (chosen.length >= perSession) break;
      let pick: string | undefined;
      for (const pattern of slot) {
        const all = candidates(pattern).filter((id) => !chosen.includes(id));
        // Avec du matériel, les exercices chargés passent avant ceux sans matériel.
        const equipped = all.filter((id) => TRAITS[id]!.needs.length > 0);
        const list = equipped.length ? equipped : all;
        if (list.length) {
          pick = list[variant % list.length];
          break;
        }
      }
      if (pick) chosen.push(pick);
      else missing.add(slot[0]!);
    }
    return { name: model.name, weekday: days[i] ?? days[i % Math.max(1, days.length)] ?? 1, exercises: chosen.map((id, index) => prescription(id, index, a)) };
  });

  const warnings: string[] = [];
  if (missing.has('tirage-v') || missing.has('tirage-h'))
    warnings.push('Aucun exercice de tirage pour le dos avec ton matériel : une barre de traction ou des haltères compléteraient le programme.');
  if (missing.has('charniere') || missing.has('iso-ischios'))
    warnings.push('Peu d’exercices pour l’arrière des cuisses avec ton matériel : des haltères ou un kettlebell compléteraient le programme.');
  if (a.zones.length)
    warnings.push(
      'Zones à ménager : FORGE écarte les mouvements les plus exigeants pour elles. Ça ne remplace pas l’avis d’un professionnel de santé ; arrête un exercice qui fait mal.',
    );

  return {
    programName: `Plan FORGE, ${days.length} séance${days.length > 1 ? 's' : ''} par semaine`,
    splitLabel: split.label,
    sessions,
    excluded: [...excludedIds].map((id) => libraryExercise(id)?.name).filter((n): n is string => Boolean(n)),
    warnings,
  };
}
