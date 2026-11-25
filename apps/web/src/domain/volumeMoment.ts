import type { Workout, WorkoutSet } from '../db/types';
import { formatDayMonthLong, formatNumber } from '../lib/format';
import { activeOnly, setsByWorkout, setVolume } from './training';

/**
 * Le volume d'une séance raconté : ce qu'elle pèse, ce qu'elle bat, ce qu'elle franchit.
 * Tout vient des séances et séries enregistrées ; une comparaison sans donnée n'est jamais affichée.
 * Volume = Σ charge × répétitions (comme partout dans FORGE).
 */

/** Paliers d'une séance, en kg : premier passage au-dessus. */
export const SESSION_MILESTONES = [1_000, 2_500, 5_000, 7_500, 10_000, 12_500, 15_000, 20_000, 25_000, 30_000, 40_000, 50_000] as const;
/** Paliers du total soulevé depuis la première séance, en kg. */
export const LIFETIME_MILESTONES = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000] as const;
/** En dessous de cet écart relatif, deux séances sont « au même niveau ». */
export const SAME_LEVEL = 0.02;
/** Nombre de séances du même type montrées dans le graphique. */
export const HISTORY_LENGTH = 8;

export interface BrickSet {
  id: string;
  volumeKg: number;
  /** Total cumulé de la séance à la fin de cette série (ordre des exercices, puis des séries). */
  untilKg: number;
}

export interface ExerciseVolume {
  exerciseId: string;
  volumeKg: number;
  sets: BrickSet[];
}

export interface PastSession {
  id: string;
  date: string;
  volumeKg: number;
}

export interface VolumeMoment {
  volumeKg: number;
  /** Séance pas encore terminée : le total grandit encore. */
  live: boolean;
  /** Séance la plus récente de toutes : sinon, les records sont « ce jour-là ». */
  latest: boolean;
  /** Séance allégée acceptée dans PULSE. */
  lightened: boolean;
  /** Par exercice, dans l'ordre de la séance ; les séries au poids du corps n'y figurent pas. */
  exercises: ExerciseVolume[];
  bodyweightSets: number;
  /** Séances avec du volume avant celle-ci, toutes confondues. */
  earlierCount: number;
  /** Séances du même type avant celle-ci. */
  sameTypeCount: number;
  /** Meilleur volume avant cette séance, toutes séances confondues. */
  bestBefore: PastSession | null;
  /** Meilleur volume avant cette séance, même type de séance. */
  bestSameTypeBefore: PastSession | null;
  /** Dernière séance du même type avant celle-ci. */
  previous: PastSession | null;
  /** Record battu : toutes séances, ou séance du même type. */
  record: 'toutes' | 'type' | null;
  /** Palier d'une séance franchi pour la première fois (le plus haut). */
  milestoneKg: number | null;
  /** Total depuis la première séance, celle-ci comprise. */
  lifetimeKg: number;
  lifetimeSessions: number;
  /** Palier du total franchi grâce à cette séance. */
  lifetimeMilestoneKg: number | null;
  /** Séances du même type, de la plus ancienne à celle-ci comprise (au plus HISTORY_LENGTH). */
  history: PastSession[];
}

const chrono = (a: Workout, b: Workout) => (a.date === b.date ? a.startedAt.localeCompare(b.startedAt) : a.date.localeCompare(b.date));
const norm = (s: string) => s.trim().toLocaleLowerCase('fr-FR');

/** Même type de séance : même modèle du programme, sinon même nom. */
export function sameType(a: Workout, b: Workout): boolean {
  if (a.templateId && b.templateId) return a.templateId === b.templateId;
  return norm(a.name) === norm(b.name);
}

const best = (list: PastSession[]) => list.reduce<PastSession | null>((m, s) => (m === null || s.volumeKg > m.volumeKg ? s : m), null);
const crossed = (thresholds: readonly number[], before: number, after: number) => [...thresholds].reverse().find((t) => before < t && t <= after) ?? null;

export function volumeMoment(workout: Workout, allWorkouts: readonly Workout[], allSets: readonly WorkoutSet[]): VolumeMoment {
  const bySession = setsByWorkout(allSets);
  const mine = bySession.get(workout.id) ?? [];
  const order = [...new Set([...workout.exerciseIds, ...mine.map((s) => s.exerciseId)])];

  let running = 0;
  const exercises: ExerciseVolume[] = [];
  for (const exerciseId of order) {
    const sets: BrickSet[] = [];
    for (const s of mine.filter((x) => x.exerciseId === exerciseId)) {
      const v = setVolume(s);
      if (v <= 0) continue;
      running += v;
      sets.push({ id: s.id, volumeKg: v, untilKg: running });
    }
    if (sets.length) exercises.push({ exerciseId, volumeKg: sets.reduce((sum, s) => sum + s.volumeKg, 0), sets });
  }
  const volumeKg = Math.round(running);

  const sessions = activeOnly(allWorkouts)
    .filter((w) => w.id !== workout.id)
    .map((w) => ({ w, volumeKg: Math.round((bySession.get(w.id) ?? []).reduce((sum, s) => sum + setVolume(s), 0)) }))
    .filter((x) => x.volumeKg > 0);
  const earlier = sessions.filter((x) => chrono(x.w, workout) < 0).sort((a, b) => chrono(a.w, b.w));
  const later = sessions.filter((x) => chrono(x.w, workout) > 0);
  const past = (x: { w: Workout; volumeKg: number }): PastSession => ({ id: x.w.id, date: x.w.date, volumeKg: x.volumeKg });

  const earlierAll = earlier.map(past);
  const earlierSame = earlier.filter((x) => sameType(x.w, workout)).map(past);
  const bestBefore = best(earlierAll);
  const bestSameTypeBefore = best(earlierSame);
  const record = bestBefore && volumeKg > bestBefore.volumeKg ? 'toutes' : bestSameTypeBefore && volumeKg > bestSameTypeBefore.volumeKg ? 'type' : null;
  const lifetimeBefore = earlierAll.reduce((sum, s) => sum + s.volumeKg, 0);
  const lifetimeKg = lifetimeBefore + volumeKg;

  return {
    volumeKg,
    live: !workout.endedAt,
    latest: later.length === 0,
    lightened: Boolean(workout.adjustment),
    exercises,
    bodyweightSets: mine.filter((s) => setVolume(s) <= 0).length,
    earlierCount: earlierAll.length,
    sameTypeCount: earlierSame.length,
    bestBefore,
    bestSameTypeBefore,
    previous: earlierSame.at(-1) ?? null,
    record: volumeKg > 0 ? record : null,
    milestoneKg: earlierAll.length && volumeKg > 0 ? crossed(SESSION_MILESTONES, bestBefore?.volumeKg ?? 0, volumeKg) : null,
    lifetimeKg,
    lifetimeSessions: earlierAll.length + (volumeKg > 0 ? 1 : 0),
    lifetimeMilestoneKg: earlierAll.length && volumeKg > 0 ? crossed(LIFETIME_MILESTONES, lifetimeBefore, lifetimeKg) : null,
    history: [...earlierSame, { id: workout.id, date: workout.date, volumeKg }].slice(-HISTORY_LENGTH),
  };
}

// ---------------------------------------------------------------------------
// Textes

const kg = (v: number) => `${formatNumber(Math.round(v), 0)} kg`;

/** 5 000 → « 5 tonnes », 2 500 → « 2,5 tonnes », 1 000 → « 1 tonne ». */
export function tonnes(valueKg: number): string {
  const t = valueKg / 1000;
  const text = formatNumber(t, Number.isInteger(t) ? 0 : t * 10 === Math.round(t * 10) ? 1 : 2);
  return `${text} tonne${t >= 2 ? 's' : ''}`;
}

/** Total en tonnes pour les grands nombres : 148 230 → « 148 t » ; en kg en dessous de 10 t. */
export function heavy(valueKg: number): string {
  return valueKg >= 10_000 ? `${formatNumber(valueKg / 1000, valueKg >= 100_000 ? 0 : 1)} t` : kg(valueKg);
}

/** Choix stable d'une formulation pour une séance donnée (même séance, même texte ; séances différentes, textes variés). */
export function pick<T>(options: readonly T[], seed: string): T {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return options[(h >>> 0) % options.length]!;
}

/** Phrases d'identité FORGE : l'état d'esprit, pas un chiffre. */
export const IDENTITY_LINES = [
  'Chaque répétition compte. Chaque série construit quelque chose. Tu n’as pas simplement terminé une séance : tu as investi dans la personne que tu veux devenir.',
  'La force ne tombe pas du ciel. Elle se forge, série après série, séance après séance.',
  'Ce travail ne se voit pas tout de suite. Il s’accumule, et c’est exactement comme ça que tout change.',
  'Tu es venu, tu as soulevé, c’est enregistré. La suite se construit sur ce que tu viens de faire.',
  'La régularité bat l’intensité. Une séance de plus au compteur, c’est une preuve de plus.',
  'Ce n’est pas le poids d’un jour qui change tout. C’est le poids de toutes les séances mises bout à bout.',
  'Personne ne soulève à ta place. Ce total, il est entièrement à toi.',
] as const;

export interface VolumeFact {
  value: string;
  label: string;
}

export interface VolumeTexts {
  /** « Tu as déplacé » ou, en cours de séance, « Tu as déjà déplacé ». */
  lead: string;
  /** Phrase qui dit ce que la séance représente, d'après les données. */
  hook: string;
  identity: string;
  /** Marques courtes affichées sous le chiffre. */
  badges: { kind: 'record' | 'palier'; text: string }[];
  facts: VolumeFact[];
  /** Note sous le total quand des séries au poids du corps n'y entrent pas. */
  footnote: string;
}

export function volumeTexts(m: VolumeMoment, name: string, seed: string): VolumeTexts {
  const v = (options: readonly string[]) => pick(options, `${seed}:${options[0]}`);
  const delta = m.previous ? m.volumeKg - m.previous.volumeKg : null;
  const ratio = m.previous && delta !== null ? delta / m.previous.volumeKg : null;
  const prevDate = m.previous ? formatDayMonthLong(m.previous.date) : '';

  const badges: VolumeTexts['badges'] = [];
  if (m.record && !m.live) badges.push({ kind: 'record', text: m.record === 'toutes' ? 'Record de volume' : `Record ${name}` });
  if (m.milestoneKg && !m.live) badges.push({ kind: 'palier', text: `Palier ${tonnes(m.milestoneKg)}` });

  let hook: string;
  if (m.live) {
    if (m.previous && delta !== null && delta < 0) hook = `Encore ${kg(-delta)} pour égaler ta dernière séance ${name}.`;
    else if (m.previous && delta === 0) hook = `Tu égales déjà ta dernière séance ${name}.`;
    else if (m.previous && delta !== null) hook = v([`Tu as déjà dépassé ta dernière séance ${name}.`, `Ta dernière séance ${name} est déjà derrière toi.`]);
    else hook = v(['Chaque série ajoute à ce total.', 'Le total grandit à chaque série. Continue.']);
  } else if (m.earlierCount === 0) {
    hook = v(['Première séance dans FORGE. Le premier chiffre d’une longue série.', 'Ta première séance est enregistrée. C’est ton point de départ.']);
  } else if (m.record === 'toutes') {
    const gain = kg(m.volumeKg - m.bestBefore!.volumeKg);
    hook = m.latest
      ? v([
          `Nouveau record de volume. Ta plus grosse séance à ce jour.`,
          `Jamais tu n’avais autant soulevé en une séance : +${gain} sur ton ancien record.`,
          `Record battu de ${gain}. Le travail paie.`,
        ])
      : `Record de volume ce jour-là : ta plus grosse séance jusque-là.`;
  } else if (m.record === 'type') {
    hook = m.latest
      ? v([`Ta meilleure séance ${name} à ce jour.`, `Record sur ${name} : +${kg(m.volumeKg - m.bestSameTypeBefore!.volumeKg)} sur ton meilleur total.`])
      : `Ta meilleure séance ${name} jusque-là.`;
  } else if (m.milestoneKg) {
    hook = `Premier passage au-dessus de ${tonnes(m.milestoneKg)} en une séance.`;
  } else if (m.lifetimeMilestoneKg) {
    hook = `Avec cette séance, tu passes les ${tonnes(m.lifetimeMilestoneKg)} soulevées depuis ta première séance.`;
  } else if (m.lightened) {
    hook = 'Version allégée, comme prévu. Récupérer fait aussi partie du travail.';
  } else if (ratio !== null && ratio >= SAME_LEVEL) {
    hook = v([
      'Le travail est fait. La progression aussi.',
      `Plus que ta dernière séance ${name}. C’est exactement ce qu’on cherche.`,
      `+${kg(delta!)} sur ta dernière séance ${name}. Ça avance.`,
    ]);
  } else if (ratio !== null && ratio > -SAME_LEVEL) {
    hook = v(['Au même niveau que la dernière fois. La constance construit.', 'Aussi solide que ta dernière séance. Tenir, c’est déjà progresser.']);
  } else if (ratio !== null) {
    hook = v([
      'Moins de volume que la dernière fois. Une séance plus légère te garde dans le mouvement.',
      'Pas ton plus gros total, mais tu es venu. C’est ce qui compte sur la durée.',
    ]);
  } else {
    hook = v([`Première séance ${name} enregistrée : voilà ta référence.`, `Ta référence sur ${name} est posée. La prochaine fois, tu sauras quoi viser.`]);
  }

  const facts: VolumeFact[] = [];
  if (m.previous && delta !== null && !m.live) {
    const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
    facts.push({ value: `${sign}${kg(Math.abs(delta))}`, label: `par rapport à ta séance ${name} du ${prevDate} (${kg(m.previous.volumeKg)})` });
  }
  const beaten = m.record === 'toutes' ? m.bestBefore : m.record === 'type' ? m.bestSameTypeBefore : null;
  // L'ancien record n'est rappelé que s'il ne s'agit pas déjà de la séance comparée juste au-dessus.
  if (beaten && !m.live && beaten.id !== m.previous?.id) {
    facts.push({ value: kg(beaten.volumeKg), label: `${m.record === 'toutes' ? 'ancien record' : `ancien record ${name}`}, le ${formatDayMonthLong(beaten.date)}` });
  }
  if (m.lifetimeSessions >= 2) facts.push({ value: heavy(m.lifetimeKg), label: `soulevés depuis ta première séance, en ${m.lifetimeSessions} séances` });

  const footnote =
    m.bodyweightSets > 0
      ? `Volume : charge × répétitions de chaque série. ${m.bodyweightSets === 1 ? 'La série' : `Les ${m.bodyweightSets} séries`} au poids du corps n’y ${m.bodyweightSets === 1 ? 'entre' : 'entrent'} pas.`
      : 'Volume : charge × répétitions de chaque série.';

  return { lead: m.live ? 'Tu as déjà déplacé' : 'Tu as déplacé', hook, identity: pick(IDENTITY_LINES, seed), badges, facts, footnote };
}
