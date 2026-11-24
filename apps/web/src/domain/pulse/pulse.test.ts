import { describe, expect, it } from 'vitest';
import type { CheckIn, FoodEntry, MoodLog, Pain, PulseDay, Scale5, WeighIn, Workout, WorkoutSet, WorkoutTemplate } from '../../db/types';
import { MIND_EXERCISE_BY_ID } from '../../data/mindExercises';
import { addDays } from '../../lib/dates';
import { buildDayIndex, type LifeData } from '../lifeIndex';
import { holdLoad } from '../progression';
import { ROUTINE_ORDER } from '../mind';
import { computeNutritionStatus } from './nutrition';
import { adjustTargets, computePulse, LIGHTEN, pulseSnapshot, sixHoursBefore, type PulseInput, type PulseResult } from './pulse';
import { personalBaseline, sleepDurationScore, mergeHealth, type HealthDay } from './readiness';
import { DEFAULT_PULSE_SETTINGS, levelFor, levelRange, resolveSettings, type PulseSettings } from './settings';
import { acceptance, keptRecently, proposalOf, readinessSeries, trendAt } from './history';
import { scoreText } from './analysis';
import { checkInSummary, recoveryScore } from '../wellbeing';

/**
 * Les cinq scénarios de référence de l'audit PULSE, rejoués par le moteur.
 * Scores et seuils : exemples de conception, pas des seuils validés médicalement.
 */
const D = '2026-11-25'; // mercredi
const sync = (id: string) => ({ id, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null });
const s5 = (v: number) => v as Scale5;

const push: WorkoutTemplate = { ...sync('push'), name: 'Push A', weekdays: [3], exercises: [{ exerciseId: 'dc', sets: 3, reps: '8-10', rir: 2 }], position: 0 };
const legs: WorkoutTemplate = { ...sync('legs'), name: 'Jambes', weekdays: [3], exercises: [{ exerciseId: 'squat', sets: 4, reps: '6-8', rir: 1 }], position: 0 };
const MUSCLES: Record<string, string> = { dc: 'pectoraux', squat: 'quadriceps' };

/** Historique d'entraînement : 3 semaines à 24 séries, puis `lastWeek` séries sur les 7 derniers jours. */
function training(lastWeek: number): { workouts: Workout[]; sets: WorkoutSet[] } {
  const workouts: Workout[] = [];
  const sets: WorkoutSet[] = [];
  const add = (date: string, count: number) => {
    const id = `w${date}`;
    workouts.push({ ...sync(id), date, name: 'Push A', templateId: 'push', exerciseIds: ['dc'], startedAt: `${date}T18:00:00.000Z`, endedAt: `${date}T19:00:00.000Z` });
    for (let i = 0; i < count; i++) sets.push({ ...sync(`${id}-${i}`), workoutId: id, exerciseId: 'dc', position: i, weightKg: 80, reps: 10, rir: 2 });
  };
  for (let w = 0; w < 3; w++) for (const k of [0, 2, 4]) add(addDays(D, -28 + w * 7 + k), 8);
  add(addDays(D, -35), 8);
  const per = Math.floor(lastWeek / 3);
  [-7, -5, -3].forEach((k, i) => add(addDays(D, k), i === 2 ? lastWeek - 2 * per : per));
  return { workouts, sets };
}

/** 28 jours de montre autour de 58 ms de VFC (zone 52 à 64) et 55 de fréquence au repos. */
function watch(today: { hrv: number; rhr: number }, recent: { date: string; hrv: number; rhr: number }[] = []): HealthDay[] {
  const days: HealthDay[] = [];
  for (let i = 28; i >= 1; i--) {
    const date = addDays(D, -i);
    const r = recent.find((x) => x.date === date);
    days.push({ date, source: 'Apple Watch', hrvMs: r?.hrv ?? (i % 2 ? 52 : 64), restingHr: r?.rhr ?? (i % 2 ? 54 : 56) });
  }
  days.push({ date: D, source: 'Apple Watch', hrvMs: today.hrv, restingHr: today.rhr });
  return days;
}

const checkIn = (date: string, h: number, q: number | null, energy: number, fatigue: number, soreness: number, bedTime?: string): CheckIn => ({
  ...sync(`c${date}`),
  date,
  sleepHours: h,
  energy: s5(energy),
  fatigue: s5(fatigue),
  soreness: s5(soreness),
  sleepQuality: q ? s5(q) : null,
  bedTime: bedTime ?? null,
});
const mood = (date: string, m: number, stress: number): MoodLog => ({ ...sync(`m${date}`), date, mood: s5(m), stress: s5(stress) });
const meal = (date: string, kcal: number, proteinG: number): FoodEntry => ({ ...sync(`f${date}`), date, meal: 'lunch', name: 'Repas', kcal, proteinG, carbsG: 0, fatG: 0 });

function scenario(
  parts: Partial<LifeData> & {
    health?: HealthDay[];
    goal?: string;
    heightCm?: number;
    birthDate?: string;
    settings?: PulseSettings;
    yesterday?: PulseDay | null;
    journal?: PulseDay[];
  },
): PulseResult {
  const data: LifeData = {
    workouts: [],
    sets: [],
    templates: [],
    foodEntries: [],
    waterLogs: [],
    targets: null,
    targetChanges: [],
    weighIns: [],
    measurements: [],
    checkIns: [],
    moodLogs: [],
    mindSessions: [],
    pains: [],
    mealPlans: [],
    exerciseName: (id) => (id === 'dc' ? 'Développé couché' : 'Squat'),
    recipeName: () => 'Recette',
    ...parts,
  };
  const input: PulseInput = {
    date: D,
    index: buildDayIndex(data),
    data,
    health: parts.health ?? [],
    profile: { goal: parts.goal, heightCm: parts.heightCm, birthDate: parts.birthDate, gainRate: { lowPctPerWeek: -0.75, highPctPerWeek: -0.5 } },
    muscleOf: (id) => MUSCLES[id] ?? null,
    settings: parts.settings ?? DEFAULT_PULSE_SETTINGS,
    yesterday: parts.yesterday ?? null,
    journal: parts.journal ?? [],
  };
  return computePulse(input);
}

const scores = (r: PulseResult) => Object.fromEntries(r.readiness.components.map((c) => [c.key, c.score]));
const ruleIds = (r: PulseResult) => r.rules.map((h) => h.id);

describe('scénario 1 : bonne nuit, séance prévue', () => {
  const r = scenario({
    ...training(25),
    templates: [push],
    health: watch({ hrv: 62, rhr: 54 }),
    checkIns: [checkIn(D, 7 + 50 / 60, 4, 4, 2, 2)],
    moodLogs: [mood(D, 4, 2)],
    targets: { kcal: 2800, proteinG: 180, carbsG: 300, fatG: 80 },
    foodEntries: [1, 2, 3].map((k) => meal(addDays(D, -k), 2780, 176)),
  });

  it('donne 84, Feu vert, confiance haute, sans alerte', () => {
    expect(scores(r)).toEqual({ sommeil: 93, physiologie: 85, ressenti: 75, charge: 90, mental: 75 });
    expect(r.readiness.score).toBe(84);
    expect(r.readiness.confidence).toBe('haute');
    expect(r.mode).toBe('feu-vert');
    expect(r.rules).toEqual([]);
  });

  it('garde la séance et propose la surcharge progressive', () => {
    expect(r.training.kind).toBe('as-planned');
    expect(r.training.recos[0]?.text).toBe('Séance Push A telle quelle. Surcharge progressive : Développé couché : 82,5 kg (+2,5).');
    expect(r.nutrition.kind).toBe('coherent');
    expect(r.mindRecos.map((m) => m.id)).toEqual(['avant']);
  });
});

describe('scénario 2 : nuit courte et stress, sans montre', () => {
  const r = scenario({
    ...training(25),
    templates: [legs],
    checkIns: [checkIn(D, 5.25, 2, 2, 4, 2, '01:30')],
    moodLogs: [mood(addDays(D, -1), 3, 4)],
  });

  it('donne 45, Allégé, confiance moyenne : la physiologie manque et son poids est réparti', () => {
    expect(scores(r)).toEqual({ sommeil: 34, physiologie: null, ressenti: 42, charge: 90, mental: 38 });
    expect(r.readiness.score).toBe(45);
    expect(r.readiness.confidence).toBe('moyenne');
    expect(r.readiness.components.find((c) => c.key === 'sommeil')?.weight).toBe(40);
    expect(r.readiness.confidenceText).toBe('Sans physiologie : son poids est réparti sur les autres composantes.');
    expect(r.mode).toBe('allege');
  });

  it('propose la version allégée, la caféine avant 19 h 30, la sieste courte', () => {
    expect(r.training.kind).toBe('lighten');
    expect(r.training.actions).toEqual(['alleger', 'garder', 'deplacer']);
    expect(r.training.adjustment).toEqual(LIGHTEN);
    expect(r.nutritionRecos.find((x) => x.id === 'cafeine')?.text).toBe('Pas de caféine dans les 6 heures avant ton coucher : rien après 19 h 30 si tu te couches comme hier.');
    expect(r.recoveryRecos.map((x) => x.id)).toEqual(['coucher', 'sieste']);
    expect(r.mindRecos.map((m) => m.id)).toEqual(['coherence', 'soir']);
  });
});

describe('scénario 3 : charge élevée, VFC basse depuis 3 jours', () => {
  const recent = [
    { date: addDays(D, -2), hrv: 44, rhr: 59 },
    { date: addDays(D, -1), hrv: 43, rhr: 60 },
  ];
  const r = scenario({
    ...training(46),
    templates: [legs],
    health: watch({ hrv: 41, rhr: 61 }, recent),
    checkIns: [checkIn(D, 7 + 5 / 60, 3, 3, 4, 4)],
    moodLogs: [mood(D, 3, 3)],
  });

  it('donne 48 : le score dirait Allégé, la tendance passe à Récupération', () => {
    expect(scores(r)).toEqual({ sommeil: 85, physiologie: 23, ressenti: 33, charge: 30, mental: 50 });
    expect(r.readiness.score).toBe(48);
    expect(r.readiness.modeFromScore).toBe('allege');
    expect(ruleIds(r)).toEqual(['fatigue-installee']);
    expect(r.mode).toBe('recuperation');
  });

  it('remplace la séance et propose d’alléger les suivantes, avec ses sources', () => {
    expect(r.training.kind).toBe('replace');
    expect(r.training.recos.map((x) => x.id)).toEqual(['remplacer', 'decharge']);
    expect(r.training.recos[0]?.source).toMatch(/Kiviniemi.*Meeusen.*Impellizzeri/);
    expect(r.mindRecos.map((m) => m.id)).toContain('jacobson');
  });
});

describe('scénario 4 : genou avec gonflement', () => {
  const knee: Pain = {
    ...sync('genou'),
    zone: 'genou-d',
    startedOn: addDays(D, -2),
    resolvedOn: null,
    activities: [],
    logs: [
      { date: addDays(D, -2), intensity: 6 },
      { date: addDays(D, -1), intensity: 6, flags: ['gonflement'] },
    ],
  };
  const base = { ...training(25), health: watch({ hrv: 58, rhr: 55 }), checkIns: [checkIn(D, 7 + 40 / 60, 4, 4, 2, 2)], moodLogs: [mood(D, 3, 3)], pains: [knee] };

  it('donne 82, Feu vert par le score, mais la séance jambes est suspendue', () => {
    const r = scenario({ ...base, templates: [legs] });
    expect(r.readiness.score).toBe(82);
    expect(r.mode).toBe('feu-vert');
    expect(ruleIds(r)).toEqual(['douleur-alerte']);
    expect(r.training.kind).toBe('suspended');
    expect(r.training.recos[0]?.text).toMatch(/^Séance Jambes suspendue : elle sollicite la zone douloureuse \(genou droit\)/);
    expect(r.training.recos[0]?.reason).toMatch(/avis médical rapide/);
  });

  it('laisse une séance du haut du corps, qui ne sollicite pas le genou', () => {
    expect(scenario({ ...base, templates: [push] }).training.kind).toBe('as-planned');
  });
});

describe('scénario 5 : apport très bas en perte de poids', () => {
  const r = scenario({
    ...training(25),
    templates: [push],
    goal: 'perte',
    heightCm: 175,
    weighIns: [{ ...sync('p'), date: D, time: '07:00', weightKg: 72 } as WeighIn],
    health: watch({ hrv: 51, rhr: 58 }),
    checkIns: [checkIn(D, 6.5, 3, 2, 3, 2)],
    moodLogs: [mood(D, 2, 3)],
    targets: { kcal: 2100, proteinG: 150, carbsG: 200, fatG: 70 },
    foodEntries: [...[1, 2, 3, 4].map((k) => meal(addDays(D, -k), 1450, 95)), ...[5, 6, 7].map((k) => meal(addDays(D, -k), 2100, 150))],
  });

  it('donne 58, Normal : la nutrition ne pénalise pas le Readiness Score', () => {
    expect(scores(r)).toEqual({ sommeil: 71, physiologie: 45, ressenti: 50, charge: 90, mental: 38 });
    expect(r.readiness.score).toBe(58);
    expect(r.mode).toBe('normal');
    expect(r.training.kind).toBe('no-record');
  });

  it('signale l’apport bas dans le Nutrition Status et propose de revenir à l’objectif', () => {
    expect(r.nutrition.kind).toBe('sous');
    expect(r.nutrition.lowIntakeStreak).toBe(4);
    expect(ruleIds(r)).toEqual(['apport-bas']);
    expect(r.nutritionRecos[0]?.id).toBe('revenir');
    expect(r.nutritionRecos.map((x) => x.id)).toContain('proteines');
    expect(r.mindRecos.map((m) => m.id)).toContain('recentrage');
  });
});

describe('données manquantes, fiabilité et réglages', () => {
  it('ne calcule pas de score sans check-in, et le dit', () => {
    const r = scenario({ ...training(25), templates: [push], moodLogs: [mood(D, 4, 2)] });
    expect(r.readiness.score).toBeNull();
    expect(r.readiness.unavailable).toBe('Ton score du jour se calcule après ton check-in du matin.');
    expect(r.mode).toBeNull();
    expect(r.training.recos[0]?.text).toBe('Séance prévue : Push A.');
  });

  it('préfère le sommeil mesuré par la montre au sommeil déclaré', () => {
    const health = watch({ hrv: 58, rhr: 55 }).map((h) => (h.date === D ? { ...h, sleepHours: 6 } : h));
    const r = scenario({ health, checkIns: [checkIn(D, 8, null, 3, 3, 3)] });
    const sleep = r.readiness.components.find((c) => c.key === 'sommeil')!;
    expect(sleep).toMatchObject({ score: 60, source: 'mesure', sourceLabel: 'Apple Watch' });
  });

  it('attend 14 jours de mesures avant d’utiliser la référence personnelle', () => {
    expect(personalBaseline([{ date: addDays(D, -1), value: 50 }], D)).toBeNull();
    const short = watch({ hrv: 58, rhr: 55 }).filter((h) => h.date >= addDays(D, -5));
    const r = scenario({ health: short, checkIns: [checkIn(D, 8, null, 3, 3, 3)] });
    expect(r.readiness.components.find((c) => c.key === 'physiologie')?.missing).toBe('Il faut 14 jours de mesures pour connaître ta référence : 5 pour l’instant.');
  });

  it('demande 4 semaines de séances avant de juger la charge', () => {
    const r = scenario({ checkIns: [checkIn(D, 8, null, 3, 3, 3)] });
    expect(r.readiness.components.find((c) => c.key === 'charge')?.missing).toBe('Aucune séance notée avant aujourd’hui.');
    expect(r.readiness.confidence).toBe('basse');
  });

  it('suit les seuils et les poids réglés', () => {
    const settings = resolveSettings({ modes: { feuVert: 90, normal: 55, allege: 40 }, weights: { ...DEFAULT_PULSE_SETTINGS.weights, physiologie: 0 } });
    const r = scenario({ ...training(25), templates: [push], checkIns: [checkIn(D, 8, 4, 4, 2, 2)], moodLogs: [mood(D, 4, 2)], settings });
    expect(r.readiness.confidence).toBe('haute');
    expect(r.mode).toBe('normal');
  });

  it('remet les réglages dans leurs bornes et dans l’ordre', () => {
    const s = resolveSettings({ modes: { feuVert: 50, normal: 60, allege: 70 }, sleepTargetHours: 12, weights: { sommeil: 0, physiologie: 0, ressenti: 0, charge: 0, mental: 0 } });
    expect(s.modes.allege).toBe(70);
    expect(s.modes.normal).toBeGreaterThan(s.modes.allege);
    expect(s.modes.feuVert).toBeGreaterThan(s.modes.normal);
    expect(s.sleepTargetHours).toBe(9);
    expect(s.weights).toEqual(DEFAULT_PULSE_SETTINGS.weights);
    expect(resolveSettings(null)).toEqual(DEFAULT_PULSE_SETTINGS);
  });

  it('note la durée de sommeil par paliers', () => {
    expect([8, 7, 6.5, 6, 5, 4, 3].map((h) => Math.round(sleepDurationScore(h, 7)))).toEqual([100, 100, 80, 60, 30, 10, 10]);
  });
});

describe('règles de sécurité', () => {
  it('ne propose rien avant 18 ans', () => {
    const r = scenario({ templates: [push], birthDate: '2010-01-01', checkIns: [checkIn(D, 8, null, 4, 2, 2)] });
    expect(ruleIds(r)).toEqual(['mineur']);
    expect(r.training.kind).toBe('blocked');
    expect(r.nutritionRecos).toEqual([]);
  });

  it('arrête tout entraînement en cas de douleur dans la poitrine', () => {
    const chest: Pain = { ...sync('p'), zone: 'poitrine', startedOn: D, resolvedOn: null, activities: [], logs: [{ date: D, intensity: 3 }] };
    const r = scenario({ templates: [push], pains: [chest], checkIns: [checkIn(D, 8, null, 4, 2, 2)] });
    expect(r.training.kind).toBe('rest');
    expect(r.mode).toBe('recuperation');
    expect(r.training.recos[0]?.reason).toMatch(/appelle le 15/);
  });

  it('plafonne à Allégé après une nuit de moins de 5 h', () => {
    const r = scenario({ templates: [push], checkIns: [checkIn(D, 4.5, null, 5, 1, 1)], moodLogs: [mood(D, 5, 1)] });
    expect(r.readiness.modeFromScore).toBe('normal');
    expect(r.mode).toBe('allege');
    expect(r.training.recos[0]?.reason).toMatch(/^Nuit de moins de 5 h : Pas de séance intense/);
    expect(r.training.actions).toEqual(['alleger', 'garder', 'deplacer']);
  });

  it('rappelle le 3114 quand le moral est au plus bas', () => {
    const r = scenario({ checkIns: [checkIn(D, 8, null, 3, 3, 3)], moodLogs: [mood(D, 1, 5)] });
    expect(r.mindRecos[0]?.text).toMatch(/3114/);
  });

  it('ne propose aucun déficit si le poids est déjà bas', () => {
    const r = scenario({
      goal: 'perte',
      heightCm: 180,
      weighIns: [{ ...sync('w'), date: D, time: '07:00', weightKg: 58 } as WeighIn],
      targets: { kcal: 2000, proteinG: 120, carbsG: 200, fatG: 70 },
      checkIns: [checkIn(D, 8, null, 3, 3, 3)],
    });
    expect(ruleIds(r)).toEqual(['poids-bas']);
    expect(r.nutritionRecos[0]?.id).toBe('pas-deficit');
  });
});

describe('séance allégée, déplacée et journal', () => {
  it('allège les objectifs sans descendre sous une série', () => {
    expect(
      adjustTargets(
        [
          { exerciseId: 'a', sets: 3, reps: '8', rir: 1 },
          { exerciseId: 'b', sets: 1, reps: '10', rir: null },
        ],
        LIGHTEN,
      ),
    ).toEqual([
      { exerciseId: 'a', sets: 2, reps: '8', rir: 3 },
      { exerciseId: 'b', sets: 1, reps: '10', rir: 3 },
    ]);
    expect(adjustTargets([{ exerciseId: 'a', sets: 3, reps: '8' }], null)).toEqual([{ exerciseId: 'a', sets: 3, reps: '8' }]);
  });

  it('reprend aujourd’hui la séance déplacée hier', () => {
    const yesterday: PulseDay = {
      ...sync('y'),
      date: addDays(D, -1),
      engineVersion: 1,
      readiness: 45,
      confidence: 'moyenne',
      mode: 'allege',
      components: [],
      nutritionKind: 'incomplet',
      nutritionScore: null,
      rules: [],
      plannedTemplateId: 'legs',
      choice: 'deplacer',
      choiceAt: 'x',
    };
    const r = scenario({ templates: [push, legs], yesterday, checkIns: [checkIn(D, 8, 4, 4, 2, 2)], moodLogs: [mood(D, 4, 2)] });
    expect(r.training.template?.id).toBe('legs');
    expect(r.training.moved).toBe(true);
  });

  it('résume le jour pour le journal PULSE', () => {
    const r = scenario({ templates: [push], checkIns: [checkIn(D, 8, null, 4, 2, 2)] });
    expect(pulseSnapshot(r)).toMatchObject({
      date: D,
      engineVersion: 2,
      readiness: r.readiness.score,
      plannedTemplateId: 'push',
      nutritionKind: 'sans-objectif',
      level: r.level,
      coverage: 2,
      trainingKind: 'as-planned',
    });
  });

  it('calcule l’heure limite de la caféine autour de minuit', () => {
    expect(sixHoursBefore('23:30')).toBe('17:30');
    expect(sixHoursBefore('01:30')).toBe('19:30');
  });

  it('ne recommande que des exercices et routines Mind qui existent', () => {
    const all = [
      scenario({ checkIns: [checkIn(D, 4.5, null, 2, 4, 4)], moodLogs: [mood(D, 2, 5)], templates: [push] }),
      scenario({
        ...training(46),
        health: watch({ hrv: 41, rhr: 61 }, [
          { date: addDays(D, -2), hrv: 44, rhr: 59 },
          { date: addDays(D, -1), hrv: 43, rhr: 60 },
        ]),
        checkIns: [checkIn(D, 7, 3, 3, 4, 4)],
        templates: [legs],
      }),
    ].flatMap((r) => r.mindRecos);
    for (const reco of all.filter((x) => x.to)) {
      const [, , kind, id] = reco.to!.split('/');
      if (kind === 'exercice') expect(MIND_EXERCISE_BY_ID.has(id!)).toBe(true);
      else expect(ROUTINE_ORDER).toContain(id);
    }
  });
});

describe('Nutrition Status', () => {
  it('juge sur les 3 derniers jours notés, sans compter aujourd’hui', () => {
    const data = { targets: { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 70 }, targetChanges: [] };
    const empty = { workouts: [], sets: [], templates: [], waterLogs: [], weighIns: [], measurements: [], checkIns: [], moodLogs: [], mindSessions: [], pains: [], mealPlans: [] };
    const index = buildDayIndex({
      ...empty,
      ...data,
      foodEntries: [meal(D, 300, 10), meal(addDays(D, -1), 2100, 150), meal(addDays(D, -2), 1950, 140)],
      exerciseName: () => '',
      recipeName: () => '',
    });
    const s = computeNutritionStatus({ date: D, index, data, weighIns: [], gainRate: { lowPctPerWeek: 0, highPctPerWeek: 0 }, settings: DEFAULT_PULSE_SETTINGS });
    expect(s.kind).toBe('coherent');
    expect(s.avgKcal).toBe(2025);
    expect(s.score).toBe(Math.round(0.4 * (100 - 1.25 * 2.5) + 0.4 * ((145 / 150) * 100) + 0.2 * ((2 / 7) * 100)));
  });
});

describe('séance allégée en direct', () => {
  it('garde la charge au lieu de l’augmenter', () => {
    expect(holdLoad({ weightKg: 82.5, reps: 8, reason: 'x' }, 80)).toEqual({
      weightKg: 80,
      reps: 8,
      reason: 'Séance allégée : garde 80 kg et vise 8 répétitions, sans chercher de record.',
    });
    expect(holdLoad({ weightKg: 80, reps: 9, reason: 'x' }, 80)?.reason).toBe('x');
    expect(holdLoad(null, 80)).toBeNull();
  });
});

/* ---------- PULSE 1.1 ---------- */

const kinds = (r: PulseResult) => r.analysis.items.map((i) => i.kind);
const itemsOf = (r: PulseResult, kind: string) => r.analysis.items.filter((i) => i.kind === kind).map((i) => i.text);

describe('niveaux de lecture du score', () => {
  it('lit les scores des cinq scénarios de référence avec les niveaux du cahier', () => {
    expect([84, 45, 48, 82, 58].map((v) => levelFor(v, DEFAULT_PULSE_SETTINGS))).toEqual(['elevee', 'moderee', 'moderee', 'elevee', 'moderee']);
    expect([0, 39, 40, 59, 60, 79, 80, 100].map((v) => levelFor(v, DEFAULT_PULSE_SETTINGS))).toEqual([
      'basse',
      'basse',
      'moderee',
      'moderee',
      'satisfaisante',
      'satisfaisante',
      'elevee',
      'elevee',
    ]);
    expect(levelRange('moderee', DEFAULT_PULSE_SETTINGS)).toEqual([40, 59]);
  });

  it('suit des seuils réglés, remis dans l’ordre', () => {
    const s = resolveSettings({ levels: { moderee: 50, satisfaisante: 45, elevee: 40 } });
    expect(s.levels.moderee).toBe(50);
    expect(s.levels.satisfaisante).toBeGreaterThan(50);
    expect(s.levels.elevee).toBeGreaterThan(s.levels.satisfaisante);
    expect(levelFor(52, s)).toBe('moderee');
  });

  it('n’affiche pas une précision artificielle quand la confiance est basse', () => {
    expect(scoreText(72, 'haute')).toBe('72');
    expect(scoreText(72, 'basse')).toBe('≈ 70');
    expect(scoreText(73, 'basse')).toBe('≈ 75');
  });

  it('affiche la couverture et le niveau du jour', () => {
    const r = scenario({ ...training(25), templates: [push], checkIns: [checkIn(D, 8, null, 4, 2, 2)], moodLogs: [mood(D, 4, 2)] });
    expect(r.readiness.coverage).toEqual({ present: 4, total: 5 });
    expect(r.level).toBe(levelFor(r.readiness.score!, DEFAULT_PULSE_SETTINGS));
  });
});

describe('check-in passable', () => {
  it('calcule la récupération et le ressenti avec les seules réponses données', () => {
    expect(recoveryScore({ sleepHours: null, energy: s5(5), fatigue: null, soreness: null })).toBe(100);
    expect(recoveryScore({ sleepHours: null, energy: null, fatigue: null, soreness: null })).toBeNull();
    expect(checkInSummary({ sleepHours: 7.5, energy: null, fatigue: s5(2), soreness: null })).toBe('7 h 30, fatigue 2/5');
    const r = scenario({ checkIns: [{ ...checkIn(D, 8, null, 4, 2, 2), sleepHours: null, fatigue: null, soreness: null }] });
    const feeling = r.readiness.components.find((c) => c.key === 'ressenti')!;
    expect(feeling.score).toBe(75);
    expect(feeling.lines[0]).toBe('Énergie 4/5.');
  });
});

describe('les 7 cas de test du cahier PULSE', () => {
  it('1. mal dormi, sans fatigue musculaire : la nuit pèse, sans inventer de fatigue', () => {
    const r = scenario({ ...training(25), templates: [push], checkIns: [checkIn(D, 4.5, 2, 3, 2, 1)] });
    expect(ruleIds(r)).toContain('nuit-courte');
    expect(r.mode).toBe('allege');
    expect(r.training.actions).toContain('garder');
    expect(r.training.kind).toBe('lighten');
    expect(r.training.recos[0]?.reason).toMatch(
      /^Ton indicateur est à \d+, sous 55 : PULSE propose une version allégée\. C’est une proposition, tu peux garder la séance prévue\.$/,
    );
    expect(r.analysis.factors[0]).toMatchObject({ key: 'sommeil', direction: 'defavorable' });
    expect(itemsOf(r, 'hypothese').join(' ')).not.toMatch(/fatigue ressentie/);
    expect(r.recoveryRecos.map((x) => x.id)).toContain('sieste');
  });

  it('2. très stressé mais physiquement disponible : la séance reste, Mind aide', () => {
    const r = scenario({ ...training(25), templates: [push], checkIns: [checkIn(D, 8, 4, 5, 1, 1)], moodLogs: [mood(D, 2, 5)] });
    expect(r.readiness.components.find((c) => c.key === 'mental')?.score).toBe(13);
    expect(r.level).not.toBe('basse');
    expect(['as-planned', 'no-record']).toContain(r.training.kind);
    expect(r.mindRecos.map((m) => m.id)).toContain('coherence');
    expect(itemsOf(r, 'hypothese')).toContain('Le corps semble disponible : c’est surtout la charge mentale qui pèse aujourd’hui.');
    expect(r.analysis.factors.some((f) => f.key === 'mental' && f.direction === 'defavorable')).toBe(true);
  });

  it('3. sommeil manquant : score sur les autres dimensions, couverture et manque affichés', () => {
    const r = scenario({ ...training(25), templates: [push], checkIns: [{ ...checkIn(D, 8, null, 4, 2, 2), sleepHours: null }], moodLogs: [mood(D, 4, 2)] });
    expect(r.readiness.components.find((c) => c.key === 'sommeil')?.score).toBeNull();
    expect(r.readiness.components.find((c) => c.key === 'sommeil')?.missing).toBe('Durée de la nuit passée dans le check-in.');
    expect(r.readiness.score).not.toBeNull();
    expect(r.readiness.coverage).toEqual({ present: 3, total: 5 });
    expect(itemsOf(r, 'manquant').some((t) => t.startsWith('Sommeil'))).toBe(true);
    expect(ruleIds(r)).not.toContain('nuit-courte');
    expect(r.recoveryRecos.map((x) => x.id)).not.toContain('sieste');
    expect(r.nutritionRecos.map((x) => x.id)).not.toContain('cafeine');
  });

  it('4. séances rapprochées : la charge monte, la récupération active est proposée, sans rien imposer', () => {
    const tired = [0, 1, 2].map((k) => checkIn(addDays(D, -k), 7.5, null, 2, 4, 4));
    const r = scenario({ ...training(46), templates: [push], checkIns: tired });
    expect(r.readiness.components.find((c) => c.key === 'charge')?.score).toBe(30);
    expect(ruleIds(r)).toContain('fatigue-installee');
    expect(r.training.kind).toBe('replace');
    expect(r.training.actions).toEqual(['remplacer', 'garder', 'deplacer']);
    expect(itemsOf(r, 'hypothese')).toContain('La hausse de ta charge sur 7 jours peut peser sur ton ressenti physique.');
  });

  it('5. douleur inhabituelle déclarée : prudence sans deviner la zone, puis adaptation une fois située', () => {
    const c = { ...checkIn(D, 8, 4, 4, 2, 2), unusualPain: true };
    const r = scenario({ ...training(25), templates: [push], checkIns: [c], moodLogs: [mood(D, 4, 2)] });
    expect(r.mode).toBe('allege');
    expect(ruleIds(r)).toContain('douleur-signalee');
    expect(r.training.recos[0]?.reason).toMatch(/^Douleur inhabituelle signalée/);
    expect(r.training.recos.map((x) => x.text).join(' ')).not.toMatch(/genou|épaule|dos/);
    const located: Pain = { ...sync('p'), zone: 'epaule-d', startedOn: D, resolvedOn: null, activities: [], logs: [{ date: D, intensity: 3 }] };
    expect(ruleIds(scenario({ ...training(25), templates: [push], checkIns: [c], pains: [located] }))).not.toContain('douleur-signalee');
  });

  it('6. propositions refusées plusieurs fois : le score ne change pas, le choix reste, un réglage est suggéré', () => {
    const base = { ...training(25), templates: [legs], checkIns: [checkIn(D, 5.25, 2, 2, 4, 2, '01:30')], moodLogs: [mood(addDays(D, -1), 3, 4)] };
    const day = (k: number, choice: PulseDay['choice']): PulseDay => ({
      ...sync(`j${k}`),
      date: addDays(D, -k),
      engineVersion: 2,
      readiness: 45,
      confidence: 'moyenne',
      mode: 'allege',
      components: [],
      nutritionKind: 'sans-objectif',
      nutritionScore: null,
      rules: [],
      plannedTemplateId: 'legs',
      trainingKind: 'lighten',
      choice,
    });
    const journal = [day(1, 'garder'), day(2, 'garder'), day(4, 'garder'), day(5, 'alleger')];
    const without = scenario(base);
    const r = scenario({ ...base, journal });
    expect(r.readiness.score).toBe(without.readiness.score);
    expect(r.mode).toBe(without.mode);
    expect(r.training.actions).toContain('garder');
    expect(r.training.recos.find((x) => x.id === 'garde-souvent')?.to).toBe('/pulse/reglages');
    expect(keptRecently(journal, D)).toBe(3);
    expect(acceptance(journal, addDays(D, -7), addDays(D, -1))).toEqual({ proposals: 4, accepted: 1, kept: 3, unanswered: 0, rate: 0.25 });
    expect(without.training.recos.find((x) => x.id === 'garde-souvent')).toBeUndefined();
  });

  it('7. deux appareils qui se contredisent : une seule valeur, l’écart signalé, la confiance baisse', () => {
    const health = [...watch({ hrv: 58, rhr: 55 }).map((h) => (h.date === D ? { ...h, sleepHours: 7.5 } : h)), { date: D, source: 'Bague', sleepHours: 5 }];
    const merged = mergeHealth(health);
    expect(merged.days.filter((h) => h.date === D)).toHaveLength(1);
    expect(merged.conflicts).toEqual([{ date: D, metric: 'sleepHours', kept: { source: 'Apple Watch', value: 7.5 }, other: { source: 'Bague', value: 5 } }]);
    const agree = scenario({ ...training(25), health: health.slice(0, -1), checkIns: [checkIn(D, 7.5, null, 4, 2, 2)], moodLogs: [mood(D, 4, 2)] });
    const r = scenario({ ...training(25), health, checkIns: [checkIn(D, 7.5, null, 4, 2, 2)], moodLogs: [mood(D, 4, 2)] });
    expect(r.readiness.components.find((c) => c.key === 'sommeil')).toMatchObject({ score: 100, sourceLabel: 'Apple Watch' });
    expect(agree.readiness.confidence).toBe('haute');
    expect(r.readiness.confidence).toBe('moyenne');
    expect(itemsOf(r, 'observe').some((t) => t.startsWith('Deux sources ne concordent pas sur le sommeil'))).toBe(true);
  });
});

describe('évolution et analyse du jour', () => {
  const history = Array.from({ length: 10 }, (_, i) => checkIn(addDays(D, -(i + 1)), 8, 4, 4, 2, 2));
  const r = scenario({ ...training(25), templates: [push], checkIns: [...history, checkIn(D, 5.5, 2, 2, 4, 3)], moodLogs: [mood(D, 3, 3)] });

  it('compare à hier et à la moyenne des 7 et 30 jours, le jour exclu', () => {
    expect(r.trend.yesterday).not.toBeNull();
    expect(r.trend.mean7).toBe(r.trend.yesterday);
    expect(r.trend.vs7).toBeLessThan(-5);
    expect(r.trend.direction).toBe('baisse');
    expect(r.trend.mean30).toBe(r.trend.mean7);
  });

  it('explique la baisse par ses principaux éléments et sépare les natures d’information', () => {
    expect(r.analysis.headline).toBe(
      'Ton indicateur de disponibilité est en baisse par rapport à ta moyenne des 7 derniers jours. Les principaux éléments : un sommeil plus court ou moins bon et un ressenti physique moins bon (énergie, fatigue ou courbatures).',
    );
    expect(r.analysis.factors.map((f) => f.key)).toEqual(['sommeil', 'ressenti']);
    expect(r.analysis.factors[0]?.text).toMatch(/^Sommeil \d+\/100, \d+ points sous ta moyenne des 7 derniers jours \(nuit de 5 h 30, qualité 2\/5\)\.$/);
    expect(new Set(kinds(r))).toEqual(new Set(['observe', 'declare', 'estime', 'hypothese', 'manquant']));
    expect(itemsOf(r, 'declare')[0]).toBe('Noté dans ton check-in du matin : nuit de 5 h 30, qualité 2/5, énergie 2/5, fatigue 4/5, courbatures 3/5.');
  });

  it('attend 3 jours de scores avant de comparer', () => {
    const fresh = scenario({ templates: [push], checkIns: [checkIn(D, 8, null, 4, 2, 2)] });
    expect(fresh.trend.direction).toBeNull();
    expect(fresh.analysis.headline).toBe('Pas encore assez de jours pour comparer à ta moyenne. Ce qui compte le plus aujourd’hui : un bon sommeil.');
  });

  it('recalcule la série passée sans données inventées', () => {
    const data = { ...training(25), checkIns: history } as unknown as LifeData;
    const full: LifeData = {
      ...data,
      templates: [],
      foodEntries: [],
      waterLogs: [],
      targets: null,
      targetChanges: [],
      weighIns: [],
      measurements: [],
      moodLogs: [],
      mindSessions: [],
      pains: [],
      mealPlans: [],
      exerciseName: () => '',
      recipeName: () => '',
    };
    const series = readinessSeries({ index: buildDayIndex(full), health: [], settings: DEFAULT_PULSE_SETTINGS }, addDays(D, -12), addDays(D, -1));
    expect(series).toHaveLength(12);
    expect(series.slice(0, 2).every((p) => p.score === null)).toBe(true);
    expect(series.slice(2).every((p) => p.score !== null && p.sleepHours === 8)).toBe(true);
    expect(trendAt(series, D, 50).vs7).toBe(50 - Math.round(series.at(-1)!.score!));
  });

  it('déduit la proposition des anciennes lignes du journal', () => {
    const old = { date: D, mode: 'allege', plannedTemplateId: 'push' } as PulseDay;
    expect(proposalOf(old)).toBe('lighten');
    expect(proposalOf({ ...old, mode: 'recuperation' })).toBe('replace');
    expect(proposalOf({ ...old, plannedTemplateId: null })).toBeNull();
    expect(proposalOf({ ...old, trainingKind: 'as-planned' })).toBe('as-planned');
  });
});
