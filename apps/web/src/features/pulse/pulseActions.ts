import { repos } from '../../db/hooks';
import type { PulseAction, PulseChoice, PulseReview, WorkoutAdjustment } from '../../db/types';
import { canRevert } from '../../domain/pulse/decisions';
import { pulseSnapshot, type PulseResult } from '../../domain/pulse/pulse';

/** Enregistre la décision sur la proposition du jour (le résultat du jour est d'abord gardé au journal). */
export async function decideProposal(
  result: PulseResult,
  action: Exclude<PulseAction, 'annuler'>,
  choice: PulseChoice,
  adjustment: WorkoutAdjustment | null = null,
): Promise<void> {
  await repos.pulseDays.saveSnapshot(pulseSnapshot(result));
  await repos.pulseDays.decide(result.date, action, choice, adjustment);
}

/**
 * Revient sur le choix du jour : une séance allégée en cours retrouve ses objectifs prévus,
 * et la proposition redevient en attente. La trace de l'ancien choix reste au journal.
 */
export async function revertChoice(date: string, today: string): Promise<{ ok: boolean; reason?: string }> {
  const record = await repos.pulseDays.byDate(date);
  const workouts = (await repos.workouts.listActive()).filter((w) => w.date === date);
  const check = canRevert(record, workouts, today);
  if (!check.ok) return check;
  if (check.workoutId) await repos.workouts.update(check.workoutId, { adjustment: null });
  await repos.pulseDays.undo(date);
  return { ok: true };
}

export async function saveReview(date: string, review: Omit<PulseReview, 'at'>): Promise<void> {
  await repos.pulseDays.saveReview(date, review);
}
