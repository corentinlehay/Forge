import { MUSCLE_GROUPS, type MuscleGroup } from '../../data/muscles';
import type { Program, ProgramVersion, PulseDay, Workout, WorkoutSet, WorkoutTemplate } from '../../db/types';
import { addDays, daysBetween } from '../../lib/dates';
import { muscleVolumeBetween, type MuscleResolver } from '../muscleVolume';
import { exerciseSessions, exerciseTrend, type TrendKind } from '../progression';
import { decisionText } from '../pulse/decisions';
import { activeOnly, findRecords, isoWeekday, setsByWorkout, workoutStats, type PersonalRecord } from '../training';

/**
 * Suivi d'un programme (FORGE PROGRAMS, suivi-1) : semaines du cycle, séances prévues et faites, régularité,
 * volume, progression, records, et l'historique de ses versions et des adaptations PULSE.
 * Tout est lu dans les données enregistrées ; rien n'est deviné (sans date de début, pas de semaines de cycle).
 */

type Session = { templateId: string; name: string; weekdays: number[] };

/** Séances prévues à une date : celles de la version en vigueur ce jour-là (la plus récente créée avant ou ce jour-là). */
export function sessionsOn(date: string, versions: readonly ProgramVersion[], current: readonly Session[]): readonly Session[] {
  const live = activeOnly(versions).sort((a, b) => a.version - b.version);
  if (!live.length) return current;
  const inForce = live.filter((v) => v.createdAt.slice(0, 10) <= date).at(-1) ?? live[0]!;
  return inForce.snapshot.sessions;
}

/** Séances terminées du programme : liées à lui, ou, pour les plus anciennes, faites depuis une de ses séances. */
export function programWorkouts(programId: string, workouts: readonly Workout[], templates: readonly WorkoutTemplate[]): Workout[] {
  const mine = new Set(templates.filter((t) => t.programId === programId).map((t) => t.id));
  return activeOnly(workouts).filter((w) => w.endedAt && (w.programId ? w.programId === programId : Boolean(w.templateId && mine.has(w.templateId))));
}

export type SlotState = 'faite' | 'allegee' | 'manquee' | 'aujourdhui' | 'a-venir' | 'deplacee' | 'recuperation';

export interface WeekSlot {
  date: string;
  templateId: string;
  name: string;
  state: SlotState;
  workoutId?: string;
}

export interface TrackedWeek {
  /** 1 pour la première semaine du cycle. */
  index: number;
  start: string;
  end: string;
  slots: WeekSlot[];
  /** Séances du programme faites cette semaine sans correspondre à une séance prévue. */
  extra: { date: string; name: string; workoutId: string }[];
  volumeKg: number;
  current: boolean;
  past: boolean;
}

export interface TrackingInput {
  program: Pick<Program, 'id' | 'startDate' | 'durationWeeks'>;
  templates: readonly WorkoutTemplate[];
  versions: readonly ProgramVersion[];
  workouts: readonly Workout[];
  sets: readonly WorkoutSet[];
  pulseDays: readonly PulseDay[];
  today: string;
}

/**
 * Les semaines du cycle, de la première à la dernière prévue (ou à la suivante si la durée n'est pas fixée).
 * Une séance prévue est faite si une séance du même modèle est terminée dans la même semaine du cycle, quel que soit le jour.
 */
export function cycleWeeks(input: TrackingInput): TrackedWeek[] {
  const { program, today } = input;
  if (!program.startDate) return [];
  const current = currentSessions(input);
  const done = programWorkouts(program.id, input.workouts, input.templates);
  const grouped = setsByWorkout(input.sets);
  const pulseByDate = new Map(activeOnly(input.pulseDays).map((d) => [d.date, d]));
  const elapsed = Math.floor(Math.max(0, daysBetween(program.startDate, today)) / 7) + 1;
  const total = program.durationWeeks ? Math.max(program.durationWeeks, daysBetween(program.startDate, today) >= 0 ? elapsed : 0) : elapsed + 1;
  const weeks: TrackedWeek[] = [];
  for (let i = 0; i < total; i++) {
    const start = addDays(program.startDate, 7 * i);
    const end = addDays(start, 6);
    const inWeek = done.filter((w) => w.date >= start && w.date <= end).sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt));
    const used = new Set<string>();
    const slots: WeekSlot[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, d);
      const day = isoWeekday(date);
      for (const s of [...sessionsOn(date, input.versions, current)].sort((a, b) => a.name.localeCompare(b.name))) {
        if (!s.weekdays.includes(day)) continue;
        const match = inWeek.find((w) => !used.has(w.id) && w.templateId === s.templateId);
        if (match) {
          used.add(match.id);
          slots.push({ date, templateId: s.templateId, name: s.name, state: match.adjustment ? 'allegee' : 'faite', workoutId: match.id });
          continue;
        }
        const choice = pulseByDate.get(date)?.choice;
        const state: SlotState =
          date > today ? 'a-venir' : choice === 'deplacer' ? 'deplacee' : choice === 'remplacer' ? 'recuperation' : date === today ? 'aujourdhui' : 'manquee';
        slots.push({ date, templateId: s.templateId, name: s.name, state });
      }
    }
    const extra = inWeek.filter((w) => !used.has(w.id)).map((w) => ({ date: w.date, name: w.name, workoutId: w.id }));
    const volumeKg = inWeek.reduce((sum, w) => sum + workoutStats(w, grouped.get(w.id) ?? []).volumeKg, 0);
    weeks.push({ index: i + 1, start, end, slots, extra, volumeKg, current: today >= start && today <= end, past: end < today });
  }
  return weeks;
}

function currentSessions(input: TrackingInput): Session[] {
  return activeOnly(input.templates)
    .filter((t) => t.programId === input.program.id)
    .map((t) => ({ templateId: t.id, name: t.name, weekdays: t.weekdays }));
}

export interface Adherence {
  /** Séances prévues jusqu'à aujourd'hui (celles du jour seulement si elles sont faites). */
  planned: number;
  done: number;
  lightened: number;
  /** Récupération active choisie avec PULSE à la place : ni due, ni manquée. */
  recovered: number;
  extra: number;
  /** Faites sur prévues, en pour cent ; null sans séance prévue encore. */
  rate: number | null;
}

/**
 * Régularité du cycle : les séances prévues faites (allégées comprises), sur celles qui étaient dues.
 * Une récupération active choisie avec PULSE n'est pas comptée comme due : récupérer ne coûte rien.
 */
export function adherence(weeks: readonly TrackedWeek[]): Adherence {
  let planned = 0;
  let done = 0;
  let lightened = 0;
  let recovered = 0;
  let extra = 0;
  for (const w of weeks) {
    for (const s of w.slots) {
      if (s.state === 'a-venir' || s.state === 'aujourdhui') continue;
      if (s.state === 'recuperation') {
        recovered += 1;
        continue;
      }
      planned += 1;
      if (s.state === 'faite' || s.state === 'allegee') done += 1;
      if (s.state === 'allegee') lightened += 1;
    }
    extra += w.extra.length;
  }
  return { planned, done, lightened, recovered, extra, rate: planned ? Math.round((done / planned) * 100) : null };
}

export interface MuscleProgress {
  muscle: MuscleGroup;
  /** Séries directes faites cette semaine du cycle (ou de calendrier sans cycle). */
  done: number;
  /** Séries directes prévues par semaine par le programme. */
  planned: number;
}

/** Séries directes par muscle : prévues par semaine dans le programme, et faites sur la période donnée. */
export function musclePlanVsDone(
  templates: readonly WorkoutTemplate[],
  programId: string,
  workouts: readonly Workout[],
  sets: readonly WorkoutSet[],
  resolve: MuscleResolver,
  from: string,
  to: string,
): MuscleProgress[] {
  const planned = new Map<MuscleGroup, number>();
  for (const t of activeOnly(templates).filter((x) => x.programId === programId)) {
    for (const e of t.exercises) {
      const m = resolve(e.exerciseId)?.muscle;
      if (m) planned.set(m, (planned.get(m) ?? 0) + e.sets * t.weekdays.length);
    }
  }
  const done = muscleVolumeBetween(workouts, sets, resolve, from, to).muscles;
  return MUSCLE_GROUPS.map((m) => ({ muscle: m, planned: planned.get(m) ?? 0, done: done[m].directSets })).filter((x) => x.planned > 0 || x.done > 0);
}

export interface ExerciseProgress {
  exerciseId: string;
  sessions: number;
  firstE1rm: number;
  lastE1rm: number;
  bestE1rm: number;
  /** Écart entre la première et la meilleure séance du cycle, en pour cent. */
  change: number;
  trend: TrendKind;
}

/**
 * Progression des exercices du programme sur ses séances : 1RM estimé de la première séance et meilleur depuis.
 * Seulement à partir de 2 séances avec une charge (le poids du corps sans lest ne se compare pas ainsi).
 */
export function exerciseProgress(exerciseIds: readonly string[], workouts: readonly Workout[], sets: readonly WorkoutSet[]): ExerciseProgress[] {
  const out: ExerciseProgress[] = [];
  for (const id of new Set(exerciseIds)) {
    const sessions = exerciseSessions(id, workouts, sets).filter((s) => s.e1rmKg > 0);
    if (sessions.length < 2) continue;
    const first = sessions[0]!.e1rmKg;
    const best = Math.max(...sessions.map((s) => s.e1rmKg));
    out.push({
      exerciseId: id,
      sessions: sessions.length,
      firstE1rm: first,
      lastE1rm: sessions.at(-1)!.e1rmKg,
      bestE1rm: best,
      change: Math.round(((best - first) / first) * 1000) / 10,
      trend: exerciseTrend(sessions).kind,
    });
  }
  return out.sort((a, b) => b.change - a.change);
}

/** Records battus pendant les séances du programme (comparés à tout l'historique, pas seulement au programme). */
export function programRecords(programWorkoutIds: ReadonlySet<string>, workouts: readonly Workout[], sets: readonly WorkoutSet[], from: string | null): PersonalRecord[] {
  return findRecords(workouts, sets).filter((r) => programWorkoutIds.has(r.workoutId) && (!from || r.date >= from));
}

export type HistoryEntry =
  { kind: 'version'; date: string; version: number; versionId: string; text: string } | { kind: 'pulse'; date: string; session: string | null; text: string };

/**
 * Historique du programme : ses versions, et les choix faits sur proposition de PULSE pour ses séances
 * (allégée, récupération active à la place, déplacée), du plus récent au plus ancien.
 */
export function programHistory(
  programId: string,
  versions: readonly ProgramVersion[],
  pulseDays: readonly PulseDay[],
  templates: readonly WorkoutTemplate[],
  from: string | null,
): HistoryEntry[] {
  const names = new Map(templates.filter((t) => t.programId === programId).map((t) => [t.id, t.name]));
  const entries: HistoryEntry[] = [];
  for (const v of activeOnly(versions)) {
    if (v.programId !== programId) continue;
    entries.push({ kind: 'version', date: v.createdAt.slice(0, 10), version: v.version, versionId: v.id, text: v.changeSummary });
  }
  for (const d of activeOnly(pulseDays)) {
    if (!d.plannedTemplateId || !names.has(d.plannedTemplateId) || (from && d.date < from)) continue;
    if (!d.choice || d.choice === 'garder') continue;
    const last = [...(d.decisions ?? [])].reverse().find((x) => x.action !== 'annuler' && x.choice === d.choice);
    entries.push({ kind: 'pulse', date: d.date, session: names.get(d.plannedTemplateId) ?? null, text: last ? decisionText(last) : `Choix : ${d.choice}` });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date) || (a.kind === b.kind ? 0 : a.kind === 'version' ? -1 : 1));
}
