import { libraryExercise } from '../../data/exerciseLibrary';
import { TRAITS } from '../../data/exerciseTraits';
import { capitalize, lowerFirst } from '../../lib/format';
import { prescribe, type PlannedExercise, type PlannedSession, type TrainingAnswers } from '../plan';

/**
 * Modifier une proposition avant de l'enregistrer : remplacer, ajouter, retirer, déplacer un exercice, changer ses séries.
 * Fonctions pures : elles rendent de nouvelles séances, sans toucher aux anciennes.
 */

export const MIN_SETS = 1;
export const MAX_EDIT_SETS = 8;

const mapSession = (sessions: readonly PlannedSession[], index: number, f: (exercises: PlannedExercise[]) => PlannedExercise[]): PlannedSession[] =>
  sessions.map((s, i) => (i === index ? { ...s, exercises: f(s.exercises.map((e) => ({ ...e }))) } : s));

/** Remplace un exercice : répétitions, repos et effort suivent le nouveau ; le nombre de séries reste. */
export function replaceExercise(sessions: readonly PlannedSession[], session: number, index: number, id: string, a: TrainingAnswers): PlannedSession[] {
  return mapSession(sessions, session, (list) => {
    const old = list[index];
    if (!old || old.libraryId === id || list.some((e) => e.libraryId === id) || !libraryExercise(id)) return list;
    list[index] = { ...prescribe(id, index, a), sets: old.sets };
    return list;
  });
}

/** Ajoute un exercice en fin de séance, avec la prescription de FORGE pour cette place. */
export function addExercise(sessions: readonly PlannedSession[], session: number, id: string, a: TrainingAnswers): PlannedSession[] {
  return mapSession(sessions, session, (list) => (list.some((e) => e.libraryId === id) || !libraryExercise(id) ? list : [...list, prescribe(id, list.length, a)]));
}

/** Retire un exercice ; une séance garde toujours au moins un exercice. */
export function removeExercise(sessions: readonly PlannedSession[], session: number, index: number): PlannedSession[] {
  return mapSession(sessions, session, (list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
}

export function moveExercise(sessions: readonly PlannedSession[], session: number, index: number, dir: -1 | 1): PlannedSession[] {
  return mapSession(sessions, session, (list) => {
    const to = index + dir;
    if (to < 0 || to >= list.length) return list;
    [list[index], list[to]] = [list[to]!, list[index]!];
    return list;
  });
}

export function setSets(sessions: readonly PlannedSession[], session: number, index: number, sets: number): PlannedSession[] {
  return mapSession(sessions, session, (list) => {
    if (list[index]) list[index]!.sets = Math.min(MAX_EDIT_SETS, Math.max(MIN_SETS, Math.round(sets)));
    return list;
  });
}

const nameOf = (id: string) => lowerFirst(libraryExercise(id)?.name ?? id);

/**
 * Ce qui change d'une version des séances à l'autre, une ligne par séance concernée :
 * « Poussée : développé couché remplacé par développé couché à la machine ; élévations latérales, 4 séries (avant 3) ».
 */
export function compareSessions(before: readonly PlannedSession[], after: readonly PlannedSession[]): string[] {
  const lines: string[] = [];
  after.forEach((s, i) => {
    const prev = before[i];
    if (!prev) return void lines.push(`${s.name} : nouvelle séance`);
    const was = prev.exercises.map((e) => e.libraryId);
    const now = s.exercises.map((e) => e.libraryId);
    const removed = was.filter((id) => !now.includes(id));
    const added = now.filter((id) => !was.includes(id));
    const parts: string[] = [];
    // Un exercice retiré et un ajouté : un remplacement s'ils ont le même mouvement, sinon le même muscle, sinon la même place.
    const pairs: (readonly [string, string])[] = [];
    const free = [...added];
    const match = (test: (from: string, to: string) => boolean) => {
      for (const from of removed) {
        if (pairs.some(([f]) => f === from)) continue;
        const to = free.find((x) => test(from, x));
        if (to) (pairs.push([from, to]), free.splice(free.indexOf(to), 1));
      }
    };
    match((f, t) => Boolean(TRAITS[f]) && TRAITS[f]?.pattern === TRAITS[t]?.pattern);
    match((f, t) => Boolean(libraryExercise(f)) && libraryExercise(f)?.muscle === libraryExercise(t)?.muscle);
    match((f, t) => now.indexOf(t) === was.indexOf(f));
    for (const [from, to] of pairs) parts.push(`${nameOf(from)} remplacé par ${nameOf(to)}`);
    const paired = new Set(pairs.flat());
    for (const id of removed.filter((x) => !paired.has(x))) parts.push(`${nameOf(id)} retiré`);
    for (const id of added.filter((x) => !paired.has(x))) parts.push(`${nameOf(id)} ajouté`);
    for (const e of s.exercises) {
      const old = prev.exercises.find((x) => x.libraryId === e.libraryId);
      if (old && old.sets !== e.sets && !paired.has(e.libraryId)) parts.push(`${nameOf(e.libraryId)}, ${e.sets} série${e.sets > 1 ? 's' : ''} (avant ${old.sets})`);
    }
    // L'ordre compare les exercices gardés, chaque remplacé à la place de celui qu'il remplace.
    const renamed = was.map((id) => pairs.find(([f]) => f === id)?.[1] ?? id);
    const common = (list: string[], other: string[]) => list.filter((id) => other.includes(id));
    if (common(renamed, now).join() !== common(now, renamed).join()) parts.push('ordre modifié');
    if (parts.length) lines.push(`${s.name} : ${parts.join(' ; ')}`);
  });
  return lines.map(capitalize);
}

/** Exercices touchés par l'utilisateur dans une séance par rapport à la proposition de FORGE (pour les signaler). */
export function changedIds(base: PlannedSession | undefined, session: PlannedSession): Set<string> {
  const out = new Set<string>();
  for (const e of session.exercises) {
    const old = base?.exercises.find((x) => x.libraryId === e.libraryId);
    if (!old || old.sets !== e.sets) out.add(e.libraryId);
  }
  return out;
}

export const sameSessions = (x: readonly PlannedSession[], y: readonly PlannedSession[]) => compareSessions(x, y).length === 0 && x.length === y.length;
