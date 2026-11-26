import type { MuscleGroup } from '../../data/muscles';
import { addDays, daysBetween } from '../../lib/dates';
import { muscleVolumeBetween, type MuscleResolver } from '../muscleVolume';
import { exerciseTrend } from '../progression';
import { activeOnly, weekStart } from '../training';
import { LEVEL_SETTINGS as S } from './settings';
import { weekRespected, weeksRate, type LevelModel } from './xp';

/**
 * Six caractéristiques, notées sur 100 sur les 12 dernières semaines : une convention FORGE, pas une mesure.
 * Sous le minimum de données, pas de note mais ce qu'il faut enregistrer. Au-dessus, une confiance selon la part
 * de semaines renseignées, et la variation sur 4 semaines expliquée par le facteur qui a le plus bougé.
 */

export type CharacteristicKey = 'force' | 'hypertrophie' | 'endurance' | 'regularite' | 'mobilite' | 'recuperation';
export type Confidence = 'faible' | 'moyenne' | 'elevee';

export const CHARACTERISTIC_LABELS: Record<CharacteristicKey, string> = {
  force: 'Force',
  hypertrophie: 'Hypertrophie',
  endurance: 'Endurance',
  regularite: 'Régularité',
  mobilite: 'Mobilité',
  recuperation: 'Récupération',
};

export const CHARACTERISTIC_ORDER: readonly CharacteristicKey[] = ['force', 'hypertrophie', 'endurance', 'regularite', 'mobilite', 'recuperation'];

export const CONFIDENCE_LABELS: Record<Confidence, string> = { faible: 'Confiance faible', moyenne: 'Confiance moyenne', elevee: 'Confiance élevée' };

/** Ce que mesure chaque note, en une phrase, sans prétendre plus. */
export const CHARACTERISTIC_TEXTS: Record<CharacteristicKey, string> = {
  force: 'Gain de 1RM estimé sur tes exercices polyarticulaires, et records récents.',
  hypertrophie: 'Volume par muscle dans le repère de 10 à 20 séries, séances faites et exercices en progression. Ne mesure pas le muscle.',
  endurance: 'Minutes de cardio par semaine face aux 150 min de l’OMS, et allongement des séances.',
  regularite: 'Semaines où les séances prévues sont faites, et semaines actives d’affilée. Les jours de repos ne comptent jamais contre toi.',
  mobilite: 'Séances de mobilité par semaine, face aux 2 à 3 conseillées par l’ACSM.',
  recuperation: 'Nuits de 7 h ou plus, check-ins remplis et pratiques Mind. Des comportements, pas un diagnostic.',
};

export interface Factor {
  label: string;
  /** De 0 à 100. */
  value: number;
  weight: number;
  /** La valeur mesurée, lisible. */
  detail: string;
}

export interface Characteristic {
  key: CharacteristicKey;
  score: number | null;
  confidence: Confidence | null;
  factors: Factor[];
  /** Sans note : ce qu'il faut enregistrer pour en avoir une. */
  missing: string | null;
  /** Variation sur 4 semaines et le facteur qui l'explique ; null sans note d'il y a 4 semaines. */
  change: { delta: number; factor: string } | null;
}

const C = S.characteristics;
const clamp = (v: number) => Math.max(0, Math.min(100, v));
const round = (v: number) => Math.round(v);
const pct = (v: number) => `${Math.round(v * 100)} %`;

function combine(factors: Factor[]): number {
  const total = factors.reduce((n, f) => n + f.weight, 0);
  return round(factors.reduce((n, f) => n + f.value * f.weight, 0) / total);
}

function confidenceFor(weeksWithData: number): Confidence {
  return weeksWithData >= C.confidence.high ? 'elevee' : weeksWithData >= C.confidence.medium ? 'moyenne' : 'faible';
}

/** Les semaines (lundis) de la fenêtre de 12 semaines se terminant le jour donné. */
function windowWeeks(today: string): string[] {
  const last = weekStart(today);
  return Array.from({ length: C.windowWeeks }, (_, i) => addDays(last, -7 * (C.windowWeeks - 1 - i)));
}

type Raw = Omit<Characteristic, 'change'>;
const insufficient = (key: CharacteristicKey, missing: string): Raw => ({ key, score: null, confidence: null, factors: [], missing });

function force(m: LevelModel, today: string, from: string): Raw {
  const F = C.force;
  const eligible: { gain: number }[] = [];
  let close = 0;
  for (const [exerciseId, list] of m.sessions) {
    if (!m.isCompound(exerciseId)) continue;
    const inWindow = list.filter((s) => s.date >= from && s.date <= today && s.e1rmKg > 0);
    if (inWindow.length >= F.minSessions) {
      const first = inWindow[0]!.e1rmKg;
      const best = Math.max(...inWindow.slice(1).map((s) => s.e1rmKg));
      eligible.push({ gain: (best - first) / first });
    } else if (inWindow.length > 0) close++;
  }
  if (eligible.length < F.minExercises) {
    const n = F.minExercises - eligible.length;
    return insufficient(
      'force',
      `Fais au moins ${F.minExercises} exercices polyarticulaires ${F.minSessions} fois chacun sur 12 semaines : il en manque ${n}${close ? `, dont ${Math.min(n, close)} déjà commencé${Math.min(n, close) > 1 ? 's' : ''}` : ''}.`,
    );
  }
  const gain = eligible.reduce((n, e) => n + e.gain, 0) / eligible.length;
  const since = addDays(today, -7 * F.recordWeeks + 1);
  const records = m.records.filter((r) => r.date >= since && r.date <= today).length;
  const factors: Factor[] = [
    {
      label: 'Gain de 1RM estimé',
      value: clamp(F.floor + (gain / F.gainForMax) * (100 - F.floor)),
      weight: 70,
      detail: `${gain >= 0 ? '+' : ''}${(Math.round(gain * 1000) / 10).toString().replace('.', ',')} % en moyenne sur ${eligible.length} exercices`,
    },
    { label: 'Records sur 8 semaines', value: clamp((records / F.recordsForMax) * 100), weight: 30, detail: `${records} record${records > 1 ? 's' : ''}` },
  ];
  const weeks = new Set(m.done.filter((w) => w.date >= from && w.date <= today).map((w) => weekStart(w.date)));
  return { key: 'force', score: combine(factors), confidence: confidenceFor(weeks.size), factors, missing: null };
}

function hypertrophy(m: LevelModel, today: string, from: string, resolve: MuscleResolver, muscles: readonly MuscleGroup[]): Raw {
  const H = C.hypertrophy;
  const active = windowWeeks(today).filter((w) => m.done.some((x) => x.date >= w && x.date <= addDays(w, 6) && x.date <= today));
  if (active.length < H.minWeeks) return insufficient('hypertrophie', `Il faut ${H.minWeeks} semaines avec au moins une séance sur les 12 dernières : tu en as ${active.length}.`);
  const totals = new Map<MuscleGroup, number>();
  for (const w of active) {
    const v = muscleVolumeBetween(m.done, m.sets, resolve, w, addDays(w, 6)).muscles;
    for (const muscle of muscles) totals.set(muscle, (totals.get(muscle) ?? 0) + v[muscle].directSets);
  }
  const inRange = muscles.filter((x) => {
    const avg = (totals.get(x) ?? 0) / active.length;
    return avg >= H.low && avg <= H.high;
  }).length;
  const factors: Factor[] = [
    {
      label: 'Muscles entre 10 et 20 séries',
      value: (inRange / muscles.length) * 100,
      weight: 50,
      detail: `${inRange} groupes sur ${muscles.length}, en moyenne par semaine active`,
    },
  ];
  const rate = weeksRate(programWeeksIn(m, from, today).flat());
  if (rate !== null) factors.push({ label: 'Séances faites sur prévues', value: rate * 100, weight: 25, detail: pct(rate) });
  const trends = [...m.sessions.values()].map((list) => list.filter((s) => s.date >= from && s.date <= today)).filter((list) => list.length >= 3);
  if (trends.length) {
    const up = trends.filter((list) => exerciseTrend(list).kind === 'progression').length;
    factors.push({ label: 'Exercices en progression', value: (up / trends.length) * 100, weight: 25, detail: `${up} sur ${trends.length}` });
  }
  return { key: 'hypertrophie', score: combine(factors), confidence: confidenceFor(active.length), factors, missing: null };
}

/** Semaines des programmes suivis dans la fenêtre : celles du programme actif et des programmes terminés, jamais d'un programme en pause. */
function programWeeksIn(m: LevelModel, from: string, today: string) {
  return m.programWeeks
    .filter(({ program }) => program.status === 'actif' || program.active || (program.status === 'termine' && program.endDate))
    .map(({ program, weeks }) =>
      weeks
        .filter((w) => w.end >= from && w.start <= today && (!program.endDate || program.status !== 'termine' || w.start <= program.endDate))
        .map((w) => ({ ...w, slots: w.slots.filter((s) => s.date >= from && s.date <= today) })),
    );
}

function journalWeeks(m: LevelModel, today: string): number {
  const first = activeOnly(m.input.activities)
    .filter((a) => a.date <= today)
    .map((a) => a.date)
    .sort()[0];
  return first ? Math.min(C.windowWeeks, Math.floor(daysBetween(first, today) / 7) + 1) : 0;
}

function endurance(m: LevelModel, today: string): Raw {
  const E = C.endurance;
  const weeks = journalWeeks(m, today);
  if (weeks < E.minWeeks)
    return insufficient(
      'endurance',
      weeks
        ? `Le journal d’activité couvre ${weeks} semaine${weeks > 1 ? 's' : ''} : il en faut ${E.minWeeks}.`
        : 'Note tes séances de cardio dans le journal d’activité, pendant 4 semaines.',
    );
  const from = addDays(today, -7 * weeks + 1);
  const cardio = activeOnly(m.input.activities).filter((a) => a.kind === 'cardio' && a.date >= from && a.date <= today);
  const minutes = cardio.reduce((n, a) => n + a.minutes, 0) / weeks;
  const factors: Factor[] = [
    { label: 'Minutes de cardio par semaine', value: clamp((minutes / E.weeklyMinutes) * 100), weight: 60, detail: `${Math.round(minutes)} min sur ${E.weeklyMinutes}` },
  ];
  const mid = addDays(from, Math.floor((weeks * 7) / 2));
  const firstHalf = cardio.filter((a) => a.date < mid);
  const secondHalf = cardio.filter((a) => a.date >= mid);
  if (firstHalf.length >= 2 && secondHalf.length >= 2) {
    const avg = (l: typeof cardio) => l.reduce((n, a) => n + a.minutes, 0) / l.length;
    const ratio = avg(secondHalf) / avg(firstHalf);
    factors.push({
      label: 'Durée des séances',
      value: clamp(50 + (ratio - 1) * 250),
      weight: 40,
      detail: `${Math.round(avg(firstHalf))} puis ${Math.round(avg(secondHalf))} min en moyenne`,
    });
  }
  const withData = new Set(cardio.map((a) => weekStart(a.date))).size;
  return { key: 'endurance', score: combine(factors), confidence: confidenceFor(withData), factors, missing: null };
}

function mobility(m: LevelModel, today: string): Raw {
  const M = C.mobility;
  const weeks = journalWeeks(m, today);
  if (weeks < M.minWeeks)
    return insufficient(
      'mobilite',
      weeks
        ? `Le journal d’activité couvre ${weeks} semaine${weeks > 1 ? 's' : ''} : il en faut ${M.minWeeks}.`
        : 'Note tes séances de mobilité dans le journal d’activité, pendant 4 semaines.',
    );
  const from = addDays(today, -7 * weeks + 1);
  const sessions = activeOnly(m.input.activities).filter((a) => a.kind === 'mobilite' && a.date >= from && a.date <= today);
  const perWeek = sessions.length / weeks;
  const factors: Factor[] = [
    {
      label: 'Séances de mobilité par semaine',
      value: clamp((perWeek / M.weeklySessions) * 100),
      weight: 100,
      detail: `${(Math.round(perWeek * 10) / 10).toString().replace('.', ',')} sur ${M.weeklySessions}`,
    },
  ];
  return { key: 'mobilite', score: combine(factors), confidence: confidenceFor(new Set(sessions.map((a) => weekStart(a.date))).size), factors, missing: null };
}

function regularity(m: LevelModel, today: string, from: string): Raw {
  const R = C.regularity;
  const weeks = programWeeksIn(m, from, today)
    .flat()
    .filter((w) => w.slots.some((s) => s.state !== 'a-venir' && s.state !== 'aujourdhui'));
  if (weeks.length < R.minWeeks)
    return insufficient(
      'regularite',
      `Il faut ${R.minWeeks} semaines avec un programme actif et des séances prévues : tu en as ${weeks.length}. Le programme actif a-t-il sa date de début ?`,
    );
  const closed = weeks.filter((w) => w.end < today || !w.slots.some((s) => s.state === 'a-venir' || s.state === 'aujourdhui'));
  const respected = closed.filter((w) => weekRespected(w).ok).length;
  const activeSet = new Set(m.done.filter((w) => w.date <= today).map((w) => weekStart(w.date)));
  let streak = 0;
  // La semaine en cours ne casse pas la série tant qu'elle n'est pas finie.
  let w = activeSet.has(weekStart(today)) ? weekStart(today) : addDays(weekStart(today), -7);
  while (activeSet.has(w)) {
    streak++;
    w = addDays(w, -7);
  }
  const factors: Factor[] = [
    { label: 'Semaines respectées', value: closed.length ? (respected / closed.length) * 100 : 0, weight: 70, detail: `${respected} sur ${closed.length}` },
    { label: 'Semaines actives d’affilée', value: clamp((streak / R.streakForMax) * 100), weight: 30, detail: `${streak} semaine${streak > 1 ? 's' : ''}` },
  ];
  return { key: 'regularite', score: combine(factors), confidence: confidenceFor(weeks.length), factors, missing: null };
}

function recovery(m: LevelModel, today: string, from: string): Raw {
  const R = C.recovery;
  const checkIns = activeOnly(m.input.checkIns).filter((c) => c.date >= from && c.date <= today);
  const recent = checkIns.filter((c) => c.date > addDays(today, -R.checkInDays));
  if (recent.length < R.minCheckIns) return insufficient('recuperation', `Il faut ${R.minCheckIns} check-ins sur les ${R.checkInDays} derniers jours : tu en as ${recent.length}.`);
  const nights = checkIns.filter((c) => c.sleepHours !== null && c.sleepHours !== undefined);
  const enough = nights.filter((c) => c.sleepHours! >= R.sleepHours).length;
  const firstCheckIn = checkIns.map((c) => c.date).sort()[0]!;
  const days = daysBetween(firstCheckIn, today) + 1;
  const mindDays = new Set(
    activeOnly(m.input.mindSessions)
      .filter((s) => s.completed && s.date >= from && s.date <= today)
      .map((s) => s.date),
  ).size;
  const factors: Factor[] = [];
  if (nights.length) factors.push({ label: 'Nuits de 7 h ou plus', value: (enough / nights.length) * 100, weight: 50, detail: `${enough} sur ${nights.length}` });
  factors.push({ label: 'Check-ins remplis', value: clamp((checkIns.length / days) * 100), weight: 25, detail: `${checkIns.length} sur ${days} jours` });
  const weeks = Math.max(1, (daysBetween(from, today) + 1) / 7);
  factors.push({
    label: 'Pratiques Mind',
    value: clamp((mindDays / weeks / R.mindDaysPerWeek) * 100),
    weight: 25,
    detail: `${(Math.round((mindDays / weeks) * 10) / 10).toString().replace('.', ',')} jours par semaine sur ${R.mindDaysPerWeek}`,
  });
  return { key: 'recuperation', score: combine(factors), confidence: confidenceFor(new Set(checkIns.map((c) => weekStart(c.date))).size), factors, missing: null };
}

function raw(m: LevelModel, today: string, resolve: MuscleResolver, muscles: readonly MuscleGroup[]): Raw[] {
  const from = addDays(today, -7 * C.windowWeeks + 1);
  return [force(m, today, from), hypertrophy(m, today, from, resolve, muscles), endurance(m, today), regularity(m, today, from), mobility(m, today), recovery(m, today, from)];
}

/** Les six caractéristiques à la date du modèle, avec leur variation sur 4 semaines. */
export function characteristics(m: LevelModel, resolve: MuscleResolver, muscles: readonly MuscleGroup[]): Characteristic[] {
  const now = raw(m, m.input.today, resolve, muscles);
  const before = raw(m, addDays(m.input.today, -C.compareDays), resolve, muscles);
  return now.map((c, i) => {
    const prev = before[i]!;
    if (c.score === null || prev.score === null) return { ...c, change: null };
    const delta = c.score - prev.score;
    const total = (fs: Factor[]) => fs.reduce((n, f) => n + f.weight, 0);
    const moved = c.factors
      .map((f) => {
        const old = prev.factors.find((x) => x.label === f.label);
        return { label: f.label, shift: Math.abs((f.value * f.weight) / total(c.factors) - (old ? (old.value * old.weight) / total(prev.factors) : 0)) };
      })
      .sort((a, b) => b.shift - a.shift)[0];
    return { ...c, change: { delta, factor: moved?.label ?? '' } };
  });
}
