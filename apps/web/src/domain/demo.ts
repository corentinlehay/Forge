import type {
  CheckIn,
  Exercise,
  Food,
  FoodEntry,
  MealSlot,
  MealTemplate,
  MetaEntry,
  Profile,
  Program,
  Scale5,
  WaterLog,
  WeighIn,
  Workout,
  WorkoutSet,
  WorkoutTemplate,
} from '../db/types';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { addDays } from '../lib/dates';
import { ONBOARDING_KEY } from './onboarding';
import { isoWeekday } from './training';

/**
 * Jeu de données de démonstration, entièrement fictif, généré autour d'aujourd'hui.
 * Il est chargé dans une base séparée (« forge-demo ») : jamais mêlé à tes données.
 * Générateur pseudo-aléatoire à graine fixe : la démo est la même à chaque chargement.
 */

export const DEMO_FIRST_NAME = 'Démo';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DemoExercise {
  name: string;
  sets: number;
  reps: [number, number];
  baseKg: number;
  step: number;
}

const PROGRAM: { name: string; weekday: number; exercises: DemoExercise[] }[] = [
  {
    name: 'Upper A',
    weekday: 1,
    exercises: [
      {
        name: 'Développé couché',
        sets: 4,
        reps: [6, 8],
        baseKg: 80,
        step: 2.5,
      },
      { name: 'Rowing barre', sets: 4, reps: [8, 10], baseKg: 70, step: 2.5 },
      {
        name: 'Développé militaire debout',
        sets: 3,
        reps: [8, 10],
        baseKg: 47.5,
        step: 2.5,
      },
      {
        name: 'Tractions pronation',
        sets: 3,
        reps: [6, 8],
        baseKg: 7.5,
        step: 2.5,
      },
      {
        name: 'Curl aux haltères',
        sets: 3,
        reps: [10, 12],
        baseKg: 15,
        step: 1,
      },
    ],
  },
  {
    name: 'Lower A',
    weekday: 2,
    exercises: [
      { name: 'Squat', sets: 4, reps: [5, 7], baseKg: 105, step: 2.5 },
      {
        name: 'Soulevé de terre roumain',
        sets: 3,
        reps: [8, 10],
        baseKg: 95,
        step: 2.5,
      },
      {
        name: 'Presse à cuisses',
        sets: 3,
        reps: [10, 12],
        baseKg: 190,
        step: 5,
      },
      {
        name: 'Leg curl allongé',
        sets: 3,
        reps: [10, 12],
        baseKg: 45,
        step: 2.5,
      },
      {
        name: 'Mollets debout',
        sets: 4,
        reps: [12, 15],
        baseKg: 80,
        step: 5,
      },
    ],
  },
  {
    name: 'Upper B',
    weekday: 4,
    exercises: [
      {
        name: 'Développé incliné aux haltères',
        sets: 4,
        reps: [8, 10],
        baseKg: 30,
        step: 1,
      },
      {
        name: 'Tirage horizontal à la poulie',
        sets: 4,
        reps: [10, 12],
        baseKg: 62.5,
        step: 2.5,
      },
      {
        name: 'Élévations latérales',
        sets: 4,
        reps: [12, 15],
        baseKg: 10,
        step: 1,
      },
      {
        name: 'Dips, buste droit',
        sets: 3,
        reps: [8, 10],
        baseKg: 12.5,
        step: 2.5,
      },
    ],
  },
  {
    name: 'Lower B',
    weekday: 5,
    exercises: [
      {
        name: 'Soulevé de terre',
        sets: 3,
        reps: [4, 6],
        baseKg: 145,
        step: 2.5,
      },
      {
        name: 'Fentes bulgares',
        sets: 3,
        reps: [8, 10],
        baseKg: 22,
        step: 1,
      },
      { name: 'Hip thrust', sets: 3, reps: [8, 10], baseKg: 115, step: 5 },
      {
        name: 'Leg extension',
        sets: 3,
        reps: [12, 15],
        baseKg: 55,
        step: 2.5,
      },
    ],
  },
  {
    name: 'Bras et épaules',
    weekday: 6,
    exercises: [
      {
        name: 'Développé épaules assis aux haltères',
        sets: 3,
        reps: [8, 10],
        baseKg: 24,
        step: 1,
      },
      {
        name: 'Élévations latérales',
        sets: 3,
        reps: [12, 15],
        baseKg: 10,
        step: 1,
      },
      {
        name: 'Curl à la barre EZ',
        sets: 3,
        reps: [8, 10],
        baseKg: 32.5,
        step: 2.5,
      },
      {
        name: 'Barre au front',
        sets: 3,
        reps: [8, 10],
        baseKg: 30,
        step: 2.5,
      },
    ],
  },
];

type DemoFood = [name: string, quantity: string, kcal: number, p: number, c: number, f: number];
const MEALS: Record<MealSlot, { hour: number; foods: DemoFood[] }> = {
  breakfast: {
    hour: 7,
    foods: [
      ['Flocons d’avoine et lait', '100 g + 300 ml', 620, 30, 85, 15],
      ['Œufs brouillés', '3 œufs', 240, 19, 2, 17],
      ['Banane', '1 moyenne', 105, 1, 27, 0],
    ],
  },
  lunch: {
    hour: 12,
    foods: [
      ['Riz basmati cuit', '300 g', 390, 8, 85, 1],
      ['Blanc de poulet', '200 g', 330, 62, 0, 7],
      ['Huile d’olive', '15 ml', 135, 0, 0, 15],
      ['Haricots verts', '200 g', 60, 4, 8, 0],
    ],
  },
  snack: {
    hour: 16,
    foods: [
      ['Skyr nature', '300 g', 190, 33, 12, 1],
      ['Amandes', '30 g', 175, 6, 3, 15],
    ],
  },
  dinner: {
    hour: 19,
    foods: [
      ['Pâtes complètes cuites', '300 g', 450, 16, 87, 3],
      ['Bœuf haché 5 %', '200 g', 270, 42, 0, 10],
      ['Sauce tomate', '150 g', 75, 2, 11, 2],
      ['Pain complet', '80 g', 200, 8, 36, 3],
    ],
  },
};

export interface DemoTables {
  profile: Profile[];
  weighIns: WeighIn[];
  meta: MetaEntry[];
  foodEntries: FoodEntry[];
  exercises: Exercise[];
  workoutTemplates: WorkoutTemplate[];
  workouts: Workout[];
  workoutSets: WorkoutSet[];
  checkIns: CheckIn[];
  foods: Food[];
  mealTemplates: MealTemplate[];
  waterLogs: WaterLog[];
  programs: Program[];
}

function localIso(dateKey: string, hour: number, minute = 0): string {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour, minute).toISOString();
}

const clamp5 = (v: number): Scale5 => Math.min(5, Math.max(1, Math.round(v))) as Scale5;
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

export function generateDemoData(today: string, now: Date): DemoTables {
  const rand = mulberry32(20261123);
  const stamp = now.toISOString();
  const hour = now.getHours();
  let seq = 0;
  const id = (prefix: string) => `demo-${prefix}-${String(++seq).padStart(5, '0')}`;
  const sync = (prefix: string, at = stamp) => ({
    id: id(prefix),
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  });

  // Pesées : 12 semaines, quelques jours sans pesée.
  const weighIns: WeighIn[] = [];
  for (let i = 83; i >= 0; i--) {
    if (i === 0 && hour < 7) continue;
    if (i % 9 === 4) continue;
    const k = 83 - i;
    const w = 86.4 + 0.0428 * k + 0.32 * Math.sin(1.7 * k) + 0.18 * Math.sin(0.37 * k + 1) + 0.12 * Math.sin(3.1 * k + 2);
    weighIns.push({
      ...sync('pesee'),
      date: addDays(today, -i),
      time: `07:${String(5 + (k % 20)).padStart(2, '0')}`,
      weightKg: Math.round(w * 10) / 10,
      context: 'morning_fasted',
    });
  }

  // Programme et exercices.
  const exercises = new Map<string, Exercise>();
  const exerciseId = (name: string) => {
    let e = exercises.get(name);
    if (!e) {
      const lib = EXERCISE_LIBRARY.find((l) => l.name === name);
      e = lib
        ? {
            ...sync('exercice'),
            name,
            libraryId: lib.id,
            muscle: lib.muscle,
            secondary: lib.secondary,
            equipment: lib.equipment,
            kind: lib.kind,
            cues: lib.cues,
            restSec: lib.rest,
          }
        : { ...sync('exercice'), name };
      exercises.set(name, e);
    }
    return e.id;
  };
  const program: Program = {
    ...sync('programme'),
    name: 'Programme démo, 5 séances',
    active: true,
  };
  const workoutTemplates: WorkoutTemplate[] = PROGRAM.map((t, position) => ({
    ...sync('seance-type'),
    name: t.name,
    weekdays: [t.weekday],
    position,
    programId: program.id,
    exercises: t.exercises.map((e) => ({
      exerciseId: exerciseId(e.name),
      sets: e.sets,
      reps: `${e.reps[0]}-${e.reps[1]}`,
      restSec: EXERCISE_LIBRARY.find((l) => l.name === e.name)?.rest ?? 120,
      rir: 2,
    })),
  }));

  // Séances des 6 dernières semaines (hier compris), avec une progression lente des charges.
  const workouts: Workout[] = [];
  const workoutSets: WorkoutSet[] = [];
  for (let i = 42; i >= 1; i--) {
    const date = addDays(today, -i);
    const plan = PROGRAM.find((t) => t.weekday === isoWeekday(date));
    if (!plan || rand() < 0.1) continue;
    const template = workoutTemplates.find((t) => t.name === plan.name)!;
    const weeksIn = (42 - i) / 7;
    const workout: Workout = {
      ...sync('seance', localIso(date, 18)),
      date,
      name: plan.name,
      templateId: template.id,
      exerciseIds: plan.exercises.map((e) => exerciseId(e.name)),
      startedAt: localIso(date, 18),
      endedAt: localIso(date, 19, 10),
    };
    workouts.push(workout);
    let position = 0;
    for (const e of plan.exercises) {
      const load = roundTo(e.baseKg * (1 + 0.012 * weeksIn), e.step);
      for (let s = 0; s < e.sets; s++) {
        const reps = Math.max(e.reps[0], e.reps[1] - s - Math.floor(rand() * 2));
        workoutSets.push({
          ...sync('serie', workout.startedAt),
          workoutId: workout.id,
          exerciseId: exerciseId(e.name),
          position: position++,
          weightKg: load,
          reps,
          rir: s === e.sets - 1 ? 1 : 2,
        });
      }
    }
  }

  // Journal alimentaire : 14 jours ; aujourd'hui, seulement les repas déjà passés.
  const foodEntries: FoodEntry[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = addDays(today, -i);
    for (const [meal, def] of Object.entries(MEALS) as [MealSlot, (typeof MEALS)[MealSlot]][]) {
      if (i === 0 && hour < def.hour) continue;
      def.foods.forEach(([name, quantity, kcal, proteinG, carbsG, fatG], j) => {
        if (j > 0 && rand() < 0.15) return;
        foodEntries.push({
          ...sync('aliment', localIso(date, def.hour, j)),
          date,
          meal,
          name,
          quantity,
          kcal,
          proteinG,
          carbsG,
          fatG,
        });
      });
    }
  }

  // Check-ins : 3 semaines.
  const checkIns: CheckIn[] = [];
  for (let i = 20; i >= 0; i--) {
    if (i === 0 && hour < 7) continue;
    const date = addDays(today, -i);
    const sleepHours = roundTo(6 + rand() * 2.5, 0.25);
    const rested = (sleepHours - 6) / 2.5;
    checkIns.push({
      ...sync('checkin', localIso(date, 7, 30)),
      date,
      sleepHours,
      energy: clamp5(2.5 + rested * 2 + rand()),
      fatigue: clamp5(3.5 - rested * 2 + rand()),
      soreness: clamp5(1.5 + rand() * 2.5),
    });
  }

  const profile: Profile = {
    id: 'me',
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
    firstName: DEMO_FIRST_NAME,
    gainRate: { lowPctPerWeek: 0.25, highPctPerWeek: 0.5 },
    nutritionTargets: { kcal: 3200, proteinG: 180, carbsG: 415, fatG: 90 },
  };

  const meta: MetaEntry[] = [
    {
      key: ONBOARDING_KEY,
      value: { installSkipped: true, welcomeDone: true, completedAt: stamp },
      updatedAt: stamp,
    },
    { key: 'lastBackupAt', value: stamp, updatedAt: stamp },
  ];

  // Boissons : 14 jours, aujourd'hui seulement ce qui est déjà passé.
  const waterLogs: WaterLog[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = addDays(today, -i);
    for (const [h, ml] of [
      [8, 500],
      [11, 500],
      [14, 750],
      [17, 500],
      [20, 250],
    ] as const) {
      if (i === 0 && hour < h) continue;
      if (rand() < 0.15) continue;
      waterLogs.push({ ...sync('eau', localIso(date, h)), date, ml });
    }
  }

  return {
    profile: [profile],
    weighIns,
    meta,
    foodEntries,
    exercises: [...exercises.values()],
    workoutTemplates,
    workouts,
    workoutSets,
    checkIns,
    foods: [],
    mealTemplates: [],
    waterLogs,
    programs: [program],
  };
}
