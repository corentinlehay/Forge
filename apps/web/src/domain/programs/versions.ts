import type { Program, ProgramSnapshot, ProgramVersion, TemplateExercise, WorkoutTemplate } from '../../db/types';
import { OBJECTIVE_LABELS } from './status';

/**
 * Versions d'un programme : une photo du programme et de ses séances, et ce qui a changé d'une version à l'autre.
 * Règle : une modification crée une nouvelle version seulement si la version courante a déjà servi à une séance ;
 * sinon, elle met à jour la version courante (rien n'a encore été suivi avec elle).
 */

const DAY_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
export const FIRST_VERSION_SUMMARY = 'Version de départ';
export const SUMMARY_MAX = 1000;

const cleanExercise = (e: TemplateExercise): TemplateExercise => ({
  exerciseId: e.exerciseId,
  sets: e.sets,
  reps: e.reps,
  restSec: e.restSec ?? null,
  rir: e.rir ?? null,
  ...(e.notes ? { notes: e.notes } : {}),
  ...(e.startWeightKg !== undefined && e.startWeightKg !== null ? { startWeightKg: e.startWeightKg } : {}),
});

/** Photo du programme tel qu'il est : ses informations et ses séances non supprimées, dans l'ordre. */
export function snapshotOf(program: Program, templates: readonly WorkoutTemplate[]): ProgramSnapshot {
  return {
    name: program.name,
    objective: program.objective ?? null,
    secondaryObjective: program.secondaryObjective ?? null,
    ...(program.note ? { note: program.note } : {}),
    durationWeeks: program.durationWeeks ?? null,
    sessions: templates
      .filter((t) => !t.deletedAt && t.programId === program.id)
      .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
      .map((t) => ({
        templateId: t.id,
        name: t.name,
        weekdays: [...t.weekdays].sort((x, y) => x - y),
        position: t.position,
        ...(t.warmup ? { warmup: t.warmup } : {}),
        exercises: t.exercises.map(cleanExercise),
      })),
  };
}

/** Deux photos décrivent-elles le même programme ? (les positions ne comptent que par l'ordre) */
export function sameSnapshot(a: ProgramSnapshot, b: ProgramSnapshot): boolean {
  const norm = (s: ProgramSnapshot) =>
    JSON.stringify({
      ...s,
      note: s.note ?? '',
      objective: s.objective ?? null,
      secondaryObjective: s.secondaryObjective ?? null,
      durationWeeks: s.durationWeeks ?? null,
      sessions: s.sessions.map(({ position: _position, ...rest }) => ({ ...rest, warmup: rest.warmup ?? '', exercises: rest.exercises.map(cleanExercise) })),
    });
  return norm(a) === norm(b);
}

const days = (w: readonly number[]) => (w.length ? w.map((d) => DAY_SHORT[d - 1]).join(', ') : 'sans jour fixe');
const weeksText = (w: number | null | undefined) => (w ? `${w} semaines` : 'sans durée');
const objectiveText = (o: ProgramSnapshot['objective']) => (o ? OBJECTIVE_LABELS[o].toLocaleLowerCase('fr-FR') : 'aucun');
const restText = (sec: number | null | undefined) => {
  if (!sec) return 'libre';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m} min${s ? ` ${String(s).padStart(2, '0')}` : ''}` : `${s} s`;
};

/** Ce qui change sur un exercice gardé dans une séance. */
function exerciseChanges(before: TemplateExercise, after: TemplateExercise): string[] {
  const out: string[] = [];
  if (before.sets !== after.sets) out.push(`${after.sets} séries (avant ${before.sets})`);
  if ((before.reps || '') !== (after.reps || '')) out.push(`${after.reps || 'répétitions libres'} rép. (avant ${before.reps || 'libres'})`);
  if ((before.restSec ?? null) !== (after.restSec ?? null)) out.push(`repos ${restText(after.restSec)} (avant ${restText(before.restSec)})`);
  if ((before.rir ?? null) !== (after.rir ?? null)) out.push(`RIR visé ${after.rir ?? 'libre'} (avant ${before.rir ?? 'libre'})`);
  if ((before.startWeightKg ?? null) !== (after.startWeightKg ?? null))
    out.push(after.startWeightKg !== undefined && after.startWeightKg !== null ? `charge de départ ${after.startWeightKg} kg` : 'charge de départ retirée');
  if ((before.notes ?? '') !== (after.notes ?? '')) out.push(after.notes ? 'consigne modifiée' : 'consigne retirée');
  return out;
}

/**
 * Les changements entre deux photos, en phrases courtes. Les séances se suivent par leur identifiant,
 * les exercices par leur identifiant dans la séance.
 */
export function diffSnapshots(before: ProgramSnapshot, after: ProgramSnapshot, nameOf: (exerciseId: string) => string): string[] {
  const lines: string[] = [];
  if (before.name !== after.name) lines.push(`Programme renommé « ${after.name} » (avant « ${before.name} »)`);
  if ((before.objective ?? null) !== (after.objective ?? null)) lines.push(`Objectif : ${objectiveText(after.objective)} (avant : ${objectiveText(before.objective)})`);
  if ((before.secondaryObjective ?? null) !== (after.secondaryObjective ?? null))
    lines.push(`Objectif secondaire : ${objectiveText(after.secondaryObjective)} (avant : ${objectiveText(before.secondaryObjective)})`);
  if ((before.durationWeeks ?? null) !== (after.durationWeeks ?? null)) lines.push(`Cycle : ${weeksText(after.durationWeeks)} (avant : ${weeksText(before.durationWeeks)})`);
  if ((before.note ?? '') !== (after.note ?? '')) lines.push('Description modifiée');

  const beforeById = new Map(before.sessions.map((s) => [s.templateId, s]));
  const afterIds = new Set(after.sessions.map((s) => s.templateId));
  for (const s of before.sessions) if (!afterIds.has(s.templateId)) lines.push(`Séance retirée : ${s.name}`);
  for (const s of after.sessions) {
    const old = beforeById.get(s.templateId);
    if (!old) {
      lines.push(`Séance ajoutée : ${s.name} (${days(s.weekdays)}, ${s.exercises.length} exercice${s.exercises.length > 1 ? 's' : ''})`);
      continue;
    }
    if (old.name !== s.name) lines.push(`Séance « ${old.name} » renommée « ${s.name} »`);
    if (days(old.weekdays) !== days(s.weekdays)) lines.push(`${s.name} : ${days(s.weekdays)} (avant : ${days(old.weekdays)})`);
    if ((old.warmup ?? '') !== (s.warmup ?? '')) lines.push(`${s.name} : échauffement ${s.warmup ? 'modifié' : 'retiré'}`);
    const oldIds = old.exercises.map((e) => e.exerciseId);
    const newIds = s.exercises.map((e) => e.exerciseId);
    for (const e of old.exercises) if (!newIds.includes(e.exerciseId)) lines.push(`${s.name} : ${nameOf(e.exerciseId)} retiré`);
    for (const e of s.exercises) {
      const prev = old.exercises.find((x) => x.exerciseId === e.exerciseId);
      if (!prev) {
        lines.push(`${s.name} : ${nameOf(e.exerciseId)} ajouté (${e.sets} × ${e.reps || 'libre'})`);
        continue;
      }
      const changes = exerciseChanges(prev, e);
      if (changes.length) lines.push(`${s.name}, ${nameOf(e.exerciseId)} : ${changes.join(', ')}`);
    }
    const kept = (ids: string[], other: string[]) => ids.filter((id) => other.includes(id));
    if (kept(oldIds, newIds).join('|') !== kept(newIds, oldIds).join('|')) lines.push(`${s.name} : ordre des exercices modifié`);
  }
  const oldOrder = before.sessions.map((s) => s.templateId).filter((id) => afterIds.has(id));
  const newOrder = after.sessions.map((s) => s.templateId).filter((id) => beforeById.has(id));
  if (oldOrder.join('|') !== newOrder.join('|')) lines.push('Ordre des séances modifié');
  return lines;
}

/** Résumé enregistré avec la version : une ligne par changement, borné en longueur. */
export function summaryText(lines: readonly string[]): string {
  if (!lines.length) return 'Aucun changement visible';
  const text = lines.join('\n');
  return text.length <= SUMMARY_MAX ? text : `${text.slice(0, SUMMARY_MAX - 1).replace(/\n[^\n]*$/, '')}\n…`;
}

export type VersionPlan = { kind: 'rien' } | { kind: 'creer'; version: number; summary: string } | { kind: 'mettre-a-jour'; id: string; summary: string };

/**
 * Que faire après une modification du programme :
 * - aucune version : la créer (version de départ) ;
 * - même photo : rien ;
 * - version courante déjà suivie par une séance : nouvelle version, avec ce qui a changé ;
 * - sinon : mettre la version courante à jour (son résumé compare toujours à la version d'avant).
 */
export function planVersion(
  versions: readonly ProgramVersion[],
  currentId: string | null | undefined,
  snapshot: ProgramSnapshot,
  followed: (versionId: string) => boolean,
  nameOf: (exerciseId: string) => string,
): VersionPlan {
  const list = versions.filter((v) => !v.deletedAt).sort((a, b) => a.version - b.version);
  const current = list.find((v) => v.id === currentId) ?? list.at(-1);
  if (!current) return { kind: 'creer', version: 1, summary: FIRST_VERSION_SUMMARY };
  if (sameSnapshot(current.snapshot, snapshot)) return { kind: 'rien' };
  if (followed(current.id))
    return { kind: 'creer', version: (list.at(-1)?.version ?? current.version) + 1, summary: summaryText(diffSnapshots(current.snapshot, snapshot, nameOf)) };
  const previous = list.filter((v) => v.version < current.version).at(-1);
  return { kind: 'mettre-a-jour', id: current.id, summary: previous ? summaryText(diffSnapshots(previous.snapshot, snapshot, nameOf)) : FIRST_VERSION_SUMMARY };
}
