import { describe, expect, it } from 'vitest';
import { MIND_EXERCISE_BY_ID, MIND_EXERCISES } from '../data/mindExercises';
import type { CheckIn, MindSession, MoodLog, Workout } from '../db/types';
import {
  breathCycles,
  CATEGORY_ORDER,
  DEFAULT_ROUTINES,
  exerciseInstructions,
  exerciseSeconds,
  formatDuration,
  moodAverages,
  positionIn,
  practiceSummary,
  recommendMind,
  resolveRoutines,
  routineSeconds,
  sleepAroundTraining,
  sleepFromTimes,
  sleepStats,
  suggestedExercises,
  type RecoInput,
} from './mind';

const sync = { createdAt: 'a', updatedAt: 'a', deletedAt: null };
const night = (date: string, sleepHours: number, extra: Partial<CheckIn> = {}): CheckIn => ({
  ...sync,
  id: `c-${date}`,
  date,
  sleepHours,
  energy: 3,
  fatigue: 3,
  soreness: 2,
  ...extra,
});
const session = (date: string, minutes: number): MindSession => ({
  ...sync,
  id: `s-${date}-${minutes}`,
  date,
  time: '12:00',
  kind: 'exercise',
  ref: 'coherence',
  title: 'Cohérence cardiaque',
  durationSec: minutes * 60,
  completed: true,
});

describe('bibliothèque d’exercices', () => {
  it('a des identifiants uniques, des catégories connues et un contenu complet', () => {
    expect(MIND_EXERCISE_BY_ID.size).toBe(MIND_EXERCISES.length);
    expect(MIND_EXERCISES.length).toBeGreaterThanOrEqual(20);
    for (const ex of MIND_EXERCISES) {
      expect(ex.categories.length, ex.id).toBeGreaterThan(0);
      for (const c of ex.categories) expect(CATEGORY_ORDER).toContain(c);
      expect(ex.presentation.length, ex.id).toBeGreaterThan(20);
      expect(ex.goal.length, ex.id).toBeGreaterThan(10);
      expect(exerciseInstructions(ex).length, ex.id).toBeGreaterThan(0);
      expect(exerciseSeconds(ex), ex.id).toBeGreaterThanOrEqual(30);
      expect(exerciseSeconds(ex), ex.id).toBeLessThanOrEqual(20 * 60);
      if (ex.range) expect(ex.range[0]).toBeLessThanOrEqual(ex.minutes);
    }
  });

  it('couvre les cinq familles et les sept catégories', () => {
    expect(new Set(MIND_EXERCISES.map((e) => e.family)).size).toBe(5);
    for (const c of CATEGORY_ORDER)
      expect(
        MIND_EXERCISES.some((e) => e.categories.includes(c)),
        c,
      ).toBe(true);
  });

  it('calcule les cycles de respiration pour la durée choisie', () => {
    const coherence = MIND_EXERCISE_BY_ID.get('coherence')!;
    expect(breathCycles(coherence)).toBe(30);
    expect(breathCycles(coherence, 2)).toBe(12);
    expect(breathCycles(coherence, 99)).toBe(60);
    expect(exerciseSeconds(coherence, 2)).toBe(120);
  });
});

describe('formatDuration', () => {
  it('arrondit au format lisible', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(180)).toBe('3 min');
    expect(formatDuration(270)).toBe('4 min 30');
    expect(formatDuration(298)).toBe('5 min');
  });
});

describe('positionIn', () => {
  it('suit les phases cycle après cycle', () => {
    expect(positionIn([4, 6], 0, 30)).toEqual({ index: 0, cycle: 0, remaining: 4, done: false });
    expect(positionIn([4, 6], 5, 30)).toEqual({ index: 1, cycle: 0, remaining: 5, done: false });
    expect(positionIn([4, 6], 12, 30)).toEqual({ index: 0, cycle: 1, remaining: 2, done: false });
    expect(positionIn([4, 6], 30, 30).done).toBe(true);
  });
});

describe('routines', () => {
  it('garde les routines par défaut et ignore les exercices inconnus', () => {
    const r = resolveRoutines({ avant: [{ exerciseId: 'inconnu' }], apres: [{ exerciseId: 'coherence', minutes: 3 }] });
    expect(r.avant).toEqual(DEFAULT_ROUTINES.avant);
    expect(r.apres.steps).toEqual([{ exerciseId: 'coherence', minutes: 3 }]);
    expect(routineSeconds(r.apres)).toBe(180);
  });

  it('la routine d’avant séance dure environ 3 minutes', () => {
    const sec = routineSeconds(DEFAULT_ROUTINES.avant);
    expect(sec).toBeGreaterThanOrEqual(150);
    expect(sec).toBeLessThanOrEqual(240);
  });
});

describe('practiceSummary', () => {
  it('compte la semaine, les 30 jours et les jours consécutifs', () => {
    const today = '2026-11-25'; // mercredi
    const p = practiceSummary([session('2026-11-23', 5), session('2026-11-24', 3), session('2026-11-24', 2), session('2026-11-20', 10)], today);
    expect(p.week.map((d) => d.minutes)).toEqual([5, 5, 0, 0, 0, 0, 0]);
    expect(p.daysThisWeek).toBe(2);
    expect(p.minutesThisWeek).toBe(10);
    expect(p.minutes30).toBe(20);
    expect(p.sessions30).toBe(4);
    expect(p.streak).toBe(2);
  });
});

describe('journal', () => {
  it('compare la semaine à la précédente', () => {
    const log = (date: string, stress: 1 | 2 | 3 | 4 | 5): MoodLog => ({ ...sync, id: date, date, stress });
    const r = moodAverages([log('2026-11-24', 4), log('2026-11-20', 2), log('2026-11-15', 2), log('2026-11-12', 1)], 'stress', '2026-11-24');
    expect(r).toEqual({ current: 3, previous: 1.5, count: 2 });
  });
});

describe('sommeil', () => {
  it('calcule la durée en passant minuit', () => {
    expect(sleepFromTimes('23:30', '07:00')).toBe(7.5);
    expect(sleepFromTimes('01:10', '07:00')).toBe(5.75);
  });

  it('moyenne les heures de coucher autour de minuit', () => {
    const today = '2026-11-24';
    const s = sleepStats(
      [
        night('2026-11-22', 7, { bedTime: '23:30', wakeTime: '06:45', sleepQuality: 4, awakenings: 1 }),
        night('2026-11-23', 6.5, { bedTime: '00:30', wakeTime: '07:15', sleepQuality: 3, awakenings: 0 }),
        night('2026-11-24', 8, { bedTime: '00:00', wakeTime: '07:00' }),
      ],
      today,
      7,
    );
    expect(s.nights).toBe(3);
    expect(s.avgHours).toBe(7.2);
    expect(s.shortNights).toBe(1);
    expect(s.bedTime).toEqual({ mean: '00:00', spreadMin: 20 });
    expect(s.wakeTime?.mean).toBe('07:00');
    expect(s.avgQuality).toBe(3.5);
    expect(s.avgAwakenings).toBe(0.5);
  });

  it('ne compare le sommeil avant séance qu’avec assez de nuits', () => {
    const workouts = ['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09'].map((date): Workout => ({
      ...sync,
      id: date,
      date,
      name: 'Séance',
      exerciseIds: [],
      startedAt: `${date}T17:00:00Z`,
      endedAt: `${date}T18:00:00Z`,
    }));
    const nights = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'].map((d) => night(`2026-11-${d}`, ['02', '04', '06', '09'].includes(d) ? 7.5 : 6.5));
    expect(sleepAroundTraining(nights, workouts, '2026-11-10')).toEqual({ before: 7.5, other: 6.5, nightsBefore: 4, nightsOther: 6 });
    expect(sleepAroundTraining(nights.slice(0, 5), workouts, '2026-11-10')).toBeNull();
  });
});

describe('recommandation', () => {
  const base: RecoInput = { hour: 15, mood: null, lastNight: null, workoutEndedMinutesAgo: null, trainingPlanned: false, doneToday: new Set() };

  it('propose le retour au calme juste après une séance', () => {
    expect(recommendMind({ ...base, workoutEndedMinutesAgo: 30 }).target).toEqual({ kind: 'routine', id: 'apres' });
  });

  it('propose la routine d’avant séance quand une séance est prévue', () => {
    expect(recommendMind({ ...base, trainingPlanned: true }).target).toEqual({ kind: 'routine', id: 'avant' });
    expect(recommendMind({ ...base, trainingPlanned: true, doneToday: new Set(['avant']) }).target).not.toEqual({ kind: 'routine', id: 'avant' });
  });

  it('suit un stress élevé noté dans le journal', () => {
    const mood: MoodLog = { ...sync, id: 'm', date: '2026-11-24', stress: 5 };
    expect(recommendMind({ ...base, mood }).target).toEqual({ kind: 'exercise', id: 'coherence' });
  });

  it('le soir, propose le rituel du soir', () => {
    expect(recommendMind({ ...base, hour: 22 }).target).toEqual({ kind: 'routine', id: 'soir' });
  });

  it('chaque recommandation pointe vers un exercice ou une routine existants', () => {
    for (const hour of [7, 13, 19, 23]) {
      const r = recommendMind({ ...base, hour });
      if (r.target.kind === 'exercise') expect(MIND_EXERCISE_BY_ID.has(r.target.id)).toBe(true);
      const more = suggestedExercises(r, '2026-11-24', new Set());
      expect(more.length).toBeGreaterThan(0);
      expect(more.every((e) => e.categories.some((c) => r.categories.includes(c)))).toBe(true);
    }
  });
});
