import type {
  Activity,
  CheckIn,
  Exercise,
  FoodEntry,
  MindSession,
  NutritionTargets,
  Program,
  ProgramVersion,
  PulseDay,
  TargetChange,
  WeekNote,
  Workout,
  WorkoutSet,
  WorkoutTemplate,
} from '../../db/types';
import { libraryExercise } from '../../data/exerciseLibrary';
import { addDays } from '../../lib/dates';
import { targetsAt } from '../lifeIndex';
import { holdLoad, parseRepRange, suggestNext, type SessionPerf } from '../progression';
import { cycleWeeks, programWorkouts, type TrackedWeek } from '../programs/tracking';
import { activeOnly, e1rm, findRecords, setsByWorkout, setVolume, weekStart, type PersonalRecord } from '../training';
import { LEVEL_SETTINGS as S } from './settings';

/**
 * FORGE LEVEL : l'XP, les niveaux et les badges se calculent à partir des données enregistrées, sans journal stocké.
 * Chaque gain porte une clé unique (type et identifiant de la donnée source) : une même séance ne rapporte qu'une fois,
 * et tout se recalcule à l'identique après une restauration.
 */

export interface LevelInput {
  workouts: readonly Workout[];
  sets: readonly WorkoutSet[];
  exercises: readonly Exercise[];
  templates: readonly WorkoutTemplate[];
  programs: readonly Program[];
  versions: readonly ProgramVersion[];
  pulseDays: readonly PulseDay[];
  mindSessions: readonly MindSession[];
  activities: readonly Activity[];
  foodEntries: readonly FoodEntry[];
  targets: NutritionTargets | null;
  targetChanges: readonly TargetChange[];
  weekNotes: readonly WeekNote[];
  checkIns: readonly CheckIn[];
  today: string;
}

export type XpKind = 'seance' | 'semaine' | 'record' | 'charge' | 'mind' | 'activite' | 'proteines' | 'bilan' | 'badge' | 'cycle';

export interface XpEvent {
  /** Clé unique : un même gain ne compte qu'une fois. */
  key: string;
  date: string;
  kind: XpKind;
  xp: number;
  label: string;
}

export const XP_KIND_LABELS: Record<XpKind, string> = {
  seance: 'Séances',
  semaine: 'Semaines du programme',
  record: 'Records',
  charge: 'Objectifs de charge',
  mind: 'Mind',
  activite: 'Cardio et mobilité',
  proteines: 'Protéines',
  bilan: 'Bilans de la semaine',
  badge: 'Badges',
  cycle: 'Cycles terminés',
};

/** Les données utiles une seule fois, partagées par l'XP, les badges et les caractéristiques. */
export interface LevelModel {
  input: LevelInput;
  /** Séances terminées, de la plus ancienne à la plus récente. */
  done: Workout[];
  /** Séries des séances terminées. */
  sets: WorkoutSet[];
  setsOf: Map<string, WorkoutSet[]>;
  sessions: Map<string, SessionPerf[]>;
  records: PersonalRecord[];
  isCompound: (exerciseId: string) => boolean;
  /** Semaines suivies de chaque programme (du cycle, ou de calendrier sans date de début). */
  programWeeks: { program: Program; weeks: TrackedWeek[]; cycle: boolean }[];
}

const chrono = (a: Workout, b: Workout) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt);

export function buildModel(input: LevelInput): LevelModel {
  const done = activeOnly(input.workouts)
    .filter((w) => w.endedAt && w.date <= input.today)
    .sort(chrono);
  const doneIds = new Set(done.map((w) => w.id));
  const liveSets = activeOnly(input.sets).filter((s) => doneIds.has(s.workoutId));
  const setsOf = setsByWorkout(liveSets);
  const sessions = new Map<string, SessionPerf[]>();
  for (const w of done) {
    const byExercise = new Map<string, WorkoutSet[]>();
    for (const s of setsOf.get(w.id) ?? []) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);
    for (const [exerciseId, mine] of byExercise) {
      const top = mine.reduce((a, b) => (e1rm(b.weightKg, b.reps) > e1rm(a.weightKg, a.reps) ? b : a));
      const perf: SessionPerf = {
        workoutId: w.id,
        date: w.date,
        sets: mine,
        top,
        e1rmKg: e1rm(top.weightKg, top.reps),
        volumeKg: Math.round(mine.reduce((n, x) => n + setVolume(x), 0)),
        maxReps: Math.max(...mine.map((x) => x.reps)),
        maxLoad: Math.max(...mine.map((x) => x.weightKg)),
      };
      sessions.set(exerciseId, [...(sessions.get(exerciseId) ?? []), perf]);
    }
  }
  const byId = new Map(input.exercises.map((e) => [e.id, e]));
  const isCompound = (id: string) => {
    const e = byId.get(id);
    return (e?.kind ?? (e?.libraryId ? libraryExercise(e.libraryId)?.kind : null)) === 'compound';
  };
  const records = findRecords(done, liveSets).reverse();
  const programWeeks: LevelModel['programWeeks'] = [];
  for (const program of activeOnly(input.programs)) {
    const mine = programWorkouts(program.id, done, input.templates);
    // Sans date de début, on suit les semaines du lundi au dimanche depuis la première séance du programme.
    const anchor = program.startDate ?? (mine[0] ? weekStart(mine[0].date) : null);
    if (!anchor) continue;
    const weeks = cycleWeeks({
      program: { id: program.id, startDate: anchor, durationWeeks: program.startDate ? (program.durationWeeks ?? null) : null },
      templates: input.templates,
      versions: input.versions.filter((v) => v.programId === program.id),
      workouts: done,
      sets: [],
      pulseDays: input.pulseDays,
      today: input.today,
    });
    programWeeks.push({ program, weeks, cycle: Boolean(program.startDate) });
  }
  return { input, done, sets: liveSets, setsOf, sessions, records, isCompound, programWeeks };
}

/** Une semaine de programme respectée : au moins une séance due, et toutes les séances dues faites (allégées comprises). */
export function weekRespected(w: TrackedWeek): { ok: boolean; date: string | null } {
  const due = w.slots.filter((s) => s.state !== 'recuperation' && s.state !== 'a-venir');
  if (!due.length || w.slots.some((s) => s.state === 'a-venir' || s.state === 'aujourdhui' || s.state === 'manquee' || s.state === 'deplacee')) return { ok: false, date: null };
  const dates = due.map((s) => s.date).sort();
  return { ok: due.every((s) => s.state === 'faite' || s.state === 'allegee'), date: dates.at(-1)! };
}

/** Taux de séances dues faites sur un ensemble de semaines (récupérations PULSE exclues), null sans séance due. */
export function weeksRate(weeks: readonly TrackedWeek[]): number | null {
  let due = 0;
  let ok = 0;
  for (const w of weeks)
    for (const s of w.slots) {
      if (s.state === 'a-venir' || s.state === 'aujourdhui' || s.state === 'recuperation') continue;
      due++;
      if (s.state === 'faite' || s.state === 'allegee') ok++;
    }
  return due ? ok / due : null;
}

/** Fin du cycle d'un programme et son taux, s'il est terminé (durée écoulée, ou programme terminé). */
export function finishedCycle(program: Program, weeks: readonly TrackedWeek[], today: string): { date: string; rate: number } | null {
  if (!program.startDate) return null;
  const end = program.durationWeeks ? addDays(program.startDate, program.durationWeeks * 7 - 1) : null;
  const stop = program.status === 'termine' && program.endDate ? (end && end < program.endDate ? end : program.endDate) : end && end < today ? end : null;
  if (!stop) return null;
  const inCycle = weeks.filter((w) => w.start <= stop);
  const rate = weeksRate(inCycle.map((w) => ({ ...w, slots: w.slots.filter((s) => s.date <= stop) })));
  return rate === null ? null : { date: stop, rate };
}

const exerciseName = (m: LevelModel, id: string) => {
  const e = m.input.exercises.find((x) => x.id === id);
  return e?.name ?? 'un exercice';
};

/** L'XP de tout ce qui a été fait, hors badges (calculés à part, puis ajoutés). */
export function baseXpEvents(m: LevelModel): XpEvent[] {
  const { input, done } = m;
  const out: XpEvent[] = [];
  const X = S.xp;

  // Séances terminées : une par jour, et pas plus de 6 par semaine.
  const perWeek = new Map<string, number>();
  const seenDays = new Set<string>();
  for (const w of done) {
    if ((m.setsOf.get(w.id)?.length ?? 0) < X.workout.minSets || seenDays.has(w.date)) continue;
    const week = weekStart(w.date);
    const n = perWeek.get(week) ?? 0;
    if (n >= X.workout.maxPerWeek) continue;
    seenDays.add(w.date);
    perWeek.set(week, n + 1);
    out.push({ key: `seance:${w.id}`, date: w.date, kind: 'seance', xp: X.workout.xp, label: w.adjustment ? `${w.name}, allégée avec PULSE` : w.name });
  }

  // Semaines du programme respectées.
  for (const { program, weeks } of m.programWeeks)
    for (const w of weeks) {
      const r = weekRespected(w);
      if (r.ok)
        out.push({ key: `semaine:${program.id}:${w.start}`, date: r.date!, kind: 'semaine', xp: X.programWeek.xp, label: `${program.name}, semaine du ${w.start} respectée` });
    }

  // Records : au plus 3 par séance.
  const recordsPer = new Map<string, number>();
  for (const r of m.records) {
    const n = recordsPer.get(r.workoutId) ?? 0;
    if (n >= X.record.maxPerWorkout) continue;
    recordsPer.set(r.workoutId, n + 1);
    out.push({ key: `record:${r.workoutId}:${r.exerciseId}`, date: r.date, kind: 'record', xp: X.record.xp, label: `Record : ${exerciseName(m, r.exerciseId)}` });
  }

  // Objectifs de charge de la double progression atteints : au plus 3 par séance.
  const repsFor = repRangeLookup(input);
  const hitsPer = new Map<string, number>();
  const workoutOf = new Map(done.map((w) => [w.id, w]));
  for (const [exerciseId, list] of m.sessions)
    list.forEach((session, i) => {
      if (i === 0) return;
      const w = workoutOf.get(session.workoutId)!;
      let target = suggestNext(list.slice(0, i), parseRepRange(repsFor(w, exerciseId)));
      if (w.adjustment) target = holdLoad(target, list[i - 1]!.maxLoad);
      if (!target) return;
      const hit = session.sets.some((s) => s.weightKg >= target!.weightKg && s.reps >= target!.reps);
      const n = hitsPer.get(w.id) ?? 0;
      if (!hit || n >= X.loadTarget.maxPerWorkout) return;
      hitsPer.set(w.id, n + 1);
      out.push({ key: `charge:${w.id}:${exerciseId}`, date: w.date, kind: 'charge', xp: X.loadTarget.xp, label: `Objectif de charge atteint : ${exerciseName(m, exerciseId)}` });
    });

  // Pratique Mind terminée : une par jour.
  const mindDays = new Set<string>();
  for (const s of activeOnly(input.mindSessions).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))) {
    if (!s.completed || s.date > input.today || mindDays.has(s.date)) continue;
    mindDays.add(s.date);
    out.push({ key: `mind:${s.date}`, date: s.date, kind: 'mind', xp: X.mind.xp, label: `Mind : ${s.title}` });
  }

  // Cardio ou mobilité : un par jour.
  const activityDays = new Set<string>();
  for (const a of activeOnly(input.activities).sort((x, y) => x.date.localeCompare(y.date))) {
    if (a.date > input.today || activityDays.has(a.date)) continue;
    activityDays.add(a.date);
    out.push({
      key: `activite:${a.date}`,
      date: a.date,
      kind: 'activite',
      xp: X.activity.xp,
      label: a.kind === 'cardio' ? `Cardio, ${a.minutes} min` : `Mobilité, ${a.minutes} min`,
    });
  }

  // Protéines atteintes : au plus 5 jours par semaine, contre l'objectif en vigueur ce jour-là.
  const protein = new Map<string, number>();
  for (const e of activeOnly(input.foodEntries)) if (e.date <= input.today) protein.set(e.date, (protein.get(e.date) ?? 0) + e.proteinG);
  const proteinWeeks = new Map<string, number>();
  for (const [date, grams] of [...protein].sort(([a], [b]) => a.localeCompare(b))) {
    const t = targetsAt(input.targets, input.targetChanges, date);
    if (!t || t.proteinG <= 0 || grams < t.proteinG * X.protein.ratio) continue;
    const week = weekStart(date);
    const n = proteinWeeks.get(week) ?? 0;
    if (n >= X.protein.maxPerWeek) continue;
    proteinWeeks.set(week, n + 1);
    out.push({ key: `proteines:${date}`, date, kind: 'proteines', xp: X.protein.xp, label: `Protéines : ${Math.round(grams)} g sur ${t.proteinG} g` });
  }

  // Bilan de la semaine rempli.
  for (const n of activeOnly(input.weekNotes)) {
    if (![n.wentWell, n.toAdjust, n.intention].some((t) => t?.trim())) continue;
    const date = n.createdAt.slice(0, 10) < n.weekStart ? n.weekStart : n.createdAt.slice(0, 10);
    if (date > input.today) continue;
    out.push({ key: `bilan:${n.weekStart}`, date, kind: 'bilan', xp: X.weekNote.xp, label: 'Bilan de la semaine rempli' });
  }

  // Cycle terminé avec 80 % des séances dues faites ou plus.
  for (const { program, weeks } of m.programWeeks) {
    const c = finishedCycle(program, weeks, input.today);
    if (c && c.rate >= X.cycle.minRate)
      out.push({ key: `cycle:${program.id}`, date: c.date, kind: 'cycle', xp: X.cycle.xp, label: `Cycle terminé : ${program.name}, ${Math.round(c.rate * 100)} % des séances` });
  }
  return out;
}

/** Fourchette de répétitions prévue pour un exercice dans une séance : celle de la version suivie, sinon celle de la séance actuelle. */
function repRangeLookup(input: LevelInput): (w: Workout, exerciseId: string) => string | null {
  const versions = new Map(input.versions.map((v) => [v.id, v]));
  const templates = new Map(input.templates.map((t) => [t.id, t]));
  return (w, exerciseId) => {
    const snapshot = w.programVersionId ? versions.get(w.programVersionId)?.snapshot : undefined;
    const fromSnapshot = snapshot?.sessions.find((s) => s.templateId === w.templateId)?.exercises.find((e) => e.exerciseId === exerciseId)?.reps;
    if (fromSnapshot) return fromSnapshot;
    return (w.templateId && templates.get(w.templateId)?.exercises.find((e) => e.exerciseId === exerciseId)?.reps) || null;
  };
}

export interface LevelProgress {
  level: number;
  totalXp: number;
  /** XP cumulée au début du niveau actuel et du suivant (null au niveau maximal). */
  floor: number;
  next: number | null;
  /** De 0 à 1 dans le niveau actuel. */
  progress: number;
}

/** XP cumulée pour atteindre un niveau (1 pour 0 XP). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round((S.levels.coefficient * (level - 1) ** S.levels.exponent) / 10) * 10;
}

export function levelFor(totalXp: number): LevelProgress {
  let level = 1;
  while (level < S.levels.max && totalXp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const next = level < S.levels.max ? xpForLevel(level + 1) : null;
  return { level, totalXp, floor, next, progress: next ? (totalXp - floor) / (next - floor) : 1 };
}

/** Niveau atteint à chaque date où il change, pour l'historique des passages de niveau. */
export function levelUps(events: readonly XpEvent[]): { level: number; date: string }[] {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  const out: { level: number; date: string }[] = [];
  let total = 0;
  let level = 1;
  for (const e of sorted) {
    total += e.xp;
    const now = levelFor(total).level;
    for (let l = level + 1; l <= now; l++) out.push({ level: l, date: e.date });
    level = now;
  }
  return out;
}
