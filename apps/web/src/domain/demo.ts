import type {
  CheckIn,
  Measurement,
  MindSession,
  MoodLog,
  Pain,
  Exercise,
  Food,
  PriceRecord,
  FoodEntry,
  MealSlot,
  MealTemplate,
  MetaEntry,
  Profile,
  Program,
  Scale5,
  WaterLog,
  WeekNote,
  PulseDay,
  WeighIn,
  Workout,
  WorkoutSet,
  WorkoutTemplate,
} from '../db/types';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { addDays } from '../lib/dates';
import { ONBOARDING_KEY } from './onboarding';
import { BUDGET_KEY } from './budget';
import { DEFAULT_ROUTINES, routineSeconds } from './mind';
import { isoWeekday, weekStart } from './training';

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

/**
 * Prix fictifs de la démo : grammes de la portion, prix payé, quantité achetée, unité.
 * Les plats cuits (riz, pâtes) et les mélanges restent sans prix : la couverture du budget n'est pas totale, comme dans la vraie vie.
 */
const DEMO_PRICES: Record<string, [grams: number, amountEur: number, quantity: number, unit: 'g' | 'ml']> = {
  Banane: [120, 1.99, 1000, 'g'],
  'Blanc de poulet': [200, 11.9, 1000, 'g'],
  'Huile d’olive': [15, 8.5, 1000, 'ml'],
  'Haricots verts': [200, 2.4, 1000, 'g'],
  'Skyr nature': [300, 2.05, 500, 'g'],
  Amandes: [30, 3.49, 200, 'g'],
  'Bœuf haché 5 %': [200, 4.6, 400, 'g'],
  'Sauce tomate': [150, 1.1, 500, 'g'],
};
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
  recipes: [];
  recipePhotos: [];
  mealPlans: [];
  shoppingLists: [];
  prices: PriceRecord[];
  targetChanges: [];
  moodLogs: MoodLog[];
  mindSessions: MindSession[];
  audioStates: [];
  measurements: Measurement[];
  pains: Pain[];
  weekNotes: WeekNote[];
  pulseDays: PulseDay[];
}

function localIso(dateKey: string, hour: number, minute = 0): string {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour, minute).toISOString();
}

const clamp5 = (v: number): Scale5 => Math.min(5, Math.max(1, Math.round(v))) as Scale5;
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

export function generateDemoData(today: string, now: Date): DemoTables {
  const rand = mulberry32(20261123);
  const mrand = mulberry32(20261124);
  /** Détails de la nuit cohérents avec la durée : réveil vers 7 h, endormissement de 15 à 30 min. */
  const nightDetails = (sleepHours: number, rested: number) => {
    const wake = 6 * 60 + 45 + Math.round(mrand() * 3) * 15;
    const bed = wake - Math.round(sleepHours * 60) - 15 - Math.round(mrand()) * 15;
    const hhmm = (m: number) => `${String(Math.floor(((m + 1440) % 1440) / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;
    return { bedTime: hhmm(bed), wakeTime: hhmm(wake), awakenings: Math.round(mrand() * 2.2 * (1 - rested)), sleepQuality: clamp5(2 + rested * 2.5 + mrand() * 0.8) };
  };
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
    // Prise régulière pendant 8 semaines, puis plateau sur les 4 dernières : l'analyse des objectifs propose un ajustement.
    const base = k <= 55 ? 0.0428 * k : 0.0428 * 55 + 0.006 * (k - 55);
    const w = 86.4 + base + 0.32 * Math.sin(1.7 * k) + 0.18 * Math.sin(0.37 * k + 1) + 0.12 * Math.sin(3.1 * k + 2);
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

  // Aliments et prix de la démo (pour l'écran Budget).
  const foods = new Map<string, Food>();
  const prices: PriceRecord[] = [];
  for (const def of Object.values(MEALS)) {
    for (const [name, , kcal, proteinG, carbsG, fatG] of def.foods) {
      const price = DEMO_PRICES[name];
      if (!price) continue;
      const [grams, amountEur, quantity, unit] = price;
      const per = (v: number) => Math.round((v * 1000) / grams) / 10;
      const food: Food = {
        ...sync('aliment-base'),
        source: 'custom',
        name,
        unit,
        per100: { kcal: per(kcal), proteinG: per(proteinG), carbsG: per(carbsG), fatG: per(fatG), fiberG: null },
        favorite: false,
        useCount: 24,
        lastUsedAt: stamp,
      };
      foods.set(name, food);
      prices.push({ ...sync('prix'), key: `perso:${food.id}`, name, amountEur, quantity, unit });
    }
  }

  // Journal alimentaire : 4 semaines ; aujourd'hui, seulement les repas déjà passés.
  const foodEntries: FoodEntry[] = [];
  for (let i = 27; i >= 0; i--) {
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
          ...(foods.has(name) ? { foodId: foods.get(name)!.id, grams: DEMO_PRICES[name]![0] } : {}),
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
      ...nightDetails(sleepHours, rested),
    });
  }

  // Mensurations toutes les deux semaines sur 12 semaines (prise de masse : bras et cuisse montent, taille presque stable).
  const measurements: Measurement[] = [];
  for (let k = 0; k <= 6; k++) {
    const date = addDays(today, -84 + k * 14);
    measurements.push({
      ...sync('mesure', localIso(date, 7, 30)),
      date,
      waistCm: Math.round((84 + k * 0.25 + (k % 2) * 0.3) * 10) / 10,
      chestCm: Math.round((102 + k * 0.5) * 10) / 10,
      armCm: Math.round((36 + k * 0.3) * 10) / 10,
      thighCm: Math.round((58 + k * 0.4) * 10) / 10,
      ...(k === 0 ? { note: 'Première mesure, ruban souple, le matin à jeun.' } : {}),
    });
  }

  // Douleurs : une passée au genou, une en cours au bas du dos qui s'améliore.
  const pains: Pain[] = [
    {
      ...sync('douleur-genou', localIso(addDays(today, -40), 20, 0)),
      zone: 'genou-g',
      startedOn: addDays(today, -40),
      resolvedOn: addDays(today, -29),
      activities: ['Course'],
      note: 'Après une sortie longue.',
      logs: [
        { date: addDays(today, -40), intensity: 5 },
        { date: addDays(today, -37), intensity: 4 },
        { date: addDays(today, -33), intensity: 2 },
        { date: addDays(today, -29), intensity: 0 },
      ],
    },
    {
      ...sync('douleur-dos', localIso(addDays(today, -5), 19, 0)),
      zone: 'bas-dos',
      startedOn: addDays(today, -5),
      resolvedOn: null,
      activities: ['Musculation', 'Travail assis'],
      note: 'Gêne apparue après le soulevé de terre.',
      logs: [
        { date: addDays(today, -5), intensity: 5 },
        { date: addDays(today, -4), intensity: 4 },
        { date: addDays(today, -2), intensity: 3 },
        { date: addDays(today, -1), intensity: 2 },
      ],
    },
  ];

  // Bilans : un regard noté sur la semaine dernière, dont l'intention s'affiche dans la semaine en cours.
  const lastWeek = addDays(weekStart(today), -7);
  const weekNotes: WeekNote[] = [
    {
      ...sync('semaine', localIso(addDays(lastWeek, 6), 20, 0)),
      weekStart: lastWeek,
      wentWell: 'Les quatre séances faites, et les records au développé couché.',
      toAdjust: 'Coucher trop tard en semaine, le stress du travail remonte le soir.',
      intention: 'Éteindre les écrans à 22 h 30 et faire la cohérence cardiaque avant de dormir.',
    },
  ];

  // FORGE MIND : journal émotionnel et pratiques sur 3 semaines (générateur séparé : le reste de la démo ne bouge pas).
  const trainingDays = new Set(workouts.map((w) => w.date));
  const moodLogs: MoodLog[] = [];
  const mindSessions: MindSession[] = [];
  for (let i = 20; i >= 0; i--) {
    const date = addDays(today, -i);
    const night = checkIns.find((c) => c.date === date);
    const rested = night ? (night.sleepHours - 6) / 2.5 : 0.5;
    const weekday = isoWeekday(date);
    if (!(i === 0 && hour < 8) && mrand() < 0.75) {
      const stress = clamp5(2.2 + (weekday <= 5 ? 0.8 : -0.4) + mrand() * 1.6 - rested);
      const mood = clamp5(2.6 + rested * 1.6 + mrand() * 1.2 - (stress - 3) * 0.3);
      const emotions = mood >= 4 ? ['calme', mrand() < 0.5 ? 'fierte' : 'enthousiasme'] : stress >= 4 ? ['anxiete', ...(mrand() < 0.5 ? ['irritabilite'] : [])] : ['calme'];
      moodLogs.push({
        ...sync('humeur', localIso(date, 21, 30)),
        date,
        mood,
        stress,
        mentalEnergy: clamp5(2.4 + rested * 1.8 + mrand()),
        motivation: clamp5(trainingDays.has(date) ? 3.6 + mrand() : 2.8 + mrand() * 1.4),
        mentalLoad: clamp5(stress - 0.5 + mrand()),
        recovery: night ? clamp5(1.5 + rested * 2.5 + mrand()) : null,
        emotions,
        ...(i === 3 ? { note: 'Grosse journée au travail, la séance m’a fait du bien.' } : i === 9 ? { note: 'Nuit courte, j’ai décalé ma séance.' } : {}),
      });
    }
    const practice = (time: string, kind: MindSession['kind'], ref: string, title: string, durationSec: number, tension?: [Scale5, Scale5]) =>
      mindSessions.push({
        ...sync('mind', localIso(date, Number(time.slice(0, 2)), Number(time.slice(3)))),
        date,
        time,
        kind,
        ref,
        title,
        durationSec,
        completed: true,
        ...(tension ? { tensionBefore: tension[0], tensionAfter: tension[1] } : {}),
      });
    if (i === 0) continue;
    if (trainingDays.has(date) && mrand() < 0.6) practice('17:50', 'routine', 'avant', DEFAULT_ROUTINES.avant.title, routineSeconds(DEFAULT_ROUTINES.avant));
    if (trainingDays.has(date) && mrand() < 0.4) practice('19:15', 'routine', 'apres', DEFAULT_ROUTINES.apres.title, routineSeconds(DEFAULT_ROUTINES.apres), [3, 2]);
    if (weekday <= 5 && mrand() < 0.35) practice('12:40', 'exercise', 'coherence', 'Cohérence cardiaque', 300, [clamp5(3 + mrand() * 2), 2]);
    if (mrand() < 0.3) practice('22:40', 'routine', 'soir', DEFAULT_ROUTINES.soir.title, routineSeconds(DEFAULT_ROUTINES.soir));
  }

  const profile: Profile = {
    id: 'me',
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
    firstName: DEMO_FIRST_NAME,
    gainRate: { lowPctPerWeek: 0.25, highPctPerWeek: 0.5 },
    nutritionTargets: { kcal: 3000, proteinG: 180, carbsG: 368, fatG: 90 },
  };

  const meta: MetaEntry[] = [
    {
      key: ONBOARDING_KEY,
      value: { installSkipped: true, welcomeDone: true, completedAt: stamp },
      updatedAt: stamp,
    },
    { key: 'lastBackupAt', value: stamp, updatedAt: stamp },
    { key: BUDGET_KEY, value: { dailyEur: 12, weeklyEur: 80 }, updatedAt: stamp },
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
    foods: [...foods.values()],
    mealTemplates: [],
    waterLogs,
    programs: [program],
    recipes: [],
    recipePhotos: [],
    mealPlans: [],
    shoppingLists: [],
    prices,
    targetChanges: [],
    moodLogs,
    mindSessions,
    audioStates: [],
    measurements,
    pains,
    weekNotes,
    pulseDays: [],
  };
}
