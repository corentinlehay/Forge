import { describe, expect, it } from 'vitest';
import { libraryExercise } from '../data/exerciseLibrary';
import { TRAITS } from '../data/exerciseTraits';
import { activityFactor, ageOn, backToBack, bmrMifflin, estimateMinutes, nutritionPlan, trainingPlan, upperLowerDays, ZONE_EXCLUSIONS, type PlanAnswers } from './plan';

const base: PlanAnswers = {
  goal: 'muscle',
  sex: 'male',
  birthDate: '1991-05-10',
  heightCm: 180,
  weightKg: 80,
  activity: 'assis',
  experience: 'intermediate',
  returning: false,
  weekdays: [1, 2, 4, 5],
  sessionMinutes: 60,
  place: 'salle',
  equipment: [],
  zones: [],
};
const today = '2026-11-23';

describe('besoins nutritionnels', () => {
  it('calcule le métabolisme de base (Mifflin-St Jeor) et l’âge', () => {
    expect(ageOn('1991-05-10', today)).toBe(35);
    expect(ageOn('1991-12-10', today)).toBe(34);
    expect(bmrMifflin('male', 80, 180, 35)).toBe(1755);
    expect(bmrMifflin('female', 60, 165, 30)).toBe(1320.25);
    expect(activityFactor('assis', 4, 60)).toBe(1.45);
  });

  it('prise de muscle : +10 % et 0,25 à 0,5 % par semaine', () => {
    const r = nutritionPlan(base, today);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.maintenanceKcal).toBe(2540);
    expect(r.plan.targets.kcal).toBe(2790);
    expect(r.plan.gainRate).toEqual({ lowPctPerWeek: 0.25, highPctPerWeek: 0.5 });
    expect(r.plan.targets.proteinG).toBe(145);
    const { kcal, proteinG, carbsG, fatG } = r.plan.targets;
    expect(Math.abs(proteinG * 4 + carbsG * 4 + fatG * 9 - kcal)).toBeLessThan(40);
  });

  it('perte de gras : −20 %, 0,5 à 1 % par semaine, jamais sous le métabolisme de base', () => {
    const r = nutritionPlan({ ...base, goal: 'perte', weightKg: 95 }, today);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.gainRate).toEqual({ lowPctPerWeek: -1, highPctPerWeek: -0.5 });
    expect(r.plan.targets.kcal).toBeLessThan(r.plan.maintenanceKcal);
    expect(r.plan.targets.kcal).toBeGreaterThanOrEqual(r.plan.bmrKcal - 10);
  });

  it('pas de déficit avec un poids déjà bas, et protéines plafonnées en cas de surpoids', () => {
    const low = nutritionPlan({ ...base, goal: 'perte', weightKg: 62 }, today);
    if (!low.ok) throw new Error(low.reason);
    expect(low.plan.goal).toBe('recompo');
    expect(low.plan.targets.kcal).toBe(low.plan.maintenanceKcal);
    const heavy = nutritionPlan({ ...base, weightKg: 130 }, today);
    if (!heavy.ok) throw new Error(heavy.reason);
    expect(heavy.plan.targets.proteinG).toBeLessThan(130 * 1.8);
  });

  it('refuse un plan pour un mineur', () => {
    const r = nutritionPlan({ ...base, birthDate: '2010-01-01' }, today);
    expect(r.ok).toBe(false);
  });
});

describe('programme d’entraînement', () => {
  const ids = (p: ReturnType<typeof trainingPlan>) => p.sessions.flatMap((s) => s.exercises.map((e) => e.libraryId));

  it('choisit la répartition selon le nombre de jours et place les séances sur les jours choisis', () => {
    expect(trainingPlan({ ...base, weekdays: [1, 3, 5] }).sessions.map((s) => [s.name, s.weekday])).toEqual([
      ['Corps entier A', 1],
      ['Corps entier B', 3],
      ['Corps entier C', 5],
    ]);
    expect(trainingPlan(base).sessions.map((s) => s.name)).toEqual(['Haut du corps A', 'Bas du corps A', 'Haut du corps B', 'Bas du corps B']);
    expect(trainingPlan({ ...base, weekdays: [1, 2, 3, 5, 6] }).sessions).toHaveLength(5);
    expect(trainingPlan({ ...base, weekdays: [1, 2, 3, 4, 5, 6] }).sessions[3]!.name).toBe('Poussée B');
  });

  it('adapte le nombre d’exercices à la durée, sans doublon dans une séance', () => {
    for (const minutes of [45, 60, 75, 90] as const) {
      const p = trainingPlan({ ...base, sessionMinutes: minutes });
      for (const s of p.sessions) {
        expect(s.exercises.length).toBe({ 45: 4, 60: 5, 75: 6, 90: 7 }[minutes]);
        expect(new Set(s.exercises.map((e) => e.libraryId)).size).toBe(s.exercises.length);
      }
    }
  });

  it('varie les exercices entre les séances A et B', () => {
    const [upperA, , upperB] = trainingPlan(base).sessions;
    expect(upperA!.exercises[0]!.libraryId).not.toBe(upperB!.exercises[0]!.libraryId);
  });

  it('à la maison, n’utilise que le matériel disponible', () => {
    const home = trainingPlan({ ...base, place: 'maison', equipment: ['halteres', 'banc'] });
    for (const id of ids(home)) {
      expect(
        TRAITS[id]!.needs.every((n) => ['halteres', 'banc', 'charge'].includes(n)),
        id,
      ).toBe(true);
    }
    const bare = trainingPlan({ ...base, place: 'maison', equipment: [] });
    for (const id of ids(bare)) expect(TRAITS[id]!.needs, id).toEqual([]);
    expect(bare.warnings.join(' ')).toContain('tirage');
  });

  it('écarte les mouvements exigeants pour une zone à ménager', () => {
    const p = trainingPlan({ ...base, zones: ['dos', 'genoux'] });
    const used = ids(p);
    for (const id of [...ZONE_EXCLUSIONS.dos, ...ZONE_EXCLUSIONS.genoux]) expect(used).not.toContain(id);
    expect(p.excluded).toContain(libraryExercise('barbell_deadlift')!.name);
    expect(p.warnings.join(' ')).toContain('professionnel de santé');
  });

  it('3 jours, « haut, bas, haut » : jambes dans une seule séance, avec une ou deux séries d’épaules', () => {
    const lower = new Set(['squat', 'fente', 'charniere', 'iso-quadriceps', 'iso-ischios', 'iso-fessiers', 'iso-mollets']);
    const shoulders = new Set(['iso-epaules', 'iso-arriere-epaules']);
    for (const sessionMinutes of [45, 60, 75, 90] as const) {
      const p = trainingPlan({ ...base, weekdays: [1, 3, 4], sessionMinutes, split: 'haut-bas' });
      expect(p.splitLabel).toBe('haut, bas, haut');
      expect(p.sessions.map((s) => [s.name, s.weekday])).toEqual([
        ['Haut du corps A', 1],
        ['Bas du corps et épaules', 3],
        ['Haut du corps B', 4],
      ]);
      const [upperA, legs, upperB] = p.sessions;
      for (const s of [upperA!, upperB!]) expect(s.exercises.filter((e) => lower.has(TRAITS[e.libraryId]!.pattern))).toEqual([]);
      const legPatterns = legs!.exercises.map((e) => TRAITS[e.libraryId]!.pattern);
      expect(legPatterns.filter((x) => lower.has(x)).length).toBeGreaterThanOrEqual(3);
      expect(legPatterns.filter((x) => shoulders.has(x)).length).toBeGreaterThanOrEqual(1);
      expect(legPatterns.filter((x) => shoulders.has(x)).length).toBeLessThanOrEqual(2);
    }
  });

  it('« haut, bas, haut » : les deux séances du haut ne tombent jamais deux jours de suite', () => {
    const p = trainingPlan({ ...base, weekdays: [1, 6, 7], split: 'haut-bas' });
    expect(p.sessions.map((s) => [s.name, s.weekday])).toEqual([
      ['Haut du corps A', 1],
      ['Haut du corps B', 6],
      ['Bas du corps et épaules', 7],
    ]);
    expect(upperLowerDays([2, 4, 6])).toEqual([2, 4, 6]);
  });

  it('sans choix, 3 jours restent en corps entier ; deux séances corps entier qui se suivent sont signalées', () => {
    expect(trainingPlan({ ...base, weekdays: [1, 3, 5] }).splitLabel).toBe('corps entier');
    const close = trainingPlan({ ...base, weekdays: [1, 3, 4], split: 'corps-entier' }).warnings;
    expect(close).toContain(
      'Mercredi et jeudi se suivent : en corps entier, les mêmes muscles travaillent deux jours de suite. Laisse si possible un jour entre deux séances, ou choisis « Haut, bas, haut ».',
    );
    expect(trainingPlan({ ...base, weekdays: [1, 3, 5] }).warnings.join(' ')).not.toContain('se suivent');
    expect(trainingPlan({ ...base, weekdays: [1, 3, 4], split: 'haut-bas' }).warnings.join(' ')).not.toContain('se suivent');
    expect(backToBack([1, 7])).toEqual([7, 1]);
    expect(backToBack([1, 3, 5])).toBeNull();
    expect(trainingPlan({ ...base, weekdays: [2, 3] }).warnings[0]).toBe(
      'Mardi et mercredi se suivent : en corps entier, les mêmes muscles travaillent deux jours de suite. Laisse si possible un jour entre deux séances.',
    );
  });

  it('épaules à ménager : ni développé au-dessus de la tête, ni tractions, ni dips, ni écartés, quel que soit le cadre', () => {
    const cadres: Partial<PlanAnswers>[] = [
      ...[[1], [1, 4], [1, 3, 5], [1, 2, 4, 5], [1, 2, 3, 5, 6], [1, 2, 3, 4, 5, 6]].map((weekdays) => ({ weekdays })),
      { place: 'maison', equipment: ['halteres', 'banc'] },
      { place: 'maison', equipment: ['halteres', 'traction'] },
      { place: 'maison', equipment: [] },
    ];
    for (const cadre of cadres) {
      const p = trainingPlan({ ...base, ...cadre, zones: ['epaules'] });
      const used = ids(p);
      for (const id of ZONE_EXCLUSIONS.epaules) expect(used).not.toContain(id);
      if (cadre.equipment?.length !== 0) for (const s of p.sessions) expect(s.exercises.length).toBeGreaterThanOrEqual(3);
      expect(p.warnings.join(' ')).toContain('hauteur d’épaule');
    }
  });

  it('épaules à ménager : le développé au sol passe en premier, la poulie remplace les tractions', () => {
    const [upperA, , upperB] = trainingPlan({ ...base, zones: ['epaules'] }).sessions;
    expect(upperA!.exercises[0]!.libraryId).toBe('dumbbell_floor_press');
    expect(upperB!.exercises[0]!.libraryId).toBe('machine_bench_press');
    expect(ids(trainingPlan({ ...base, zones: ['epaules'] }))).toContain('wide-grip_lat_pulldown');
    expect(upperA!.exercises.map((e) => e.libraryId)).toContain('face_pull');
    for (const s of trainingPlan({ ...base, zones: ['epaules'], weekdays: [1, 2, 3, 5, 6] }).sessions)
      expect(s.exercises.filter((e) => ['side_lateral_raise', 'cable_seated_lateral_raise'].includes(e.libraryId)).length).toBeLessThanOrEqual(1);
    expect(trainingPlan({ ...base, zones: ['genoux'] }).warnings.join(' ')).not.toContain('hauteur d’épaule');
  });

  it('ne suggère que du matériel que tu n’as pas, sans revenir sur les zones à ménager', () => {
    const bare = trainingPlan({ ...base, place: 'maison', equipment: [] });
    expect(bare.warnings[0]).toBe('Aucun exercice de tirage pour le dos avec ton matériel. Pour compléter le programme : une barre de traction ou des haltères.');
    const shoulders = trainingPlan({ ...base, place: 'maison', equipment: ['halteres', 'traction'], zones: ['epaules'] }).warnings;
    expect(shoulders[0]).toBe('Peu d’exercices de tirage pour le dos avec ton matériel. Pour compléter le programme : un banc ou une barre.');
    expect(shoulders[1]).toBe('Peu d’exercices pour l’arrière des cuisses avec ton matériel. Pour compléter le programme : un kettlebell ou une barre.');
    expect(shoulders.join(' ')).not.toContain('barre de traction');
  });

  it('prescrit séries, répétitions, repos et RIR selon l’objectif et le niveau', () => {
    const force = trainingPlan({ ...base, goal: 'force', experience: 'advanced' }).sessions[0]!.exercises;
    expect(force[0]).toMatchObject({ reps: '3-6', sets: 4, rir: 1 });
    expect(force[0]!.restSec).toBeGreaterThanOrEqual(180);
    const beginner = trainingPlan({ ...base, experience: 'beginner', returning: true }).sessions[0]!.exercises;
    expect(beginner[0]).toMatchObject({ sets: 3, rir: 3 });
  });

  describe('assistant de programme', () => {
    const lib = (id: string) => libraryExercise(id)!;
    it('séances de 30 min : 3 exercices', () => {
      for (const s of trainingPlan({ ...base, sessionMinutes: 30 }).sessions) expect(s.exercises).toHaveLength(3);
    });

    it('3 jours en poussée, tirage, jambes', () => {
      const p = trainingPlan({ ...base, weekdays: [1, 3, 5], split: 'ppl' });
      expect(p.splitLabel).toBe('poussée, tirage, jambes');
      expect(p.sessions.map((s) => s.name)).toEqual(['Poussée', 'Tirage', 'Jambes']);
      expect(p.sessions[0]!.exercises.every((e) => !['quadriceps', 'ischios', 'fessiers'].includes(lib(e.libraryId).muscle))).toBe(true);
      expect(p.reasons[0]).toMatch(/^Poussée, tirage, jambes : une séance complète par groupe/);
    });

    it('deux développés dans une séance : un plat et un incliné', () => {
      for (const equipmentStyle of [null, 'machines', 'libres'] as const) {
        const push = trainingPlan({ ...base, weekdays: [1, 3, 5], split: 'ppl', equipmentStyle }).sessions[0]!;
        const presses = push.exercises.map((e) => e.libraryId).filter((id) => ['pectoraux'].includes(lib(id).muscle));
        expect(presses.filter((id) => id.includes('incline'))).toHaveLength(1);
      }
    });

    it('exercices à éviter, favoris, machines ou poids libres', () => {
      const avoid = trainingPlan({ ...base, avoid: ['barbell_squat'] });
      expect(ids(avoid)).not.toContain('barbell_squat');
      expect(avoid.reasons.join(' ')).toContain('Écartés à ta demande : squat.');
      const fav = trainingPlan({ ...base, favorites: ['leg_press'] });
      expect(fav.sessions.find((s) => s.name === 'Bas du corps A')!.exercises[0]!.libraryId).toBe('leg_press');
      const machines = trainingPlan({ ...base, equipmentStyle: 'machines' });
      expect(['machine', 'poulie']).toContain(lib(machines.sessions[0]!.exercises[0]!.libraryId).equipment);
      const free = trainingPlan({ ...base, equipmentStyle: 'libres' });
      expect(['barre', 'halteres']).toContain(lib(free.sessions[0]!.exercises[0]!.libraryId).equipment);
    });

    it('objectif du programme et préférence de séries', () => {
      const endurance = trainingPlan({ ...base, programGoal: 'endurance-musculaire' }).sessions.flatMap((s) => s.exercises);
      expect(endurance.every((e) => e.restSec <= 60)).toBe(true);
      expect(endurance.some((e) => e.reps === '15-20')).toBe(true);
      const heavy = trainingPlan({ ...base, programGoal: 'hypertrophie', repStyle: 'lourd' });
      expect(heavy.sessions[0]!.exercises[0]!.reps).toBe('3-6');
      expect(heavy.reasons.join(' ')).toContain('Séries plus courtes et plus lourdes');
    });

    it('priorités : une série de plus, et un exercice d’isolation dans une séance qui travaille déjà le groupe', () => {
      const plain = trainingPlan({ ...base, weekdays: [1, 3, 5], split: 'ppl' });
      const prio = trainingPlan({ ...base, weekdays: [1, 3, 5], split: 'ppl', priorities: ['pectoraux'] });
      const chest = (p: typeof plain) => p.volume.find((v) => v.muscle === 'pectoraux')!.direct;
      expect(chest(prio)).toBeGreaterThanOrEqual(10);
      expect(chest(prio)).toBeGreaterThan(chest(plain));
      const push = prio.sessions.find((s) => s.name === 'Poussée')!;
      expect(push.exercises.filter((e) => lib(e.libraryId).muscle === 'pectoraux').length).toBeGreaterThan(
        plain.sessions[0]!.exercises.filter((e) => lib(e.libraryId).muscle === 'pectoraux').length,
      );
      expect(prio.reasons.at(-1)).toMatch(/^Priorité pectoraux : \d+ séries directes par semaine, avec .+ ajouté à « Poussée »\.$/);
    });

    it('volume par muscle, durée estimée et avertissements de volume', () => {
      const p = trainingPlan({ ...base, weekdays: [1, 3, 5] });
      expect(p.volume.map((v) => v.muscle)).toEqual(['pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'quadriceps', 'ischios', 'fessiers', 'mollets', 'abdominaux']);
      for (const v of p.volume) expect(v.total).toBe(v.direct + v.indirect);
      expect(p.warnings.join(' ')).toMatch(/Sous le repère de 10 séries par semaine \(Schoenfeld et al\. 2017\) : pectoraux/);
      expect(trainingPlan({ ...base, weekdays: [1, 3, 5], programGoal: 'force' }).warnings.join(' ')).not.toContain('Sous le repère');
      for (const s of p.sessions) expect(s.estimatedMinutes).toBeGreaterThan(0);
      // 8 min d'échauffement + 3 séries de 40 s + 2 repos de 2 min + 1 min de mise en place = 15 min.
      expect(estimateMinutes([{ sets: 3, restSec: 120 }])).toBe(15);
    });
  });
});
