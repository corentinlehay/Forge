import type { Program, ProgramObjective, ProgramStatus, WorkoutTemplate } from '../../db/types';
import { daysBetween } from '../../lib/dates';

/** Statut d'un programme ; absent (programme d'avant la v12) : déduit de `active`. */
export function programStatus(p: Pick<Program, 'status' | 'active'>): ProgramStatus {
  return p.status ?? (p.active ? 'actif' : 'pause');
}

export const STATUS_LABELS: Record<ProgramStatus, string> = {
  brouillon: 'Brouillon',
  actif: 'Actif',
  pause: 'En pause',
  termine: 'Terminé',
  archive: 'Archivé',
};

/** Ordre d'affichage des groupes de programmes. */
export const STATUS_ORDER: readonly ProgramStatus[] = ['actif', 'brouillon', 'pause', 'termine', 'archive'];

/** Titre d'un groupe dans la liste des programmes. */
export const STATUS_GROUPS: Record<ProgramStatus, string> = {
  actif: 'Programme actif',
  brouillon: 'Brouillons',
  pause: 'En pause',
  termine: 'Terminés',
  archive: 'Archivés',
};

export const OBJECTIVE_LABELS: Record<ProgramObjective, string> = {
  hypertrophie: 'Hypertrophie',
  force: 'Force',
  'endurance-musculaire': 'Endurance musculaire',
  'remise-en-forme': 'Remise en forme',
  'perte-de-gras': 'Perte de masse grasse',
  recomposition: 'Recomposition',
  athletique: 'Développement athlétique',
  maintien: 'Maintien et progression',
};

export const OBJECTIVES = Object.keys(OBJECTIVE_LABELS) as ProgramObjective[];

/** Durées de cycle proposées, en semaines. */
export const CYCLE_WEEKS = [4, 6, 8, 10, 12, 16] as const;
export const MAX_CYCLE_WEEKS = 52;

/** Programmes groupés par statut, dans l'ordre d'affichage ; dans un groupe, le plus récemment modifié d'abord. */
export function groupByStatus(programs: readonly Program[]): { status: ProgramStatus; programs: Program[] }[] {
  return STATUS_ORDER.map((status) => ({
    status,
    programs: programs.filter((p) => !p.deletedAt && programStatus(p) === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  })).filter((g) => g.programs.length > 0);
}

/** Séances d'un programme, dans leur ordre. */
export function sessionsOf(programId: string, templates: readonly WorkoutTemplate[]): WorkoutTemplate[] {
  return templates.filter((t) => !t.deletedAt && t.programId === programId).sort((a, b) => a.position - b.position);
}

/** Nombre de séances prévues par semaine (une séance prévue deux jours compte deux fois). */
export function sessionsPerWeek(sessions: readonly WorkoutTemplate[]): number {
  return sessions.reduce((sum, t) => sum + t.weekdays.length, 0);
}

export type CycleWeek = { kind: 'en-cours'; week: number; total: number | null } | { kind: 'a-venir'; startDate: string } | { kind: 'fini'; total: number; overBy: number };

/**
 * Où en est le cycle aujourd'hui. Sans date de début connue : null (on ne la devine pas).
 * Semaine 1 = les 7 premiers jours à partir du début.
 */
export function cycleWeek(p: Pick<Program, 'startDate' | 'durationWeeks'>, today: string): CycleWeek | null {
  if (!p.startDate) return null;
  const days = daysBetween(p.startDate, today);
  if (days < 0) return { kind: 'a-venir', startDate: p.startDate };
  const week = Math.floor(days / 7) + 1;
  const total = p.durationWeeks ?? null;
  if (total !== null && week > total) return { kind: 'fini', total, overBy: week - total };
  return { kind: 'en-cours', week, total };
}

/** Actions possibles selon le statut (« Activer » remplace le programme actif, qui passe en pause). */
export function statusActions(status: ProgramStatus): ProgramStatus[] {
  switch (status) {
    case 'brouillon':
      return ['actif'];
    case 'actif':
      return ['pause', 'termine'];
    case 'pause':
      return ['actif', 'termine', 'archive'];
    case 'termine':
      return ['actif', 'archive'];
    case 'archive':
      return ['pause'];
  }
}

/** Libellé du bouton qui fait passer un programme de `from` à `to`. */
export function actionLabel(from: ProgramStatus, to: ProgramStatus): string {
  if (to === 'actif') return from === 'brouillon' ? 'Activer ce programme' : from === 'termine' ? 'Recommencer un cycle' : 'Reprendre ce programme';
  if (to === 'pause') return from === 'archive' ? 'Sortir des archives' : 'Mettre en pause';
  if (to === 'termine') return 'Terminer le cycle';
  if (to === 'archive') return 'Archiver';
  return 'Repasser en brouillon';
}

/** Un programme supprimable : jamais l'actif (le mettre en pause d'abord). */
export const canDelete = (status: ProgramStatus) => status !== 'actif';
