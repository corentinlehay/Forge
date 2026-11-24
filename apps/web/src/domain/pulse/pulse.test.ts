import { describe, expect, it } from 'vitest';
import type { CheckIn, FoodEntry, MoodLog, Pain, PulseDay, Scale5, WeighIn, Workout, WorkoutSet, WorkoutTemplate } from '../../db/types';
import { MIND_EXERCISE_BY_ID } from '../../data/mindExercises';
import { addDays } from '../../lib/dates';
import { buildDayIndex, type LifeData } from '../lifeIndex';
import { holdLoad } from '../progression';
import { ROUTINE_ORDER } from '../mind';
import { computeNutritionStatus } from './nutrition';
import { adjustTargets, computePulse, LIGHTEN, pulseSnapshot, sixHoursBefore, type PulseInput, type PulseResult } from './pulse';
import { personalBaseline, sleepDurationScore, type HealthDay } from './readiness';
import { DEFAULT_PULSE_SETTINGS, resolveSettings, type PulseSettings } from './settings';

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
  parts: Partial<LifeData> & { health?: HealthDay[]; goal?: string; heightCm?: number; birthDate?: string; settings?: PulseSettings; yesterday?: PulseDay | null },
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
    expect(pulseSnapshot(r)).toMatchObject({ date: D, engineVersion: 1, readiness: r.readiness.score, plannedTemplateId: 'push', nutritionKind: 'sans-objectif' });
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
