import { activeOnly, weekStart } from '../training';
import { addDays } from '../../lib/dates';
import { LEVEL_SETTINGS as S } from './settings';
import { finishedCycle, weekRespected, type LevelModel, type XpEvent } from './xp';

/**
 * Badges : chacun est débloqué à la date de la donnée qui remplit sa condition. Recalculables, jamais gagnés deux fois.
 * Aucun ne dépend du volume ou de la durée seuls, sauf les deux paliers de tonnage, rares, qui récompensent un cumul.
 */

export type BadgeCategory = 'force' | 'regularite' | 'endurance' | 'mind' | 'programs' | 'special';
export type BadgeRarity = 'commun' | 'rare';

export interface BadgeDef {
  id: string;
  name: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  /** Ce qu'il faut faire, affiché tant que le badge n'est pas débloqué. */
  condition: string;
}

export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  force: 'Force',
  regularite: 'Régularité',
  endurance: 'Endurance',
  mind: 'Mind',
  programs: 'Programmes',
  special: 'Spécial',
};

const B = S.badges;
const t = (kg: number) => `${kg / 1000} tonnes`;

export const BADGES: readonly BadgeDef[] = [
  { id: 'premier-record', name: 'Premier record', category: 'force', rarity: 'commun', condition: 'Bats ton 1RM estimé sur un exercice.' },
  ...B.loadSteps.map((kg): BadgeDef => ({
    id: `charge-${kg}`,
    name: `${kg} kg`,
    category: 'force',
    rarity: kg >= 140 ? 'rare' : 'commun',
    condition: `Soulève ${kg} kg sur un exercice polyarticulaire.`,
  })),
  { id: 'plus-10', name: '+10 %', category: 'force', rarity: 'commun', condition: 'Améliore de 10 % ton 1RM estimé sur un exercice, depuis ta première séance.' },
  { id: 'premiere-semaine', name: 'Première semaine complète', category: 'regularite', rarity: 'commun', condition: 'Fais toutes les séances prévues d’une semaine.' },
  ...B.activeWeeks.map((n): BadgeDef => ({
    id: `actif-${n}`,
    name: `${n} semaines actives`,
    category: 'regularite',
    rarity: n >= 12 ? 'rare' : 'commun',
    condition: `Entraîne-toi au moins une fois par semaine, ${n} semaines d’affilée.`,
  })),
  { id: `seances-${B.sessions}`, name: `${B.sessions} séances`, category: 'regularite', rarity: 'rare', condition: `Termine ${B.sessions} séances.` },
  { id: 'premier-cardio', name: 'Première séance cardio', category: 'endurance', rarity: 'commun', condition: 'Note une séance de cardio dans le journal d’activité.' },
  { id: 'record-duree', name: 'Record de durée', category: 'endurance', rarity: 'commun', condition: 'Fais une séance de cardio plus longue que toutes les précédentes.' },
  { id: 'premiere-routine', name: 'Première routine', category: 'mind', rarity: 'commun', condition: 'Termine une routine Mind.' },
  { id: `routines-${B.routines}`, name: `${B.routines} routines`, category: 'mind', rarity: 'commun', condition: `Termine ${B.routines} routines Mind.` },
  {
    id: 'serie-mind',
    name: 'Série Mind',
    category: 'mind',
    rarity: 'rare',
    condition: `Pratique Mind ${B.mindStreak.daysPerWeek} jours sur 7, ${B.mindStreak.weeks} semaines d’affilée.`,
  },
  {
    id: 'programme-respecte',
    name: 'Programme respecté',
    category: 'programs',
    rarity: 'commun',
    condition: `Fais toutes les séances prévues ${B.programWeeks} semaines d’affilée.`,
  },
  { id: 'premier-cycle', name: 'Premier cycle terminé', category: 'programs', rarity: 'rare', condition: 'Termine un cycle avec 80 % des séances prévues ou plus.' },
  { id: 'tonnes-seance', name: `${t(B.sessionTonnes)} en une séance`, category: 'special', rarity: 'rare', condition: `Soulève ${t(B.sessionTonnes)} au total en une séance.` },
  { id: 'tonnes-total', name: `${t(B.totalTonnes)} au total`, category: 'special', rarity: 'rare', condition: `Cumule ${t(B.totalTonnes)} soulevées depuis le début.` },
];

export interface BadgeUnlock {
  id: string;
  date: string;
  /** Ce qui l'a débloqué, en une phrase. */
  detail: string;
}

const firstBy = <T>(list: readonly T[], test: (x: T) => boolean) => list.find(test);

/** Semaines du lundi au dimanche d'affilée avec au moins une séance : date où la série atteint `n` semaines. */
function streakDate(weeks: readonly string[], firstDateOf: Map<string, string>, n: number): string | null {
  let run = 0;
  let prev: string | null = null;
  for (const w of weeks) {
    run = prev && addDays(prev, 7) === w ? run + 1 : 1;
    prev = w;
    if (run >= n) return firstDateOf.get(w)!;
  }
  return null;
}

export function badgeUnlocks(m: LevelModel): BadgeUnlock[] {
  const { input, done } = m;
  const out: BadgeUnlock[] = [];
  const add = (id: string, date: string | null | undefined, detail: string) => {
    if (date && date <= input.today) out.push({ id, date, detail });
  };
  const nameOf = (id: string) => input.exercises.find((e) => e.id === id)?.name ?? 'un exercice';

  // Force
  const firstRecord = m.records[0];
  if (firstRecord) add('premier-record', firstRecord.date, `${nameOf(firstRecord.exerciseId)}, ${firstRecord.weightKg} kg × ${firstRecord.reps}.`);
  for (const kg of B.loadSteps) {
    let hit: { date: string; exerciseId: string } | null = null;
    for (const w of done) {
      const s = firstBy(m.setsOf.get(w.id) ?? [], (x) => x.weightKg >= kg && m.isCompound(x.exerciseId));
      if (s) {
        hit = { date: w.date, exerciseId: s.exerciseId };
        break;
      }
    }
    if (hit) add(`charge-${kg}`, hit.date, `${nameOf(hit.exerciseId)}.`);
  }
  let gain: { date: string; exerciseId: string } | null = null;
  for (const [exerciseId, list] of m.sessions) {
    const first = list[0]!.e1rmKg;
    if (first <= 0) continue;
    const s = list.find((x) => x.e1rmKg >= first * (1 + B.e1rmGain));
    if (s && (!gain || s.date < gain.date)) gain = { date: s.date, exerciseId };
  }
  if (gain) add('plus-10', gain.date, `${nameOf(gain.exerciseId)}.`);

  // Régularité
  const respected = m.programWeeks
    .flatMap(({ weeks }) => weeks.map(weekRespected))
    .filter((r) => r.ok)
    .map((r) => r.date!)
    .sort();
  add('premiere-semaine', respected[0], 'Toutes les séances prévues de la semaine.');
  const firstDateOf = new Map<string, string>();
  for (const w of done) if (!firstDateOf.has(weekStart(w.date))) firstDateOf.set(weekStart(w.date), w.date);
  const activeWeeks = [...firstDateOf.keys()].sort();
  for (const n of B.activeWeeks) add(`actif-${n}`, streakDate(activeWeeks, firstDateOf, n), `${n} semaines d’affilée avec au moins une séance.`);
  add(`seances-${B.sessions}`, done[B.sessions - 1]?.date, `${B.sessions}e séance terminée.`);

  // Endurance
  const cardio = activeOnly(input.activities)
    .filter((a) => a.kind === 'cardio' && a.date <= input.today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  if (cardio[0]) add('premier-cardio', cardio[0].date, `${cardio[0].minutes} min.`);
  let longest = cardio[0]?.minutes ?? 0;
  for (const a of cardio.slice(1)) {
    if (a.minutes > longest) {
      add('record-duree', a.date, `${a.minutes} min, contre ${longest} avant.`);
      break;
    }
    longest = Math.max(longest, a.minutes);
  }

  // Mind
  const mind = activeOnly(input.mindSessions)
    .filter((s) => s.completed && s.date <= input.today)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const routines = mind.filter((s) => s.kind === 'routine');
  if (routines[0]) add('premiere-routine', routines[0].date, routines[0].title);
  add(`routines-${B.routines}`, routines[B.routines - 1]?.date, `${B.routines}e routine terminée.`);
  const mindDays = new Map<string, Set<string>>();
  for (const s of mind) mindDays.set(weekStart(s.date), (mindDays.get(weekStart(s.date)) ?? new Set()).add(s.date));
  const fullWeeks = [...mindDays]
    .filter(([, days]) => days.size >= B.mindStreak.daysPerWeek)
    .map(([w]) => w)
    .sort();
  const reachedOn = new Map(fullWeeks.map((w) => [w, [...mindDays.get(w)!].sort()[B.mindStreak.daysPerWeek - 1]!]));
  add('serie-mind', streakDate(fullWeeks, reachedOn, B.mindStreak.weeks), `${B.mindStreak.daysPerWeek} jours sur 7, ${B.mindStreak.weeks} semaines d’affilée.`);

  // Programmes
  let programStreak: string | null = null;
  for (const { weeks } of m.programWeeks) {
    let run = 0;
    for (const w of weeks) {
      const r = weekRespected(w);
      run = r.ok ? run + 1 : 0;
      if (run >= B.programWeeks && (!programStreak || r.date! < programStreak)) {
        programStreak = r.date!;
        break;
      }
    }
  }
  add('programme-respecte', programStreak, `${B.programWeeks} semaines d’affilée avec toutes les séances prévues.`);
  const cycles = m.programWeeks
    .map(({ program, weeks }) => ({ program, c: finishedCycle(program, weeks, input.today) }))
    .filter((x) => x.c && x.c.rate >= S.xp.cycle.minRate)
    .sort((a, b) => a.c!.date.localeCompare(b.c!.date));
  if (cycles[0]) add('premier-cycle', cycles[0].c!.date, `${cycles[0].program.name}, ${Math.round(cycles[0].c!.rate * 100)} % des séances.`);

  // Spécial : tonnage
  let total = 0;
  let sessionDone = false;
  let totalDone = false;
  for (const w of done) {
    const v = (m.setsOf.get(w.id) ?? []).reduce((n, s) => n + s.weightKg * s.reps, 0);
    total += v;
    if (!sessionDone && v >= B.sessionTonnes) {
      add('tonnes-seance', w.date, `${w.name}, ${String(Math.round(v / 100) / 10).replace('.', ',')} tonnes.`);
      sessionDone = true;
    }
    if (!totalDone && total >= B.totalTonnes) {
      add('tonnes-total', w.date, `Atteint pendant « ${w.name} ».`);
      totalDone = true;
    }
  }
  return out;
}

/** L'XP des badges débloqués : 50 pour un commun, 200 pour un rare. */
export function badgeXp(unlocks: readonly BadgeUnlock[]): XpEvent[] {
  return unlocks.map((u) => {
    const def = BADGES.find((b) => b.id === u.id)!;
    return { key: `badge:${u.id}`, date: u.date, kind: 'badge', xp: S.xp.badge[def.rarity], label: `Badge : ${def.name}` };
  });
}
