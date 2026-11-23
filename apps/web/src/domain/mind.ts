import { MIND_EXERCISE_BY_ID, MIND_EXERCISES, type MindCategory, type MindExercise, type MindFamily } from '../data/mindExercises';
import type { CheckIn, MindSession, MoodLog, Scale5, Workout } from '../db/types';
import { addDays } from '../lib/dates';
import { completedWorkouts, weekStart } from './training';

export const CATEGORY_ORDER: MindCategory[] = ['apaiser', 'dormir', 'concentrer', 'depasser', 'recuperer', 'recul', 'confiance'];

export const CATEGORY_INFO: Record<MindCategory, { label: string; blurb: string }> = {
  apaiser: { label: 'Apaiser', blurb: 'Faire redescendre le stress' },
  dormir: { label: 'Dormir', blurb: 'Préparer la nuit' },
  concentrer: { label: 'Se concentrer', blurb: 'Rassembler ton attention' },
  depasser: { label: 'Se dépasser', blurb: 'Avant l’effort ou un défi' },
  recuperer: { label: 'Récupérer', blurb: 'Après l’effort' },
  recul: { label: 'Prendre du recul', blurb: 'Sortir des pensées en boucle' },
  confiance: { label: 'Développer sa confiance', blurb: 'Rappeler ce dont tu es capable' },
};

export const FAMILY_ORDER: MindFamily[] = ['respiration', 'ancrage', 'relaxation', 'visualisation', 'concentration'];
export const FAMILY_LABELS: Record<MindFamily, string> = {
  respiration: 'Respiration',
  ancrage: 'Ancrage',
  relaxation: 'Relaxation',
  visualisation: 'Visualisation',
  concentration: 'Concentration',
};

export type MoodKey = 'mood' | 'stress' | 'mentalEnergy' | 'motivation' | 'mentalLoad' | 'recovery';

/** Mesures du journal. « higherIsBetter » : false pour le stress et la charge mentale. */
export const MOOD_FIELDS: { key: MoodKey; label: string; low: string; high: string; higherIsBetter: boolean }[] = [
  { key: 'mood', label: 'Humeur', low: 'Au plus bas', high: 'Excellente', higherIsBetter: true },
  { key: 'stress', label: 'Stress', low: 'Aucun', high: 'Très élevé', higherIsBetter: false },
  { key: 'mentalEnergy', label: 'Énergie mentale', low: 'Vide', high: 'Pleine', higherIsBetter: true },
  { key: 'motivation', label: 'Motivation', low: 'Aucune', high: 'Très forte', higherIsBetter: true },
  { key: 'mentalLoad', label: 'Charge mentale', low: 'Légère', high: 'Écrasante', higherIsBetter: false },
  { key: 'recovery', label: 'Récupération', low: 'Mauvaise', high: 'Excellente', higherIsBetter: true },
];

export const MIND_EMOTIONS: { key: string; label: string }[] = [
  { key: 'calme', label: 'Calme' },
  { key: 'joie', label: 'Joie' },
  { key: 'fierte', label: 'Fierté' },
  { key: 'gratitude', label: 'Gratitude' },
  { key: 'confiance', label: 'Confiance' },
  { key: 'enthousiasme', label: 'Enthousiasme' },
  { key: 'anxiete', label: 'Anxiété' },
  { key: 'frustration', label: 'Frustration' },
  { key: 'tristesse', label: 'Tristesse' },
  { key: 'colere', label: 'Colère' },
  { key: 'decouragement', label: 'Découragement' },
  { key: 'irritabilite', label: 'Irritabilité' },
];
export const EMOTION_LABELS = new Map(MIND_EMOTIONS.map((e) => [e.key, e.label]));

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Durée choisie, bornée à la plage réglable de l'exercice (sinon durée par défaut). */
export function chosenMinutes(ex: MindExercise, minutes?: number): number {
  return ex.range && minutes !== undefined ? clamp(minutes, ex.range[0], ex.range[1]) : ex.minutes;
}

/** Nombre de cycles de respiration pour la durée choisie (au moins un). */
export function breathCycles(ex: MindExercise, minutes?: number): number {
  if (ex.player.kind !== 'breath') return 0;
  const cycle = sum(ex.player.phases.map((p) => p.seconds));
  return Math.max(1, Math.round((chosenMinutes(ex, minutes) * 60) / cycle));
}

/** Durée réelle d'un exercice, en secondes. */
export function exerciseSeconds(ex: MindExercise, minutes?: number): number {
  const p = ex.player;
  if (p.kind === 'steps') return sum(p.steps.map((st) => st.seconds));
  if (p.kind === 'breath') return breathCycles(ex, minutes) * sum(p.phases.map((ph) => ph.seconds));
  return chosenMinutes(ex, minutes) * 60;
}

/** Durée affichée : « 45 s », « 3 min », « 4 min 30 ». */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r >= 15 && r < 45 ? `${m} min 30` : `${r >= 45 ? m + 1 : m} min`;
}

/**
 * Position dans une suite de durées (phases d'une respiration, répétées, ou étapes d'un exercice).
 * total : durée totale ; au-delà, done.
 */
export function positionIn(durations: number[], elapsed: number, total: number): { index: number; cycle: number; remaining: number; done: boolean } {
  const cycleLength = sum(durations);
  if (elapsed >= total || cycleLength <= 0) return { index: durations.length - 1, cycle: Math.max(0, Math.ceil(total / Math.max(cycleLength, 1)) - 1), remaining: 0, done: true };
  const cycle = Math.floor(elapsed / cycleLength);
  let t = elapsed - cycle * cycleLength;
  for (let i = 0; i < durations.length; i++) {
    if (t < durations[i]!) return { index: i, cycle, remaining: durations[i]! - t, done: false };
    t -= durations[i]!;
  }
  return { index: durations.length - 1, cycle, remaining: 0, done: false };
}

/** Consignes de l'exercice, étape par étape, pour la fiche. */
export function exerciseInstructions(ex: MindExercise, minutes?: number): string[] {
  const p = ex.player;
  const sec = (v: number) => `${String(v).replace('.', ',')} s`;
  switch (p.kind) {
    case 'breath':
      return [
        ...p.intro,
        `Rythme : ${p.phases.map((ph) => `${ph.label.toLocaleLowerCase('fr-FR')} ${sec(ph.seconds)}`).join(', ')}.`,
        `${breathCycles(ex, minutes)} cycles, environ ${formatDuration(exerciseSeconds(ex, minutes))}.`,
      ];
    case 'steps':
      return p.steps.map((st) => st.text);
    case 'grounding':
      return [...p.stages.map((st) => `${st.count} ${st.prompt}.`), 'Touche un rond à chaque élément trouvé, à ton rythme.'];
    case 'focus':
      return [...p.intro, `Pendant ${formatDuration(exerciseSeconds(ex, minutes))}.`];
  }
}

export function exercisesIn(category: MindCategory): MindExercise[] {
  return MIND_EXERCISES.filter((e) => e.categories.includes(category));
}

// Routines

export type RoutineId = 'avant' | 'apres' | 'soir';
export interface RoutineStep {
  exerciseId: string;
  minutes?: number;
}
export interface MindRoutine {
  id: RoutineId;
  title: string;
  blurb: string;
  steps: RoutineStep[];
}

export const ROUTINES_KEY = 'mindRoutines';
export const ROUTINE_ORDER: RoutineId[] = ['avant', 'apres', 'soir'];
export const DEFAULT_ROUTINES: Record<RoutineId, MindRoutine> = {
  avant: {
    id: 'avant',
    title: 'Avant l’entraînement',
    blurb: 'Respiration et visualisation pour arriver concentré.',
    steps: [{ exerciseId: 'respiration-carree', minutes: 1 }, { exerciseId: 'pret-effort' }],
  },
  apres: {
    id: 'apres',
    title: 'Après l’entraînement',
    blurb: 'Retour au calme et décompression.',
    steps: [{ exerciseId: 'retour-calme' }, { exerciseId: 'abdominale', minutes: 2 }],
  },
  soir: {
    id: 'soir',
    title: 'Rituel du soir',
    blurb: 'Relâcher le corps et ralentir le souffle avant de dormir.',
    steps: [{ exerciseId: 'detente-corporelle' }, { exerciseId: 'respiration-lente', minutes: 4 }],
  },
};

/** Routines personnalisées (meta ROUTINES_KEY) complétées par celles par défaut ; les exercices inconnus sont ignorés. */
export function resolveRoutines(stored: Partial<Record<RoutineId, RoutineStep[]>> | null | undefined): Record<RoutineId, MindRoutine> {
  const out = { ...DEFAULT_ROUTINES };
  for (const id of ROUTINE_ORDER) {
    const steps = (stored?.[id] ?? []).filter((st) => MIND_EXERCISE_BY_ID.has(st.exerciseId));
    if (steps.length) out[id] = { ...DEFAULT_ROUTINES[id], steps };
  }
  return out;
}

export function routineSeconds(routine: MindRoutine): number {
  return sum(routine.steps.map((st) => exerciseSeconds(MIND_EXERCISE_BY_ID.get(st.exerciseId)!, st.minutes)));
}

// Pratique et régularité (sans culpabiliser : on montre ce qui est fait, jamais ce qui manque).

export interface PracticeSummary {
  /** Lundi à dimanche de la semaine en cours. */
  week: { date: string; minutes: number }[];
  daysThisWeek: number;
  minutesThisWeek: number;
  minutes30: number;
  sessions30: number;
  /** Jours consécutifs avec une pratique, jusqu'à aujourd'hui (ou hier si rien encore aujourd'hui). */
  streak: number;
}

export function practiceSummary(sessions: readonly MindSession[], today: string): PracticeSummary {
  const byDay = new Map<string, number>();
  for (const s of sessions) if (!s.deletedAt) byDay.set(s.date, (byDay.get(s.date) ?? 0) + s.durationSec / 60);
  const start = weekStart(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((date) => ({ date, minutes: Math.round(byDay.get(date) ?? 0) }));
  const since = addDays(today, -29);
  const recent = sessions.filter((s) => !s.deletedAt && s.date >= since && s.date <= today);
  let streak = 0;
  let day = byDay.has(today) ? today : addDays(today, -1);
  while (byDay.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return {
    week,
    daysThisWeek: week.filter((d) => d.date <= today && byDay.has(d.date)).length,
    minutesThisWeek: Math.round(sum(week.map((d) => d.minutes))),
    minutes30: Math.round(sum(recent.map((s) => s.durationSec / 60))),
    sessions30: recent.length,
    streak,
  };
}

// Journal

export function moodValue(log: MoodLog | undefined | null, key: MoodKey): Scale5 | null {
  return (log?.[key] as Scale5 | null | undefined) ?? null;
}

/** Moyenne d'une mesure sur les `days` derniers jours et sur les `days` jours d'avant. */
export function moodAverages(logs: readonly MoodLog[], key: MoodKey, today: string, days = 7): { current: number | null; previous: number | null; count: number } {
  const avg = (from: string, to: string) => {
    const v = logs
      .filter((l) => !l.deletedAt && l.date >= from && l.date <= to)
      .map((l) => moodValue(l, key))
      .filter((x): x is Scale5 => x !== null);
    return { value: v.length ? Math.round((sum(v) / v.length) * 10) / 10 : null, count: v.length };
  };
  const cur = avg(addDays(today, -(days - 1)), today);
  const prev = avg(addDays(today, -(2 * days - 1)), addDays(today, -days));
  return { current: cur.value, previous: prev.value, count: cur.count };
}

// Sommeil

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMinutes = (m: number) => {
  const v = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};

/** Durée de la nuit d'après les heures de coucher et de réveil (passage de minuit compris), au quart d'heure. */
export function sleepFromTimes(bedTime: string, wakeTime: string): number {
  const minutes = (toMinutes(wakeTime) - toMinutes(bedTime) + 1440) % 1440;
  return Math.round(minutes / 15) / 4;
}

/** Heure moyenne et écart moyen (en minutes), calculés autour de midi pour que 23 h 30 et 0 h 30 se moyennent à minuit. */
function timeStats(times: string[], pivot: number): { mean: string; spreadMin: number } | null {
  if (times.length < 3) return null;
  const shifted = times.map((t) => (toMinutes(t) - pivot + 1440) % 1440);
  const mean = sum(shifted) / shifted.length;
  const spread = sum(shifted.map((v) => Math.abs(v - mean))) / shifted.length;
  return { mean: fromMinutes(mean + pivot), spreadMin: Math.round(spread) };
}

export interface SleepStats {
  nights: number;
  avgHours: number | null;
  avgQuality: number | null;
  /** Nuits de moins de 7 h, le repère adulte (Watson et al., 2015). */
  shortNights: number;
  bedTime: { mean: string; spreadMin: number } | null;
  wakeTime: { mean: string; spreadMin: number } | null;
  avgAwakenings: number | null;
}

export function sleepStats(checkIns: readonly CheckIn[], today: string, days: number): SleepStats {
  const since = addDays(today, -(days - 1));
  const nights = checkIns.filter((c) => !c.deletedAt && c.date >= since && c.date <= today);
  const q = nights.map((c) => c.sleepQuality).filter((v): v is Scale5 => !!v);
  const aw = nights.map((c) => c.awakenings).filter((v): v is number => v !== null && v !== undefined);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    nights: nights.length,
    avgHours: nights.length ? r1(sum(nights.map((c) => c.sleepHours)) / nights.length) : null,
    avgQuality: q.length ? r1(sum(q) / q.length) : null,
    shortNights: nights.filter((c) => c.sleepHours < 7).length,
    bedTime: timeStats(
      nights.map((c) => c.bedTime).filter((t): t is string => !!t),
      12 * 60,
    ),
    wakeTime: timeStats(
      nights.map((c) => c.wakeTime).filter((t): t is string => !!t),
      0,
    ),
    avgAwakenings: aw.length ? r1(sum(aw) / aw.length) : null,
  };
}

/**
 * Sommeil des nuits précédant une séance, comparé aux autres nuits (60 derniers jours).
 * Une observation, pas une cause : null tant qu'il n'y a pas au moins 4 nuits de chaque côté.
 */
export function sleepAroundTraining(
  checkIns: readonly CheckIn[],
  workouts: readonly Workout[],
  today: string,
  days = 60,
): { before: number; other: number; nightsBefore: number; nightsOther: number } | null {
  const since = addDays(today, -(days - 1));
  const trainingDays = new Set(completedWorkouts(workouts).map((w) => w.date));
  const nights = checkIns.filter((c) => !c.deletedAt && c.date >= since && c.date <= today);
  const before = nights.filter((c) => trainingDays.has(c.date)).map((c) => c.sleepHours);
  const other = nights.filter((c) => !trainingDays.has(c.date)).map((c) => c.sleepHours);
  if (before.length < 4 || other.length < 4) return null;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { before: r2(sum(before) / before.length), other: r2(sum(other) / other.length), nightsBefore: before.length, nightsOther: other.length };
}

// Recommandation du moment

export type MindTarget = { kind: 'exercise'; id: string } | { kind: 'routine'; id: RoutineId };
export interface MindRecommendation {
  target: MindTarget;
  reason: string;
  /** Catégories pour proposer d'autres exercices du même esprit. */
  categories: MindCategory[];
}

export interface RecoInput {
  hour: number;
  mood: MoodLog | null;
  lastNight: CheckIn | null;
  /** Séance terminée aujourd'hui, il y a combien de minutes (null : aucune). */
  workoutEndedMinutesAgo: number | null;
  /** Une séance est prévue aujourd'hui et pas encore faite. */
  trainingPlanned: boolean;
  /** Identifiants (exercices et routines) déjà faits aujourd'hui. */
  doneToday: ReadonlySet<string>;
}

/** Règles simples et lisibles : la plus pertinente gagne. Jamais un avis médical. */
export function recommendMind(input: RecoInput): MindRecommendation {
  const { hour, mood, lastNight, doneToday } = input;
  const ex = (id: string, reason: string, categories: MindCategory[]): MindRecommendation => ({ target: { kind: 'exercise', id }, reason, categories });
  const routine = (id: RoutineId, reason: string, categories: MindCategory[]): MindRecommendation => ({ target: { kind: 'routine', id }, reason, categories });
  const evening = hour >= 21 || hour < 4;

  if (input.workoutEndedMinutesAgo !== null && input.workoutEndedMinutesAgo <= 180 && !doneToday.has('apres')) {
    return routine('apres', 'Ta séance est terminée : quelques minutes pour redescendre et récupérer.', ['recuperer']);
  }
  if (input.trainingPlanned && hour >= 6 && hour < 21 && !doneToday.has('avant')) {
    return routine('avant', 'Une séance est prévue aujourd’hui : de quoi arriver concentré.', ['depasser', 'concentrer']);
  }
  if ((mood?.stress ?? 0) >= 4 && !doneToday.has('coherence')) return ex('coherence', 'Tu as noté un stress élevé aujourd’hui.', ['apaiser']);
  if (evening && !doneToday.has('soir')) return routine('soir', 'C’est le soir : un rituel court pour préparer la nuit.', ['dormir']);
  if ((mood?.mentalLoad ?? 0) >= 4 && !doneToday.has('moment-present')) return ex('moment-present', 'Ta charge mentale est élevée : un moment pour prendre du recul.', ['recul']);
  if (((mood?.mood ?? 5) <= 2 || (mood?.mentalEnergy ?? 5) <= 2) && !doneToday.has('lieu-calme')) {
    return ex('lieu-calme', 'Humeur ou énergie basse aujourd’hui : un moment pour toi, sans objectif.', ['apaiser', 'recul']);
  }
  if (lastNight && lastNight.sleepHours < 6.5 && !doneToday.has('detente-corporelle')) {
    return ex('detente-corporelle', 'Nuit courte : une pause de détente, sans forcer.', ['recuperer', 'apaiser']);
  }
  if ((mood?.motivation ?? 5) <= 2 && !doneToday.has('motivation')) return ex('motivation', 'Motivation en baisse : revenir à tes raisons.', ['depasser', 'confiance']);
  if (hour < 12) return ex(doneToday.has('recentrage') ? 'point-fixe' : 'recentrage', 'Pour démarrer la journée avec les idées claires.', ['concentrer']);
  if (hour < 18) return ex(doneToday.has('coherence') ? 'soupir' : 'coherence', 'Une pause en milieu de journée.', ['apaiser', 'concentrer']);
  return ex(doneToday.has('detente-corporelle') ? 'abdominale' : 'detente-corporelle', 'Pour décrocher de ta journée.', ['apaiser', 'dormir']);
}

/** Trois autres exercices dans l'esprit de la recommandation, variés d'un jour à l'autre. */
export function suggestedExercises(reco: MindRecommendation, today: string, doneToday: ReadonlySet<string>, count = 3): MindExercise[] {
  const exclude = reco.target.kind === 'exercise' ? reco.target.id : null;
  const pool = MIND_EXERCISES.filter((e) => e.id !== exclude && !doneToday.has(e.id) && e.categories.some((c) => reco.categories.includes(c)));
  const seed = Number(today.replaceAll('-', '')) % 97;
  return [...pool].sort((a, b) => ((hash(a.id) + seed) % 97) - ((hash(b.id) + seed) % 97)).slice(0, count);
}

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h;
}

export function greeting(hour: number, firstName?: string): string {
  const base = hour >= 5 && hour < 18 ? 'Bonjour' : 'Bonsoir';
  return firstName ? `${base} ${firstName}` : base;
}
