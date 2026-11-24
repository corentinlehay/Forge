import { repos } from '../../db/hooks';
import type { WorkoutAdjustment, WorkoutTemplate } from '../../db/types';
import { toLocalDateKey } from '../../lib/dates';
import { nowIso } from '../../lib/ids';

/**
 * Démarre une séance (depuis le programme ou libre) et renvoie son identifiant.
 * Sans ajustement précisé, la version allégée acceptée dans PULSE pour cette séance s'applique.
 */
export async function startWorkout(template: WorkoutTemplate | null, now: Date = new Date(), adjustment?: WorkoutAdjustment | null): Promise<string> {
  const date = toLocalDateKey(now);
  if (adjustment === undefined) {
    const record = template ? await repos.pulseDays.byDate(date) : null;
    adjustment = record?.choice === 'alleger' && record.adjustment && record.plannedTemplateId === template?.id ? record.adjustment : null;
  }
  const workout = await repos.workouts.add({
    date,
    name: template?.name ?? 'Séance libre',
    templateId: template?.id ?? null,
    exerciseIds: template ? template.exercises.map((e) => e.exerciseId) : [],
    startedAt: nowIso(now),
    endedAt: null,
    ...(adjustment ? { adjustment } : {}),
  });
  return workout.id;
}
