import type { MuscleGroup } from '../../data/muscles';
import { addDays } from '../../lib/dates';
import type { MuscleResolver } from '../muscleVolume';
import { activeOnly, weekStart } from '../training';
import { BADGES, type BadgeUnlock } from './badges';
import { characteristicsAt, CHARACTERISTIC_ORDER, type CharacteristicKey } from './characteristics';
import type { LevelState } from './level';
import { LEVEL_SETTINGS as S } from './settings';
import { weekRespected, type LevelModel, type XpEvent, type XpKind } from './xp';

/**
 * FORGE LEVEL, livraison 2 : l'historique (notes semaine par semaine, XP par semaine, frise des étapes),
 * la progression vers les badges, et ce qu'il reste à annoncer depuis la dernière visite.
 */

export interface CharacteristicPoint {
  date: string;
  scores: Record<CharacteristicKey, number | null>;
}

/** Les notes en fin de chaque semaine des `weeks` dernières, de la plus ancienne à aujourd'hui. */
export function characteristicHistory(m: LevelModel, resolve: MuscleResolver, muscles: readonly MuscleGroup[], weeks = 12): CharacteristicPoint[] {
  const today = m.input.today;
  return Array.from({ length: weeks }, (_, i) => {
    const date = i === weeks - 1 ? today : addDays(weekStart(today), -7 * (weeks - 1 - i) + 6);
    const raw = characteristicsAt(m, date, resolve, muscles);
    const scores = Object.fromEntries(CHARACTERISTIC_ORDER.map((k) => [k, raw.find((c) => c.key === k)?.score ?? null])) as Record<CharacteristicKey, number | null>;
    return { date, scores };
  });
}

export interface XpWeek {
  weekStart: string;
  xp: number;
  byKind: Partial<Record<XpKind, number>>;
}

/** L'XP gagnée chaque semaine (du lundi au dimanche), les `weeks` dernières, la plus ancienne d'abord. */
export function xpByWeek(events: readonly XpEvent[], today: string, weeks = 12): XpWeek[] {
  const last = weekStart(today);
  const out: XpWeek[] = Array.from({ length: weeks }, (_, i) => ({ weekStart: addDays(last, -7 * (weeks - 1 - i)), xp: 0, byKind: {} }));
  const index = new Map(out.map((w) => [w.weekStart, w]));
  for (const e of events) {
    const w = index.get(weekStart(e.date));
    if (!w) continue;
    w.xp += e.xp;
    w.byKind[e.kind] = (w.byKind[e.kind] ?? 0) + e.xp;
  }
  return out;
}

export type TimelineEntry =
  | { kind: 'niveau'; date: string; level: number }
  | { kind: 'badge'; date: string; badgeId: string; detail: string }
  | { kind: 'record'; date: string; key: string; label: string }
  | { kind: 'cycle'; date: string; key: string; label: string };

/** La frise de FORGE LEVEL : passages de niveau, badges, records et cycles terminés, du plus récent au plus ancien. */
export function timeline(state: LevelState): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...state.levelUps.map((l): TimelineEntry => ({ kind: 'niveau', date: l.date, level: l.level })),
    ...state.unlocks.map((u): TimelineEntry => ({ kind: 'badge', date: u.date, badgeId: u.id, detail: u.detail })),
    ...state.events
      .filter((e) => e.kind === 'record' || e.kind === 'cycle')
      .map((e): TimelineEntry => ({ kind: e.kind as 'record' | 'cycle', date: e.date, key: e.key, label: e.label })),
  ];
  const rank: Record<TimelineEntry['kind'], number> = { niveau: 0, cycle: 1, badge: 2, record: 3 };
  return entries.sort((a, b) => b.date.localeCompare(a.date) || rank[a.kind] - rank[b.kind]);
}

export interface BadgeProgress {
  value: number;
  target: number;
  /** « 46 séances sur 100 ». */
  text: string;
}

const fr = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Où tu en es pour les badges qui se comptent, tant qu'ils ne sont pas débloqués. */
export function badgeProgress(m: LevelModel, unlocks: readonly BadgeUnlock[]): Map<string, BadgeProgress> {
  const B = S.badges;
  const done = new Set(unlocks.map((u) => u.id));
  const out = new Map<string, BadgeProgress>();
  const set = (id: string, value: number, target: number, text: string) => {
    if (!done.has(id) && BADGES.some((b) => b.id === id)) out.set(id, { value: Math.min(value, target), target, text });
  };
  set(`seances-${B.sessions}`, m.done.length, B.sessions, `${m.done.length} séances sur ${B.sessions}`);

  const routines = activeOnly(m.input.mindSessions).filter((s) => s.completed && s.kind === 'routine' && s.date <= m.input.today).length;
  set(`routines-${B.routines}`, routines, B.routines, `${routines} routine${routines > 1 ? 's' : ''} sur ${B.routines}`);

  const tonnes = m.sets.reduce((n, s) => n + s.weightKg * s.reps, 0);
  set('tonnes-total', tonnes, B.totalTonnes, `${fr(tonnes / 1000)} tonnes sur ${B.totalTonnes / 1000}`);

  let bestLoad = 0;
  for (const s of m.sets) if (m.isCompound(s.exerciseId) && s.weightKg > bestLoad) bestLoad = s.weightKg;
  for (const kg of B.loadSteps) set(`charge-${kg}`, bestLoad, kg, `Meilleure charge : ${fr(bestLoad)} kg sur ${kg}`);

  // Série en cours de semaines actives : la semaine en cours ne la casse pas tant qu'elle n'est pas finie.
  const active = new Set(m.done.map((w) => weekStart(w.date)));
  let streak = 0;
  let w = active.has(weekStart(m.input.today)) ? weekStart(m.input.today) : addDays(weekStart(m.input.today), -7);
  while (active.has(w)) {
    streak++;
    w = addDays(w, -7);
  }
  for (const n of B.activeWeeks) set(`actif-${n}`, streak, n, `${streak} semaine${streak > 1 ? 's' : ''} d’affilée sur ${n}`);

  let run = 0;
  for (const { program, weeks } of m.programWeeks) {
    if (!(program.status === 'actif' || program.active)) continue;
    let r = 0;
    for (const week of weeks) {
      if (week.slots.some((s) => s.state === 'a-venir' || s.state === 'aujourdhui') && !week.slots.some((s) => s.state === 'manquee')) continue;
      r = weekRespected(week).ok ? r + 1 : 0;
    }
    run = Math.max(run, r);
  }
  set('programme-respecte', run, B.programWeeks, `${run} semaine${run > 1 ? 's' : ''} respectée${run > 1 ? 's' : ''} d’affilée sur ${B.programWeeks}`);
  return out;
}

/** Ce que FORGE a déjà annoncé (gardé dans la table meta) : rien n'est annoncé deux fois. */
export interface LevelSeen {
  level: number;
  badges: string[];
  /** Records déjà annoncés, limités aux 30 derniers jours. */
  records: string[];
  at: string;
}

export const LEVEL_SEEN_KEY = 'levelSeen';
const RECORD_DAYS = 7;
const KEEP_RECORD_DAYS = 30;

export interface Announcement {
  /** Nouveau niveau atteint, avec l'ancien. */
  level: { from: number; to: number } | null;
  badges: BadgeUnlock[];
  records: XpEvent[];
  xp: number;
}

/**
 * Ce qu'il y a à annoncer depuis la dernière visite : un passage de niveau, des badges, des records des 7 derniers jours.
 * Sans visite enregistrée, rien n'est annoncé : tout l'historique passerait d'un coup.
 */
export function announcement(state: LevelState, seen: LevelSeen | null, today: string): Announcement | null {
  if (!seen) return null;
  const badges = state.unlocks.filter((u) => !seen.badges.includes(u.id));
  const since = addDays(today, -RECORD_DAYS + 1);
  const records = state.events.filter((e) => e.kind === 'record' && e.date >= since && !seen.records.includes(e.key));
  const level = state.progress.level > seen.level ? { from: seen.level, to: state.progress.level } : null;
  if (!level && !badges.length && !records.length) return null;
  const xp = [...records, ...state.events.filter((e) => e.kind === 'badge' && badges.some((b) => e.key === `badge:${b.id}`))].reduce((n, e) => n + e.xp, 0);
  return { level, badges, records, xp };
}

/** L'état « déjà annoncé » après avoir montré l'état actuel. */
export function seenFrom(state: LevelState, today: string, at: string): LevelSeen {
  const keep = addDays(today, -KEEP_RECORD_DAYS + 1);
  return {
    level: state.progress.level,
    badges: state.unlocks.map((u) => u.id),
    records: state.events.filter((e) => e.kind === 'record' && e.date >= keep).map((e) => e.key),
    at,
  };
}

/** Relit l'état « déjà annoncé » (il peut venir d'une sauvegarde) : douteux, il vaut absent. */
export function readSeen(v: unknown): LevelSeen | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.level !== 'number' || !Array.isArray(r.badges) || !Array.isArray(r.records)) return null;
  return {
    level: Math.max(1, Math.floor(r.level)),
    badges: r.badges.filter((x): x is string => typeof x === 'string'),
    records: r.records.filter((x): x is string => typeof x === 'string'),
    at: typeof r.at === 'string' ? r.at : '',
  };
}
